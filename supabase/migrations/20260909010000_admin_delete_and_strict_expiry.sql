BEGIN;

-- A paid period always wins over a legacy trial. Once it expires, access stays
-- blocked until an administrator records a new renewal.
CREATE OR REPLACE FUNCTION public.dietforge_my_access() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE mail text; a public.dietforge_access; paid timestamptz; trial_end timestamptz; source text; until_at timestamptz;
BEGIN
 SELECT lower(email) INTO mail FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL;
 IF mail IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF public.dietforge_is_admin() THEN RETURN jsonb_build_object('active',true,'status','admin','isAdmin',true,'email',mail,'expiresAt',null,'trialAvailable',false); END IF;
 SELECT * INTO a FROM public.dietforge_access WHERE email=mail;
 SELECT max(current_period_end) INTO paid FROM public.subscriptions WHERE lower(email)=mail AND status IN ('active','trialing');
 IF coalesce(a.suspended,false) THEN RETURN jsonb_build_object('active',false,'status','suspended','isAdmin',false,'email',mail,'expiresAt',a.expires_at,'trialAvailable',false); END IF;
 until_at:=greatest(a.expires_at,paid); trial_end:=a.trial_started_at + interval '15 days';
 source:=CASE WHEN paid IS NOT NULL AND (a.expires_at IS NULL OR paid>a.expires_at) THEN 'stripe' ELSE 'manual' END;
 IF until_at IS NOT NULL THEN
  IF until_at>now() THEN RETURN jsonb_build_object('active',true,'status','active','source',source,'isAdmin',false,'email',mail,'expiresAt',until_at,'trialAvailable',false); END IF;
  RETURN jsonb_build_object('active',false,'status','expired','isAdmin',false,'email',mail,'expiresAt',until_at,'trialAvailable',false);
 END IF;
 IF trial_end>now() THEN RETURN jsonb_build_object('active',true,'status','trialing','isAdmin',false,'email',mail,'expiresAt',trial_end,'trialAvailable',false); END IF;
 RETURN jsonb_build_object('active',false,'status',CASE WHEN trial_end IS NOT NULL THEN 'expired' ELSE 'pending' END,'isAdmin',false,'email',mail,'expiresAt',trial_end,'trialAvailable',false);
END $$;

CREATE OR REPLACE FUNCTION public.dietforge_admin_delete_coach(p_email text,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE mail text:=lower(btrim(p_email)); target uuid; prior jsonb; result jsonb; seen public.dietforge_access_audit;
BEGIN
 IF NOT public.dietforge_is_admin() THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF mail IS NULL OR length(mail)>254 OR mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR p_request_id IS NULL THEN RAISE EXCEPTION 'Invalid request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_id::text,0));
 SELECT * INTO seen FROM public.dietforge_access_audit WHERE actor_id=auth.uid() AND request_id=p_request_id;
 IF FOUND THEN
  IF seen.email<>mail OR seen.action<>'delete' THEN RAISE EXCEPTION 'Request ID already used'; END IF;
  RETURN seen.after_state;
 END IF;
 SELECT id INTO target FROM auth.users WHERE lower(email)=mail;
 IF target IS NOT NULL AND EXISTS(SELECT 1 FROM public.dietforge_admins WHERE user_id=target) THEN RAISE EXCEPTION 'Administrator cannot be deleted'; END IF;
 prior:=jsonb_build_object('email',mail,'user_id',target,'access',(SELECT to_jsonb(a) FROM public.dietforge_access a WHERE a.email=mail));
 IF target IS NOT NULL THEN
  DELETE FROM public.dietforge_activity_history WHERE owner_id=target;
  DELETE FROM public.dietforge_client_activity WHERE owner_id=target;
  DELETE FROM public.dietforge_workspaces WHERE owner_id=target;
 END IF;
 DELETE FROM public.dietforge_access WHERE email=mail;
 DELETE FROM public.subscriptions WHERE lower(email)=mail;
 result:=jsonb_build_object('deleted',true,'email',mail,'user_id',target);
 INSERT INTO public.dietforge_access_audit(actor_id,email,action,months,note,before_state,after_state,request_id)
 VALUES(auth.uid(),mail,'delete',null,'Eliminación permanente',prior,result,p_request_id);
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.dietforge_admin_delete_coach(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dietforge_admin_delete_coach(text,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
