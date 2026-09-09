BEGIN;

ALTER TABLE public.dietforge_records DROP CONSTRAINT IF EXISTS dietforge_records_collection_check;
ALTER TABLE public.dietforge_records ADD CONSTRAINT dietforge_records_collection_check
CHECK(collection IN ('clients','measurements','competitions','checkins','photos','weekPlans','foods','mealPlans','mealPlanItems','trainingPrograms','exercises','templates'));

CREATE OR REPLACE FUNCTION public._dietforge_load_storage() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); w public.dietforge_workspaces; d jsonb; k text;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO w FROM public.dietforge_workspaces WHERE owner_id=u;
 IF NOT FOUND THEN RETURN NULL; END IF;
 d:=coalesce(w.metadata->'database','{}'::jsonb);
 FOREACH k IN ARRAY ARRAY['clients','measurements','competitions','checkins','photos','weekPlans','foods','mealPlans','mealPlanItems','trainingPrograms','exercises'] LOOP
  d:=jsonb_set(d,ARRAY[k],coalesce((SELECT jsonb_agg(data ORDER BY id) FROM public.dietforge_records WHERE owner_id=u AND collection=k),'[]'::jsonb));
 END LOOP;
 RETURN jsonb_build_object('revision',w.revision,'snapshot',jsonb_build_object('database',d,'templates',coalesce((SELECT jsonb_agg(data ORDER BY id) FROM public.dietforge_records WHERE owner_id=u AND collection='templates'),'[]'::jsonb),'preferences',coalesce(w.metadata->'preferences','{}'::jsonb)));
END $$;

CREATE OR REPLACE FUNCTION public._dietforge_save_storage(p_snapshot jsonb,p_expected_revision bigint,p_mutation_id uuid) RETURNS bigint
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
 FOREACH k IN ARRAY ARRAY['clients','measurements','competitions','checkins','photos','weekPlans','foods','mealPlans','mealPlanItems','trainingPrograms','exercises','templates'] LOOP
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
 UPDATE public.dietforge_workspaces SET revision=rev,metadata=jsonb_build_object('database',(p_snapshot->'database')-ARRAY['clients','measurements','competitions','checkins','photos','weekPlans','foods','mealPlans','mealPlanItems','trainingPrograms','exercises'],'preferences',p_snapshot->'preferences'),updated_at=now() WHERE owner_id=u;
 INSERT INTO public.dietforge_mutations(owner_id,mutation_id,revision) VALUES(u,p_mutation_id,rev);
 RETURN rev;
END $$;

REVOKE ALL ON FUNCTION public._dietforge_load_storage(),public._dietforge_save_storage(jsonb,bigint,uuid) FROM PUBLIC,anon,authenticated;

COMMIT;
