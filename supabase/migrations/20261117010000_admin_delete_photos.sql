BEGIN;

-- Admin coach deletion must also retire the private photo-path registry so no
-- deleted client can ever recover those objects through a restored record.
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
  DELETE FROM public.dietforge_retired_photo_paths WHERE path LIKE target::text||'/%';
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
