BEGIN;
-- Phase 1: retain the application's lossless record shape and IDs; isolate every coach.
CREATE TABLE IF NOT EXISTS public.dietforge_workspaces (
 owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.dietforge_records (
 owner_id uuid NOT NULL REFERENCES public.dietforge_workspaces(owner_id) ON DELETE CASCADE,
 collection text NOT NULL CHECK(collection IN ('clients','measurements','competitions','checkins','photos','weekPlans','foods','mealPlans','mealPlanItems','templates')),
 id bigint NOT NULL CHECK(id>0), data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 PRIMARY KEY(owner_id,collection,id)
);
CREATE TABLE IF NOT EXISTS public.dietforge_mutations (
 owner_id uuid NOT NULL REFERENCES public.dietforge_workspaces(owner_id) ON DELETE CASCADE,
 mutation_id uuid NOT NULL, revision bigint NOT NULL,
 PRIMARY KEY(owner_id,mutation_id)
);
ALTER TABLE public.dietforge_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dietforge_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dietforge_mutations ENABLE ROW LEVEL SECURITY;
CREATE POLICY dietforge_workspace_read ON public.dietforge_workspaces FOR SELECT TO authenticated USING(owner_id=auth.uid());
CREATE POLICY dietforge_records_read ON public.dietforge_records FOR SELECT TO authenticated USING(owner_id=auth.uid());
REVOKE ALL ON public.dietforge_workspaces, public.dietforge_records, public.dietforge_mutations FROM anon,authenticated;
GRANT SELECT ON public.dietforge_workspaces,public.dietforge_records TO authenticated;
CREATE OR REPLACE FUNCTION public.dietforge_load() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); w public.dietforge_workspaces; d jsonb; k text;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO w FROM public.dietforge_workspaces WHERE owner_id=u;
 IF NOT FOUND THEN RETURN NULL; END IF;
 d:=coalesce(w.metadata->'database','{}'::jsonb);
 FOREACH k IN ARRAY ARRAY['clients','measurements','competitions','checkins','photos','weekPlans','foods','mealPlans','mealPlanItems'] LOOP
  d:=jsonb_set(d,ARRAY[k],coalesce((SELECT jsonb_agg(data ORDER BY id) FROM public.dietforge_records WHERE owner_id=u AND collection=k),'[]'::jsonb));
 END LOOP;
 RETURN jsonb_build_object('revision',w.revision,'snapshot',jsonb_build_object('database',d,'templates',coalesce((SELECT jsonb_agg(data ORDER BY id) FROM public.dietforge_records WHERE owner_id=u AND collection='templates'),'[]'::jsonb),'preferences',coalesce(w.metadata->'preferences','{}'::jsonb)));
END $$;
CREATE OR REPLACE FUNCTION public.dietforge_save(p_snapshot jsonb,p_expected_revision bigint,p_mutation_id uuid) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); rev bigint; previous bigint; k text; rows jsonb; entry jsonb;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_mutation_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0 THEN RAISE EXCEPTION 'Invalid revision'; END IF;
 IF jsonb_typeof(p_snapshot->'database') IS DISTINCT FROM 'object' OR jsonb_typeof(p_snapshot->'preferences') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid snapshot'; END IF;
 INSERT INTO public.dietforge_workspaces(owner_id) VALUES(u) ON CONFLICT DO NOTHING;
 SELECT revision INTO rev FROM public.dietforge_workspaces WHERE owner_id=u FOR UPDATE;
 SELECT revision INTO previous FROM public.dietforge_mutations WHERE owner_id=u AND mutation_id=p_mutation_id;
 IF FOUND THEN RETURN previous; END IF;
 IF rev<>p_expected_revision THEN RAISE EXCEPTION 'DIETFORGE_CONFLICT' USING ERRCODE='40001'; END IF;
 FOREACH k IN ARRAY ARRAY['clients','measurements','competitions','checkins','photos','weekPlans','foods','mealPlans','mealPlanItems','templates'] LOOP
  rows:=CASE WHEN k='templates' THEN p_snapshot->'templates' ELSE p_snapshot->'database'->k END;
  IF jsonb_typeof(rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Missing collection: %',k; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(rows) r WHERE jsonb_typeof(r) IS DISTINCT FROM 'object' OR NOT (r ? 'id') OR (r->>'id') !~ '^[1-9][0-9]*$') THEN RAISE EXCEPTION 'Invalid ID: %',k; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(rows)) <> (SELECT count(DISTINCT r->>'id') FROM jsonb_array_elements(rows) r) THEN RAISE EXCEPTION 'Duplicate ID: %',k; END IF;
  DELETE FROM public.dietforge_records WHERE owner_id=u AND collection=k AND id NOT IN (SELECT (r->>'id')::bigint FROM jsonb_array_elements(rows) r);
  INSERT INTO public.dietforge_records(owner_id,collection,id,data)
   SELECT u,k,(r->>'id')::bigint,r FROM jsonb_array_elements(rows) r
   ON CONFLICT(owner_id,collection,id) DO UPDATE SET data=EXCLUDED.data;
 END LOOP;
 rev:=rev+1;
 UPDATE public.dietforge_workspaces SET revision=rev,metadata=jsonb_build_object('database',(p_snapshot->'database')-ARRAY['clients','measurements','competitions','checkins','photos','weekPlans','foods','mealPlans','mealPlanItems'],'preferences',p_snapshot->'preferences'),updated_at=now() WHERE owner_id=u;
 INSERT INTO public.dietforge_mutations(owner_id,mutation_id,revision) VALUES(u,p_mutation_id,rev);
 RETURN rev;
END $$;
REVOKE ALL ON FUNCTION public.dietforge_load() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.dietforge_save(jsonb,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dietforge_load() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dietforge_save(jsonb,bigint,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
