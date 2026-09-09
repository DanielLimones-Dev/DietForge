BEGIN;

ALTER TABLE public.dietforge_records DROP CONSTRAINT IF EXISTS dietforge_records_collection_check;
ALTER TABLE public.dietforge_records ADD CONSTRAINT dietforge_records_collection_check
CHECK(collection IN ('clients','measurements','competitions','checkins','photos','weekPlans','foods','mealPlans','mealPlanItems','trainingPrograms','templates'));

CREATE OR REPLACE FUNCTION public._dietforge_load_storage() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); w public.dietforge_workspaces; d jsonb; k text;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO w FROM public.dietforge_workspaces WHERE owner_id=u;
 IF NOT FOUND THEN RETURN NULL; END IF;
 d:=coalesce(w.metadata->'database','{}'::jsonb);
 FOREACH k IN ARRAY ARRAY['clients','measurements','competitions','checkins','photos','weekPlans','foods','mealPlans','mealPlanItems','trainingPrograms'] LOOP
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
 FOREACH k IN ARRAY ARRAY['clients','measurements','competitions','checkins','photos','weekPlans','foods','mealPlans','mealPlanItems','trainingPrograms','templates'] LOOP
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
 UPDATE public.dietforge_workspaces SET revision=rev,metadata=jsonb_build_object('database',(p_snapshot->'database')-ARRAY['clients','measurements','competitions','checkins','photos','weekPlans','foods','mealPlans','mealPlanItems','trainingPrograms'],'preferences',p_snapshot->'preferences'),updated_at=now() WHERE owner_id=u;
 INSERT INTO public.dietforge_mutations(owner_id,mutation_id,revision) VALUES(u,p_mutation_id,rev);
 RETURN rev;
END $$;


REVOKE ALL ON FUNCTION public._dietforge_load_storage(),public._dietforge_save_storage(jsonb,bigint,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.dietforge_load() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF NOT public.dietforge_has_access() THEN RAISE EXCEPTION 'DIETFORGE_ACCESS_REQUIRED' USING ERRCODE='42501'; END IF; RETURN public._dietforge_load_storage(); END $$;
CREATE OR REPLACE FUNCTION public.dietforge_save(p_snapshot jsonb,p_expected_revision bigint,p_mutation_id uuid) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF NOT public.dietforge_has_access() THEN RAISE EXCEPTION 'DIETFORGE_ACCESS_REQUIRED' USING ERRCODE='42501'; END IF; RETURN public._dietforge_save_storage(p_snapshot,p_expected_revision,p_mutation_id); END $$;

CREATE TABLE IF NOT EXISTS public.dietforge_client_portals (
 owner_id uuid NOT NULL REFERENCES public.dietforge_workspaces(owner_id) ON DELETE CASCADE,
 client_id bigint NOT NULL, email text NOT NULL, enabled boolean NOT NULL DEFAULT true,
 PRIMARY KEY(owner_id,client_id), CHECK(email=lower(btrim(email)))
);
CREATE TABLE IF NOT EXISTS public.dietforge_client_activity (
 owner_id uuid NOT NULL, client_id bigint NOT NULL, id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('session','meal','checkin','event')),
 data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,client_id,id)
);
ALTER TABLE public.dietforge_client_portals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dietforge_client_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dietforge_client_portals,public.dietforge_client_activity FROM PUBLIC,anon,authenticated;

-- Membership uses a verified Auth email and an existing client. It never grants coach access.
CREATE OR REPLACE FUNCTION public.dietforge_client_allowed(o uuid,c bigint) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.dietforge_records WHERE owner_id=o AND collection='clients' AND id=c)
 AND ((o=auth.uid() AND public.dietforge_has_access()) OR EXISTS(
 SELECT 1 FROM public.dietforge_client_portals p JOIN auth.users u ON u.id=auth.uid()
 WHERE p.owner_id=o AND p.client_id=c AND p.enabled AND u.email_confirmed_at IS NOT NULL AND lower(u.email)=p.email));
$$;
CREATE OR REPLACE FUNCTION public.dietforge_portal_grant(c bigint,mail text,enabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.dietforge_has_access() OR NOT EXISTS(SELECT 1 FROM public.dietforge_records WHERE owner_id=auth.uid() AND collection='clients' AND id=c) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF mail IS NULL OR length(mail)>254 OR mail !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' OR enabled IS NULL THEN RAISE EXCEPTION 'Invalid email'; END IF;
 INSERT INTO public.dietforge_client_portals VALUES(auth.uid(),c,lower(btrim(mail)),enabled)
 ON CONFLICT(owner_id,client_id) DO UPDATE SET email=EXCLUDED.email,enabled=EXCLUDED.enabled;
END $$;
CREATE OR REPLACE FUNCTION public.dietforge_portal_memberships() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('owner_id',p.owner_id,'client_id',p.client_id,'name',r.data->>'name','email',p.email,'enabled',p.enabled)),'[]'::jsonb)
 FROM public.dietforge_client_portals p JOIN public.dietforge_records r ON r.owner_id=p.owner_id AND r.collection='clients' AND r.id=p.client_id
 WHERE (p.owner_id=auth.uid() AND public.dietforge_has_access()) OR (p.enabled AND EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL AND lower(email)=p.email));
