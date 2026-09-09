BEGIN;

CREATE TABLE IF NOT EXISTS public.dietforge_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.dietforge_access (
  email text PRIMARY KEY CHECK (email = lower(btrim(email))),
  expires_at timestamptz, suspended boolean NOT NULL DEFAULT false,
  trial_started_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.dietforge_access_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES auth.users(id), email text NOT NULL,
  action text NOT NULL, months integer, note text NOT NULL DEFAULT '',
  before_state jsonb, after_state jsonb NOT NULL, request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(actor_id,request_id)
);
ALTER TABLE public.dietforge_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dietforge_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dietforge_access_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dietforge_admins,public.dietforge_access,public.dietforge_access_audit FROM PUBLIC,anon,authenticated;

-- Role belongs to the verified Auth identity, never to browser-provided email.
INSERT INTO public.dietforge_admins(user_id)
SELECT id FROM auth.users WHERE id='a2c805ce-24ae-4804-8bc3-8ab6865bf4fb'
AND lower(email)='tilabrona99@gmail.com' AND email_confirmed_at IS NOT NULL
ON CONFLICT DO NOTHING;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.dietforge_admins WHERE user_id='a2c805ce-24ae-4804-8bc3-8ab6865bf4fb') THEN
 RAISE EXCEPTION 'Verified administrator identity not found'; END IF;
END $$;

-- Freeze legacy trials in server-owned records, preserving the existing date.
DO $$ DECLARE r record; started timestamptz; BEGIN
 FOR r IN SELECT u.email,w.metadata->'preferences'->>'dietforge_trial' AS trial
 FROM public.dietforge_workspaces w JOIN auth.users u ON u.id=w.owner_id LOOP
  IF r.trial IS NOT NULL THEN
   BEGIN started:=r.trial::timestamptz; EXCEPTION WHEN OTHERS THEN CONTINUE; END;
   INSERT INTO public.dietforge_access(email,trial_started_at) VALUES(lower(r.email),started) ON CONFLICT DO NOTHING;
  END IF;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.dietforge_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.dietforge_admins a JOIN auth.users u ON u.id=a.user_id
 WHERE a.user_id=auth.uid() AND u.email_confirmed_at IS NOT NULL);
$$;

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
 IF until_at>now() THEN RETURN jsonb_build_object('active',true,'status','active','source',source,'isAdmin',false,'email',mail,'expiresAt',until_at,'trialAvailable',false); END IF;
 IF trial_end>now() THEN RETURN jsonb_build_object('active',true,'status','trialing','isAdmin',false,'email',mail,'expiresAt',trial_end,'trialAvailable',false); END IF;
 RETURN jsonb_build_object('active',false,'status',CASE WHEN until_at IS NOT NULL OR trial_end IS NOT NULL THEN 'expired' ELSE 'pending' END,'isAdmin',false,'email',mail,'expiresAt',greatest(until_at,trial_end),'trialAvailable',false);
END $$;

CREATE OR REPLACE FUNCTION public.dietforge_has_access() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN auth.uid() IS NULL THEN false ELSE coalesce((public.dietforge_my_access()->>'active')::boolean,false) END;
$$;

