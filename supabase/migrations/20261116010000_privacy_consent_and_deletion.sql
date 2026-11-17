BEGIN;

-- Aviso de privacidad y consentimiento — 2026-11-16, versión 1.0.
-- La versión publicada aquí es la única que el servidor acepta como consentimiento.

CREATE TABLE IF NOT EXISTS public.dietforge_privacy_notices (
 version text PRIMARY KEY CHECK(version ~ '^[0-9]+[.][0-9]+$'),
 effective_at timestamptz NOT NULL,
 published_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.dietforge_privacy_notices(version,effective_at)
 VALUES('1.0','2026-11-16T00:00:00-06:00') ON CONFLICT(version) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.dietforge_privacy_consents (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 version text NOT NULL REFERENCES public.dietforge_privacy_notices(version),
 accepted_at timestamptz NOT NULL DEFAULT now(),
 source text NOT NULL CHECK(source IN ('portal_signup','coach_activation')),
 updated_at timestamptz NOT NULL DEFAULT now()
);

-- Bitácora de solicitudes ARCO. No depende de auth.users: debe sobrevivir a la
-- eliminación de la cuenta como evidencia de cumplimiento.
CREATE TABLE IF NOT EXISTS public.dietforge_privacy_requests (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 request_id uuid NOT NULL UNIQUE,
 user_id uuid,
 email text NOT NULL CHECK(email=lower(btrim(email))),
 action text NOT NULL CHECK(action IN ('export','delete')),
 requested_at timestamptz NOT NULL DEFAULT now(),
 detail jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.dietforge_privacy_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dietforge_privacy_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dietforge_privacy_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dietforge_privacy_notices,public.dietforge_privacy_consents,public.dietforge_privacy_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.dietforge_privacy_notices TO anon,authenticated;
GRANT SELECT ON public.dietforge_privacy_consents,public.dietforge_privacy_requests TO authenticated;

CREATE POLICY dietforge_privacy_notices_read ON public.dietforge_privacy_notices FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY dietforge_privacy_consents_read ON public.dietforge_privacy_consents FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY dietforge_privacy_requests_read ON public.dietforge_privacy_requests FOR SELECT TO authenticated
 USING(user_id=auth.uid() OR public.dietforge_is_admin());

CREATE OR REPLACE FUNCTION public.dietforge_privacy_current_version() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT version FROM public.dietforge_privacy_notices WHERE effective_at<=now() ORDER BY effective_at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.dietforge_privacy_record_consent(p_version text,p_source text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); current text; existing public.dietforge_privacy_consents; result jsonb;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_source IS NULL OR p_source NOT IN ('portal_signup','coach_activation') THEN RAISE EXCEPTION 'Invalid source'; END IF;
 IF p_version IS NULL OR NOT EXISTS(SELECT 1 FROM public.dietforge_privacy_notices n WHERE n.version=p_version AND n.effective_at<=now()) THEN
  RAISE EXCEPTION 'Unknown privacy notice version';
 END IF;
 SELECT * INTO existing FROM public.dietforge_privacy_consents WHERE user_id=u FOR UPDATE;
 IF FOUND AND existing.version=p_version THEN
  RETURN jsonb_build_object('version',existing.version,'accepted_at',existing.accepted_at,'source',existing.source,'unchanged',true);
 END IF;
 INSERT INTO public.dietforge_privacy_consents(user_id,version,accepted_at,source,updated_at)
 VALUES(u,p_version,now(),p_source,now())
 ON CONFLICT(user_id) DO UPDATE SET version=EXCLUDED.version,accepted_at=EXCLUDED.accepted_at,source=EXCLUDED.source,updated_at=now()
 RETURNING jsonb_build_object('version',version,'accepted_at',accepted_at,'source',source,'unchanged',false) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.dietforge_privacy_read_consent() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); current text; recorded jsonb;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 current:=public.dietforge_privacy_current_version();
 SELECT jsonb_build_object('version',c.version,'accepted_at',c.accepted_at,'source',c.source)
  INTO recorded FROM public.dietforge_privacy_consents c WHERE c.user_id=u;
 RETURN jsonb_build_object('current_version',current,'consent',recorded);
END $$;

-- Exportación completa de los datos del titular. No exige suscripción vigente:
-- el derecho de acceso no depende del estado comercial de la cuenta.
CREATE OR REPLACE FUNCTION public.dietforge_privacy_export(p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); mail text; created timestamptz; confirmed timestamptz; payload jsonb;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'Invalid request'; END IF;
 SELECT lower(email),created_at,email_confirmed_at INTO mail,created,confirmed FROM auth.users WHERE id=u;
 payload:=jsonb_build_object(
  'titular',jsonb_build_object('aviso','Aviso de privacidad integral de DietForge','version_aviso',public.dietforge_privacy_current_version(),'generado_en',now()),
  'cuenta',jsonb_build_object('id',u,'email',mail,'alta',created,'correo_confirmado',confirmed),
  'consentimiento',coalesce((SELECT jsonb_build_object('version',c.version,'accepted_at',c.accepted_at,'source',c.source)
   FROM public.dietforge_privacy_consents c WHERE c.user_id=u),'null'::jsonb),
  'espacio',coalesce((SELECT jsonb_build_object('revision',w.revision,'updated_at',w.updated_at)
   FROM public.dietforge_workspaces w WHERE w.owner_id=u),'null'::jsonb),
  'datos',coalesce(public._dietforge_load_storage(),'null'::jsonb),
  'actividad',coalesce((SELECT jsonb_agg(jsonb_build_object('client_id',a.client_id,'id',a.id,'kind',a.kind,'data',a.data,'updated_at',a.updated_at) ORDER BY a.updated_at)
   FROM public.dietforge_client_activity a WHERE a.owner_id=u),'[]'::jsonb),
  'accesos_portal',coalesce((SELECT jsonb_agg(jsonb_build_object('owner_id',p.owner_id,'client_id',p.client_id,'email',p.email,'enabled',p.enabled))
   FROM public.dietforge_client_portals p WHERE p.owner_id=u OR lower(p.email)=mail),'[]'::jsonb),
  'solicitudes_privacidad',coalesce((SELECT jsonb_agg(jsonb_build_object('action',r.action,'requested_at',r.requested_at,'request_id',r.request_id) ORDER BY r.requested_at)
   FROM public.dietforge_privacy_requests r WHERE r.user_id=u OR lower(r.email)=mail),'[]'::jsonb)
 );
 INSERT INTO public.dietforge_privacy_requests(request_id,user_id,email,action,detail)
 VALUES(p_request_id,u,mail,'export',jsonb_build_object('version',public.dietforge_privacy_current_version()))
 ON CONFLICT(request_id) DO NOTHING;
 RETURN payload;
END $$;

-- Eliminación de la propia cuenta. Purga el espacio de trabajo completo, sus
-- respaldos (dietforge_backups) y los vínculos del portal; el servidor elimina
-- después los archivos privados y la identidad de Auth con la service role.
CREATE OR REPLACE FUNCTION public.dietforge_privacy_delete_account(p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); mail text; had_workspace boolean; backups_purged bigint; portal_links bigint;
 seen public.dietforge_privacy_requests; result jsonb;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'Invalid request'; END IF;
 IF public.dietforge_is_admin() THEN RAISE EXCEPTION 'The administrator account cannot be deleted from the app' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||p_request_id::text,0));
 SELECT * INTO seen FROM public.dietforge_privacy_requests WHERE request_id=p_request_id;
 IF FOUND THEN
  IF seen.user_id IS DISTINCT FROM u OR seen.action<>'delete' THEN RAISE EXCEPTION 'Request ID already used'; END IF;
  RETURN seen.detail;
 END IF;
 SELECT lower(email) INTO mail FROM auth.users WHERE id=u;
 had_workspace:=EXISTS(SELECT 1 FROM public.dietforge_workspaces WHERE owner_id=u);
 SELECT count(*) INTO backups_purged FROM public.dietforge_backups WHERE owner_id=u;
 SELECT count(*) INTO portal_links FROM public.dietforge_client_portals WHERE owner_id=u OR lower(email)=mail;

 -- Orden explícito: primero los respaldos con datos personales y luego el árbol
 -- del espacio de trabajo, para no depender solo del borrado en cascada.
 DELETE FROM public.dietforge_backups WHERE owner_id=u;
 DELETE FROM public.dietforge_activity_history WHERE owner_id=u;
 DELETE FROM public.dietforge_retired_activity WHERE owner_id=u;
 DELETE FROM public.dietforge_notifications WHERE owner_id=u;
 DELETE FROM public.dietforge_diet_notice_reads WHERE owner_id=u OR reader_id=u;
 DELETE FROM public.dietforge_diet_notices WHERE owner_id=u;
 DELETE FROM public.dietforge_menu_days WHERE owner_id=u;
 DELETE FROM public.dietforge_retired_menu_days WHERE owner_id=u;
 DELETE FROM public.dietforge_client_activity WHERE owner_id=u;
 DELETE FROM public.dietforge_client_portals WHERE owner_id=u OR lower(email)=mail;
 DELETE FROM public.dietforge_records WHERE owner_id=u;
 DELETE FROM public.dietforge_mutations WHERE owner_id=u;
 DELETE FROM public.dietforge_workspaces WHERE owner_id=u;
 DELETE FROM public.dietforge_privacy_consents WHERE user_id=u;
 DELETE FROM public.dietforge_access WHERE email=mail;
 DELETE FROM public.subscriptions WHERE lower(email)=mail;

 result:=jsonb_build_object('deleted',true,'user_id',u,'email',mail,
  'workspace_removed',had_workspace,'backups_purged',backups_purged,'portal_links_removed',portal_links);
 INSERT INTO public.dietforge_privacy_requests(request_id,user_id,email,action,detail)
 VALUES(p_request_id,u,mail,'delete',result);
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.dietforge_privacy_current_version(),public.dietforge_privacy_record_consent(text,text),public.dietforge_privacy_read_consent(),public.dietforge_privacy_export(uuid),public.dietforge_privacy_delete_account(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dietforge_privacy_record_consent(text,text),public.dietforge_privacy_read_consent(),public.dietforge_privacy_export(uuid),public.dietforge_privacy_delete_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dietforge_privacy_current_version() TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
