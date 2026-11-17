BEGIN;
-- Privacidad: consentimiento, exportación y eliminación con datos ficticios.
-- Ejecutar en una base local o de pruebas; siempre termina con ROLLBACK.

DO $$ DECLARE u uuid; mail text; failed boolean; r jsonb; a jsonb; b jsonb; BEGIN
 SELECT id,lower(email) INTO u,mail FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.dietforge_admins) AND email_confirmed_at IS NOT NULL LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'A confirmed non-admin fixture is required'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);

 -- El aviso vigente se publica y es la única versión aceptable.
 ASSERT public.dietforge_privacy_current_version()='1.0';
 failed:=false; BEGIN PERFORM public.dietforge_privacy_record_consent('0.9','portal_signup'); EXCEPTION WHEN OTHERS THEN failed:=true; END; ASSERT failed;
 failed:=false; BEGIN PERFORM public.dietforge_privacy_record_consent('1.0','origen_inventado'); EXCEPTION WHEN OTHERS THEN failed:=true; END; ASSERT failed;

 -- El consentimiento guarda fecha del servidor y es idempotente para la misma versión.
 a:=public.dietforge_privacy_record_consent('1.0','portal_signup');
 ASSERT (a->>'version')='1.0' AND (a->>'unchanged')::boolean=false;
 b:=public.dietforge_privacy_record_consent('1.0','portal_signup');
 ASSERT (b->>'unchanged')::boolean=true AND b->>'accepted_at'=a->>'accepted_at';

 -- La exportación incluye cuenta, consentimiento y datos; queda en bitácora.
 r:=public.dietforge_privacy_export(gen_random_uuid());
 ASSERT r->'cuenta'->>'email'=mail;
 ASSERT (r->'consentimiento'->>'version')='1.0';
 ASSERT r ? 'datos' AND r ? 'actividad' AND r ? 'accesos_portal';
 ASSERT EXISTS(SELECT 1 FROM public.dietforge_privacy_requests WHERE user_id=u AND action='export');

 -- La eliminación purga respaldos y espacio, y deja evidencia sin datos clínicos.
 PERFORM public.dietforge_capture_backup();
 ASSERT EXISTS(SELECT 1 FROM public.dietforge_backups WHERE owner_id=u);
 r:=public.dietforge_privacy_delete_account(gen_random_uuid());
 ASSERT (r->>'deleted')::boolean;
 ASSERT NOT EXISTS(SELECT 1 FROM public.dietforge_backups WHERE owner_id=u);
 ASSERT NOT EXISTS(SELECT 1 FROM public.dietforge_records WHERE owner_id=u);
 ASSERT NOT EXISTS(SELECT 1 FROM public.dietforge_workspaces WHERE owner_id=u);
 ASSERT NOT EXISTS(SELECT 1 FROM public.dietforge_privacy_consents WHERE user_id=u);
 ASSERT EXISTS(SELECT 1 FROM public.dietforge_privacy_requests WHERE user_id=u AND action='delete');
 ASSERT NOT public.dietforge_has_access();
END $$;
RESET ROLE;

-- anon no puede leer consentimientos ni solicitar eliminación; sí conoce el aviso vigente.
SET LOCAL ROLE anon;
DO $$ DECLARE failed boolean; BEGIN
 failed:=false; BEGIN PERFORM public.dietforge_privacy_record_consent('1.0','portal_signup'); EXCEPTION WHEN insufficient_privilege THEN failed:=true; END; ASSERT failed;
 failed:=false; BEGIN PERFORM public.dietforge_privacy_export(gen_random_uuid()); EXCEPTION WHEN insufficient_privilege THEN failed:=true; END; ASSERT failed;
 failed:=false; BEGIN PERFORM public.dietforge_privacy_delete_account(gen_random_uuid()); EXCEPTION WHEN insufficient_privilege THEN failed:=true; END; ASSERT failed;
 ASSERT NOT has_table_privilege('anon','public.dietforge_privacy_consents','SELECT');
 ASSERT has_table_privilege('anon','public.dietforge_privacy_notices','SELECT');
 ASSERT public.dietforge_privacy_current_version()='1.0';
END $$;
RESET ROLE;

-- El administrador no puede eliminar su propia cuenta desde la app.
DO $$ DECLARE admin uuid; failed boolean; BEGIN
 SELECT user_id INTO admin FROM public.dietforge_admins LIMIT 1;
 IF admin IS NULL THEN RETURN; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
 failed:=false;
 BEGIN PERFORM public.dietforge_privacy_delete_account(gen_random_uuid()); EXCEPTION WHEN insufficient_privilege THEN failed:=true; END;
 ASSERT failed;
END $$;
RESET ROLE;
ROLLBACK;
