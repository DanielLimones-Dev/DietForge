BEGIN;
CREATE TABLE IF NOT EXISTS public.dietforge_backups (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,owner_id uuid NOT NULL REFERENCES public.dietforge_workspaces(owner_id) ON DELETE CASCADE,
 revision bigint NOT NULL,snapshot jsonb NOT NULL,activity jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dietforge_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dietforge_backups FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.dietforge_capture_backup() RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb; a jsonb; result bigint;
BEGIN
 IF NOT public.dietforge_has_access() THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 s:=public._dietforge_load_storage();IF s IS NULL THEN RETURN NULL; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO a FROM public.dietforge_client_activity x WHERE owner_id=auth.uid();
 INSERT INTO public.dietforge_backups(owner_id,revision,snapshot,activity) VALUES(auth.uid(),(s->>'revision')::bigint,s->'snapshot',a) RETURNING id INTO result;RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.dietforge_save(p_snapshot jsonb,p_expected_revision bigint,p_mutation_id uuid) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous bigint;
BEGIN
 IF NOT public.dietforge_has_access() THEN RAISE EXCEPTION 'DIETFORGE_ACCESS_REQUIRED' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.dietforge_workspaces WHERE owner_id=auth.uid() FOR UPDATE;
 SELECT revision INTO previous FROM public.dietforge_mutations WHERE owner_id=auth.uid() AND mutation_id=p_mutation_id;
 IF FOUND THEN RETURN previous; END IF;
 -- Capture the prior state in the same transaction; failed writes leave no backup artifacts.
 PERFORM public.dietforge_capture_backup();
 RETURN public._dietforge_save_storage(p_snapshot,p_expected_revision,p_mutation_id);
END $$;
CREATE OR REPLACE FUNCTION public.dietforge_backup_list() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;BEGIN
 IF NOT public.dietforge_has_access() THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(b)),'[]'::jsonb) INTO result FROM (SELECT id,revision,created_at,octet_length(snapshot::text) AS bytes FROM public.dietforge_backups WHERE owner_id=auth.uid() ORDER BY id DESC LIMIT 100)b;RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.dietforge_backup_get(b bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;BEGIN
 IF NOT public.dietforge_has_access() THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('snapshot',snapshot,'activity',activity,'revision',revision) INTO result FROM public.dietforge_backups WHERE owner_id=auth.uid() AND id=b;
 IF result IS NULL THEN RAISE EXCEPTION 'Backup unavailable'; END IF;RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.dietforge_backup_restore(b bigint,expected bigint,mutation uuid) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE saved jsonb; rev bigint; a jsonb;
BEGIN
 IF NOT public.dietforge_has_access() THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 saved:=public.dietforge_backup_get(b);
 rev:=public.dietforge_save(saved->'snapshot',expected,mutation);
 -- Preserve newer activity. Restore missing records only; old logs cannot erase client progress.
 FOR a IN SELECT value FROM jsonb_array_elements(saved->'activity') LOOP
 INSERT INTO public.dietforge_client_activity(owner_id,client_id,id,kind,data,updated_at) VALUES(auth.uid(),(a->>'client_id')::bigint,(a->>'id')::uuid,a->>'kind',a->'data',(a->>'updated_at')::timestamptz) ON CONFLICT DO NOTHING;
 END LOOP; RETURN rev;
END $$;
REVOKE ALL ON FUNCTION public.dietforge_capture_backup(),public.dietforge_backup_list(),public.dietforge_backup_get(bigint),public.dietforge_backup_restore(bigint,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dietforge_capture_backup(),public.dietforge_backup_list(),public.dietforge_backup_get(bigint),public.dietforge_backup_restore(bigint,bigint,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
