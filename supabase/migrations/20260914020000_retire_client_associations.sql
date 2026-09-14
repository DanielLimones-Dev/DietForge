BEGIN;
CREATE TABLE public.dietforge_retired_activity (
 archive_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,client_id bigint NOT NULL,activity_id uuid NOT NULL,
 kind text NOT NULL,data jsonb NOT NULL,updated_at timestamptz NOT NULL,retired_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dietforge_retired_photo_paths(path text PRIMARY KEY,retired_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.dietforge_retired_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dietforge_retired_photo_paths ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dietforge_retired_activity,public.dietforge_retired_photo_paths FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.dietforge_retire_client(o uuid,c bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.dietforge_retired_activity(owner_id,client_id,activity_id,kind,data,updated_at)
 SELECT owner_id,client_id,id,kind,data,updated_at FROM public.dietforge_client_activity WHERE owner_id=o AND client_id=c;
 INSERT INTO public.dietforge_retired_photo_paths(path)
 SELECT name FROM storage.objects WHERE bucket_id='checkin-photos' AND split_part(name,'/',1)=o::text AND split_part(name,'/',2)=c::text ON CONFLICT DO NOTHING;
 DELETE FROM public.dietforge_client_portals WHERE owner_id=o AND client_id=c;
 DELETE FROM public.dietforge_notifications WHERE owner_id=o AND client_id=c;
 DELETE FROM public.dietforge_client_activity WHERE owner_id=o AND client_id=c;
END $$;
REVOKE ALL ON FUNCTION public.dietforge_retire_client(uuid,bigint) FROM PUBLIC,anon,authenticated;
-- Retire pre-existing orphan associations before a numeric ID can be reused.
DO $$DECLARE orphan record; BEGIN
 FOR orphan IN
  SELECT x.o,x.c FROM (
   SELECT owner_id o,client_id c FROM public.dietforge_client_portals
   UNION SELECT owner_id,client_id FROM public.dietforge_client_activity
   UNION SELECT owner_id,client_id FROM public.dietforge_notifications
   UNION SELECT split_part(name,'/',1)::uuid,split_part(name,'/',2)::bigint
    FROM storage.objects WHERE bucket_id='checkin-photos'
    AND name ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[0-9]{1,15}/[a-f0-9-]{36}\.(jpg|png|webp)$'
  ) x WHERE NOT EXISTS(SELECT 1 FROM public.dietforge_records r WHERE r.owner_id=x.o AND r.collection='clients' AND r.id=x.c)
 LOOP
  PERFORM 1 FROM public.dietforge_workspaces WHERE owner_id=orphan.o FOR UPDATE;
  PERFORM public.dietforge_retire_client(orphan.o,orphan.c);
 END LOOP;
END $$;

CREATE FUNCTION public.dietforge_retire_deleted_client() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.dietforge_workspaces WHERE owner_id=OLD.owner_id FOR UPDATE;
 PERFORM public.dietforge_retire_client(OLD.owner_id,OLD.id);RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.dietforge_retire_deleted_client() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER retire_deleted_client AFTER DELETE ON public.dietforge_records FOR EACH ROW WHEN(OLD.collection='clients') EXECUTE FUNCTION public.dietforge_retire_deleted_client();
ALTER FUNCTION public.dietforge_activity_save(uuid,bigint,uuid,text,jsonb) RENAME TO dietforge_activity_save_unlocked;
REVOKE ALL ON FUNCTION public.dietforge_activity_save_unlocked(uuid,bigint,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.dietforge_activity_save(o uuid,c bigint,i uuid,k text,d jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.dietforge_workspaces WHERE owner_id=o FOR UPDATE;
 PERFORM public.dietforge_activity_save_unlocked(o,c,i,k,d);
END $$;
REVOKE ALL ON FUNCTION public.dietforge_activity_save(uuid,bigint,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dietforge_activity_save(uuid,bigint,uuid,text,jsonb) TO authenticated;
ALTER FUNCTION public.dietforge_portal_grant(bigint,text,boolean) RENAME TO dietforge_portal_grant_unlocked;
REVOKE ALL ON FUNCTION public.dietforge_portal_grant_unlocked(bigint,text,boolean) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.dietforge_portal_grant(c bigint,mail text,enabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.dietforge_workspaces WHERE owner_id=auth.uid() FOR UPDATE;
 PERFORM public.dietforge_portal_grant_unlocked(c,mail,enabled);
END $$;
REVOKE ALL ON FUNCTION public.dietforge_portal_grant(bigint,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dietforge_portal_grant(bigint,text,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.dietforge_checkin_photo_allowed(path text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF path !~ '^[a-f0-9-]{36}/[0-9]{1,15}/[a-f0-9-]{36}\.(jpg|png|webp)$' OR EXISTS(SELECT 1 FROM public.dietforge_retired_photo_paths p WHERE p.path=$1) THEN RETURN false; END IF;
 RETURN public.dietforge_client_allowed(split_part(path,'/',1)::uuid,split_part(path,'/',2)::bigint);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $$;
CREATE FUNCTION public.dietforge_checkin_photo_insert_allowed(path text) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE o uuid;
BEGIN
 IF path !~ '^[a-f0-9-]{36}/[0-9]{1,15}/[a-f0-9-]{36}\.(jpg|png|webp)$' THEN RETURN false; END IF;
 o:=split_part(path,'/',1)::uuid;
 PERFORM 1 FROM public.dietforge_workspaces WHERE owner_id=o FOR UPDATE;
 RETURN public.dietforge_checkin_photo_allowed(path);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.dietforge_checkin_photo_insert_allowed(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dietforge_checkin_photo_insert_allowed(text) TO authenticated;
DROP POLICY checkin_photo_insert ON storage.objects;
CREATE POLICY checkin_photo_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='checkin-photos' AND public.dietforge_checkin_photo_insert_allowed(name));
CREATE OR REPLACE FUNCTION public.dietforge_backup_restore(b bigint,expected bigint,mutation uuid) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE saved jsonb;rev bigint;a jsonb;client record;payload jsonb;
BEGIN
 IF NOT public.dietforge_has_access() THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.dietforge_workspaces WHERE owner_id=auth.uid() FOR UPDATE;
 SELECT revision INTO rev FROM public.dietforge_mutations WHERE owner_id=auth.uid() AND mutation_id=mutation;
 IF FOUND THEN RETURN rev; END IF;
 saved:=public.dietforge_backup_get(b);
 IF (SELECT revision FROM public.dietforge_workspaces WHERE owner_id=auth.uid()) IS DISTINCT FROM expected THEN RAISE EXCEPTION 'DIETFORGE_CONFLICT'; END IF;
 PERFORM public.dietforge_capture_backup();
 FOR client IN SELECT id FROM public.dietforge_records WHERE owner_id=auth.uid() AND collection='clients' UNION SELECT client_id FROM public.dietforge_client_activity WHERE owner_id=auth.uid() UNION SELECT client_id FROM public.dietforge_client_portals WHERE owner_id=auth.uid() LOOP
  PERFORM public.dietforge_retire_client(auth.uid(),client.id);
 END LOOP;
 rev:=public._dietforge_save_storage(saved->'snapshot',expected,mutation);
 FOR a IN SELECT value FROM jsonb_array_elements(saved->'activity') LOOP
  IF NOT EXISTS(SELECT 1 FROM public.dietforge_records WHERE owner_id=auth.uid() AND collection='clients' AND id=(a->>'client_id')::bigint) THEN CONTINUE; END IF;
  payload:=a->'data';
  -- Preserve original backup bytes; restored active rows must not revive retired media.
  IF a->>'kind'='checkin' AND jsonb_typeof(payload->'photos')='array' THEN
   payload:=jsonb_set(payload,'{photos}',coalesce((SELECT jsonb_agg(p) FROM jsonb_array_elements(payload->'photos') p WHERE public.dietforge_checkin_photo_allowed(p->>'path') AND EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='checkin-photos' AND name=p->>'path')),'[]'::jsonb));
  END IF;
  INSERT INTO public.dietforge_client_activity(owner_id,client_id,id,kind,data,updated_at)
  VALUES(auth.uid(),(a->>'client_id')::bigint,(a->>'id')::uuid,a->>'kind',payload,(a->>'updated_at')::timestamptz);
 END LOOP;
 RETURN rev;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