CREATE OR REPLACE FUNCTION public.dietforge_admin_list() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; BEGIN
 IF NOT public.dietforge_is_admin() THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 WITH mails AS (SELECT lower(email) email FROM auth.users WHERE email IS NOT NULL UNION SELECT email FROM public.dietforge_access UNION SELECT lower(email) FROM public.subscriptions),
 rows AS (
 SELECT m.email,u.id AS user_id,u.created_at,u.last_sign_in_at,u.email_confirmed_at IS NOT NULL AS confirmed,
 EXISTS(SELECT 1 FROM public.dietforge_admins WHERE user_id=u.id) AS is_admin,
 coalesce(a.suspended,false) AS suspended,a.trial_started_at,
 greatest(a.expires_at,(SELECT max(current_period_end) FROM public.subscriptions s WHERE lower(s.email)=m.email AND s.status IN ('active','trialing'))) AS expires_at,
 a.expires_at AS manual_expires_at,
 (SELECT count(*) FROM public.dietforge_records r WHERE r.owner_id=u.id AND r.collection='clients') AS clients,
 (SELECT count(*) FROM public.dietforge_records r WHERE r.owner_id=u.id AND r.collection='mealPlans') AS plans
 FROM mails m LEFT JOIN auth.users u ON lower(u.email)=m.email LEFT JOIN public.dietforge_access a ON a.email=m.email
 ) SELECT coalesce(jsonb_agg(to_jsonb(rows) ORDER BY email),'[]'::jsonb) INTO result FROM rows;
 RETURN jsonb_build_object('coaches',result,'history',coalesce((SELECT jsonb_agg(t ORDER BY t.created_at DESC) FROM (SELECT id,email,action,months,note,before_state,after_state,created_at FROM public.dietforge_access_audit ORDER BY created_at DESC LIMIT 100) t),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.dietforge_admin_set_access(p_email text,p_action text,p_months integer,p_note text,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE mail text:=lower(btrim(p_email)); a public.dietforge_access; prior jsonb; result jsonb; seen public.dietforge_access_audit; base timestamptz; stripe_end timestamptz;
BEGIN
 IF NOT public.dietforge_is_admin() THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF mail IS NULL OR length(mail)>254 OR mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR p_request_id IS NULL OR length(coalesce(p_note,''))>500 OR p_action NOT IN ('renew','suspend','resume') OR p_action IS NULL THEN RAISE EXCEPTION 'Invalid request'; END IF;
 IF p_action='renew' AND (p_months IS NULL OR p_months NOT IN (1,3,12)) THEN RAISE EXCEPTION 'Choose 1, 3 or 12 months'; END IF;
 IF EXISTS(SELECT 1 FROM public.dietforge_admins x JOIN auth.users u ON u.id=x.user_id WHERE lower(u.email)=mail) THEN RAISE EXCEPTION 'Administrator access cannot be changed'; END IF;
 -- Serialize both duplicate requests and simultaneous renewals for one coach.
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_id::text,0));
 SELECT * INTO seen FROM public.dietforge_access_audit WHERE actor_id=auth.uid() AND request_id=p_request_id;
 IF FOUND THEN
  IF seen.email<>mail OR seen.action<>p_action OR seen.months IS DISTINCT FROM p_months OR seen.note<>coalesce(btrim(p_note),'') THEN RAISE EXCEPTION 'Request ID already used'; END IF;
  RETURN seen.after_state;
 END IF;
 INSERT INTO public.dietforge_access(email) VALUES(mail) ON CONFLICT DO NOTHING;
 SELECT * INTO a FROM public.dietforge_access WHERE email=mail FOR UPDATE;
 prior:=to_jsonb(a);
 IF p_action='renew' THEN
  SELECT max(current_period_end) INTO stripe_end FROM public.subscriptions WHERE lower(email)=mail AND status IN ('active','trialing');
  base:=greatest(now(),a.expires_at,stripe_end);
  UPDATE public.dietforge_access SET expires_at=base+make_interval(months=>p_months),suspended=false,updated_at=now() WHERE email=mail RETURNING to_jsonb(dietforge_access.*) INTO result;
 ELSE
  UPDATE public.dietforge_access SET suspended=(p_action='suspend'),updated_at=now() WHERE email=mail RETURNING to_jsonb(dietforge_access.*) INTO result;
 END IF;
 INSERT INTO public.dietforge_access_audit(actor_id,email,action,months,note,before_state,after_state,request_id)
 VALUES(auth.uid(),mail,p_action,p_months,coalesce(btrim(p_note),''),prior,result,p_request_id);
 RETURN result;
END $$;

-- Keep the lossless storage implementation and place server-side access checks
-- in front of it. Original records and revisions are not rewritten.
DO $$ BEGIN
 IF to_regprocedure('public._dietforge_load_storage()') IS NULL THEN ALTER FUNCTION public.dietforge_load() RENAME TO _dietforge_load_storage; END IF;
 IF to_regprocedure('public._dietforge_save_storage(jsonb,bigint,uuid)') IS NULL THEN ALTER FUNCTION public.dietforge_save(jsonb,bigint,uuid) RENAME TO _dietforge_save_storage; END IF;
END $$;
REVOKE ALL ON FUNCTION public._dietforge_load_storage(),public._dietforge_save_storage(jsonb,bigint,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.dietforge_load() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF NOT public.dietforge_has_access() THEN RAISE EXCEPTION 'DIETFORGE_ACCESS_REQUIRED' USING ERRCODE='42501'; END IF; RETURN public._dietforge_load_storage(); END $$;
CREATE OR REPLACE FUNCTION public.dietforge_save(p_snapshot jsonb,p_expected_revision bigint,p_mutation_id uuid) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF NOT public.dietforge_has_access() THEN RAISE EXCEPTION 'DIETFORGE_ACCESS_REQUIRED' USING ERRCODE='42501'; END IF; RETURN public._dietforge_save_storage(p_snapshot,p_expected_revision,p_mutation_id); END $$;
DROP POLICY IF EXISTS dietforge_workspace_read ON public.dietforge_workspaces;
CREATE POLICY dietforge_workspace_read ON public.dietforge_workspaces FOR SELECT TO authenticated USING(owner_id=auth.uid() AND public.dietforge_has_access());
DROP POLICY IF EXISTS dietforge_records_read ON public.dietforge_records;
CREATE POLICY dietforge_records_read ON public.dietforge_records FOR SELECT TO authenticated USING(owner_id=auth.uid() AND public.dietforge_has_access());

-- Stripe writes remain service-only; a browser must not grant itself a plan.
REVOKE ALL ON FUNCTION public.upsert_subscription(text,text,text,text,text,text,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_subscription(text,text,text,text,text,text,timestamptz,timestamptz) TO service_role;
REVOKE ALL ON public.subscriptions,public.stripe_events FROM anon,authenticated;

REVOKE ALL ON FUNCTION public.dietforge_is_admin(),public.dietforge_has_access(),public.dietforge_my_access(),public.dietforge_admin_list(),public.dietforge_admin_set_access(text,text,integer,text,uuid),public.dietforge_load(),public.dietforge_save(jsonb,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dietforge_is_admin(),public.dietforge_has_access(),public.dietforge_my_access(),public.dietforge_admin_list(),public.dietforge_admin_set_access(text,text,integer,text,uuid),public.dietforge_load(),public.dietforge_save(jsonb,bigint,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