$$;
CREATE OR REPLACE FUNCTION public.dietforge_portal_read(o uuid,c bigint) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; k text; rows jsonb;
BEGIN
 IF NOT public.dietforge_client_allowed(o,c) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('id',id,'name',data->>'name','next_check_in_date',data->>'next_check_in_date') INTO result FROM public.dietforge_records WHERE owner_id=o AND collection='clients' AND id=c;
 result:=jsonb_build_object('client',result);
 FOREACH k IN ARRAY ARRAY['trainingPrograms','mealPlans','measurements','weekPlans'] LOOP
 SELECT coalesce(jsonb_agg(CASE WHEN k='trainingPrograms' THEN data-'review' ELSE data END),'[]'::jsonb) INTO rows FROM public.dietforge_records WHERE owner_id=o AND collection=k AND data->>'client_id'=c::text AND (k<>'trainingPrograms' OR data->>'status'='active');
 result:=jsonb_set(result,ARRAY[k],rows);
 END LOOP;
 SELECT coalesce(jsonb_agg(i.data),'[]'::jsonb) INTO rows FROM public.dietforge_records i WHERE i.owner_id=o AND i.collection='mealPlanItems' AND EXISTS(SELECT 1 FROM public.dietforge_records p WHERE p.owner_id=o AND p.collection='mealPlans' AND p.data->>'client_id'=c::text AND p.id::text=i.data->>'meal_plan_id');
 result:=jsonb_set(result,ARRAY['mealPlanItems'],rows);
 SELECT coalesce(jsonb_agg(f.data),'[]'::jsonb) INTO rows FROM public.dietforge_records f WHERE f.owner_id=o AND f.collection='foods' AND EXISTS(SELECT 1 FROM jsonb_array_elements(result->'mealPlanItems') i WHERE i->>'food_id'=f.id::text);
 result:=jsonb_set(result,ARRAY['foods'],rows);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'data',data,'updated_at',updated_at)),'[]'::jsonb) INTO rows FROM public.dietforge_client_activity WHERE owner_id=o AND client_id=c;
 RETURN jsonb_set(result,ARRAY['activity'],rows);
END $$;
CREATE OR REPLACE FUNCTION public.dietforge_activity_save(o uuid,c bigint,i uuid,k text,d jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE program jsonb; day jsonb; entry jsonb; s jsonb;
BEGIN
 IF NOT public.dietforge_client_allowed(o,c) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF i IS NULL OR k NOT IN ('session','meal','checkin','event') OR k IS NULL OR jsonb_typeof(d) IS DISTINCT FROM 'object' OR length(d::text)>100000 THEN RAISE EXCEPTION 'Invalid activity'; END IF;
 IF d->>'date' IS NULL OR d->>'date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Invalid date'; END IF;
 PERFORM (d->>'date')::date;
 IF k='event' AND o<>auth.uid() THEN RAISE EXCEPTION 'Coach required' USING ERRCODE='42501'; END IF;
 IF k='session' THEN
 SELECT data INTO program FROM public.dietforge_records WHERE owner_id=o AND collection='trainingPrograms' AND id::text=d->>'program_id' AND data->>'client_id'=c::text AND (o=auth.uid() OR data->>'status'='active');
 IF program IS NULL OR (d->>'week')::int NOT BETWEEN 1 AND (program->>'duration_weeks')::int OR d->>'week' IS NULL THEN RAISE EXCEPTION 'Invalid program'; END IF;
 SELECT value INTO day FROM jsonb_array_elements(program->'days') WHERE value->>'id'=d->>'day_id';
 IF day IS NULL OR jsonb_typeof(d->'exercises') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'exercises')>100 THEN RAISE EXCEPTION 'Invalid session'; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(d->'exercises') LOOP
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(day->'exercises') WHERE value->>'id'=entry->>'exercise_id') OR jsonb_typeof(entry->'sets') IS DISTINCT FROM 'array' OR jsonb_array_length(entry->'sets')>30 THEN RAISE EXCEPTION 'Invalid exercise'; END IF;
 FOR s IN SELECT value FROM jsonb_array_elements(entry->'sets') LOOP
 IF jsonb_typeof(s->'kg') IS DISTINCT FROM 'number' OR jsonb_typeof(s->'reps') IS DISTINCT FROM 'number' OR jsonb_typeof(s->'rir') IS DISTINCT FROM 'number' OR (s->>'kg')::numeric NOT BETWEEN 0 AND 1500 OR (s->>'reps')::numeric NOT BETWEEN 0 AND 200 OR (s->>'rir')::numeric NOT BETWEEN 0 AND 10 THEN RAISE EXCEPTION 'Invalid set'; END IF;
 END LOOP; END LOOP;
 ELSIF k='meal' THEN
 IF NOT EXISTS(SELECT 1 FROM public.dietforge_records WHERE owner_id=o AND collection='mealPlans' AND id::text=d->>'plan_id' AND data->>'client_id'=c::text) THEN RAISE EXCEPTION 'Invalid plan'; END IF;
 ELSIF k='checkin' THEN
 IF jsonb_typeof(d->'weight') IS DISTINCT FROM 'number' OR (d->>'weight')::numeric NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid weight'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM public.dietforge_client_activity WHERE owner_id=o AND client_id=c AND id=i AND kind<>k) THEN RAISE EXCEPTION 'Activity type cannot change'; END IF;
 INSERT INTO public.dietforge_client_activity VALUES(o,c,i,k,d,now()) ON CONFLICT(owner_id,client_id,id) DO UPDATE SET data=EXCLUDED.data,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.dietforge_client_allowed(uuid,bigint),public.dietforge_portal_grant(bigint,text,boolean),public.dietforge_portal_memberships(),public.dietforge_portal_read(uuid,bigint),public.dietforge_activity_save(uuid,bigint,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dietforge_portal_grant(bigint,text,boolean),public.dietforge_portal_memberships(),public.dietforge_portal_read(uuid,bigint),public.dietforge_activity_save(uuid,bigint,uuid,text,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
