BEGIN;

-- Return the selected week's independent schedule, with legacy fallback.
CREATE OR REPLACE FUNCTION public.dietforge_program_days(program jsonb, week_number integer) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN jsonb_typeof(program->'week_days'->week_number::text)='array'
 THEN program->'week_days'->week_number::text ELSE coalesce(program->'days','[]'::jsonb) END;
$$;
REVOKE ALL ON FUNCTION public.dietforge_program_days(jsonb,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dietforge_program_days(jsonb,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.dietforge_activity_save(o uuid,c bigint,i uuid,k text,d jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE program jsonb; day jsonb; entry jsonb; s jsonb; prescribed jsonb; target jsonb; canonical jsonb:='[]'; prior jsonb; week_days jsonb;
BEGIN
 IF NOT public.dietforge_client_allowed(o,c) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF i IS NULL OR k NOT IN ('session','meal','checkin','event') OR k IS NULL OR jsonb_typeof(d) IS DISTINCT FROM 'object' OR length(d::text)>100000 THEN RAISE EXCEPTION 'Invalid activity'; END IF;
 IF d->>'date' IS NULL OR d->>'date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Invalid date'; END IF;
 PERFORM (d->>'date')::date;
 IF k='event' AND o<>auth.uid() THEN RAISE EXCEPTION 'Coach required' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(d->'completed') IS DISTINCT FROM 'boolean' AND k<>'checkin' THEN RAISE EXCEPTION 'Invalid completion'; END IF;
 IF k='event' AND (coalesce(length(btrim(d->>'title')),0) NOT BETWEEN 1 AND 300) THEN RAISE EXCEPTION 'Invalid reminder'; END IF;
 IF k='session' THEN
  IF jsonb_typeof(d->'week') IS DISTINCT FROM 'number' OR (d->>'week')::numeric<>trunc((d->>'week')::numeric) OR jsonb_typeof(d->'fatigue') IS DISTINCT FROM 'number' OR (d->>'fatigue')::numeric NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Invalid session values'; END IF;
  SELECT data INTO prior FROM public.dietforge_client_activity WHERE owner_id=o AND client_id=c AND id=i AND kind=k;
  IF prior IS NOT NULL AND (prior->'program_id' IS DISTINCT FROM d->'program_id' OR prior->'day_id' IS DISTINCT FROM d->'day_id' OR prior->'week' IS DISTINCT FROM d->'week') THEN RAISE EXCEPTION 'Session identity cannot change'; END IF;
  SELECT data INTO program FROM public.dietforge_records WHERE owner_id=o AND collection='trainingPrograms' AND id::text=d->>'program_id' AND data->>'client_id'=c::text AND (o=auth.uid() OR data->>'status'='active');
  IF program IS NULL OR d->>'week' IS NULL OR (d->>'week')::int NOT BETWEEN 1 AND (program->>'duration_weeks')::int THEN RAISE EXCEPTION 'Invalid program'; END IF;
  week_days:=public.dietforge_program_days(program,(d->>'week')::int);
  SELECT value INTO day FROM jsonb_array_elements(week_days) WHERE value->>'id'=d->>'day_id';
  IF day IS NULL OR jsonb_typeof(d->'exercises') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'exercises')>100 THEN RAISE EXCEPTION 'Invalid session'; END IF;
  IF jsonb_array_length(d->'exercises')<>jsonb_array_length(day->'exercises') OR (SELECT count(DISTINCT value->>'exercise_id') FROM jsonb_array_elements(d->'exercises'))<>jsonb_array_length(d->'exercises') THEN RAISE EXCEPTION 'Incomplete or duplicate exercises'; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(d->'exercises') LOOP
   SELECT value INTO prescribed FROM jsonb_array_elements(day->'exercises') WHERE value->>'id'=entry->>'exercise_id';
   SELECT value->'target' INTO target FROM jsonb_array_elements(coalesce(prior->'exercises','[]')) WHERE value->>'exercise_id'=entry->>'exercise_id';
   IF target IS NULL THEN SELECT value INTO target FROM jsonb_array_elements(prescribed->'prescriptions') WHERE value->'week'=d->'week'; END IF;
   IF target IS NULL OR jsonb_array_length(entry->'sets')<>(target->>'sets')::int THEN RAISE EXCEPTION 'Invalid prescribed sets'; END IF;
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(day->'exercises') WHERE value->>'id'=entry->>'exercise_id') OR jsonb_typeof(entry->'sets') IS DISTINCT FROM 'array' OR jsonb_array_length(entry->'sets')>30 THEN RAISE EXCEPTION 'Invalid exercise'; END IF;
   FOR s IN SELECT value FROM jsonb_array_elements(entry->'sets') LOOP
    IF jsonb_typeof(s->'completed') IS DISTINCT FROM 'boolean' OR ((d->>'completed')::boolean AND NOT (s->>'completed')::boolean) OR (s->>'reps')::numeric<>trunc((s->>'reps')::numeric) THEN RAISE EXCEPTION 'Invalid completed set'; END IF;
    IF jsonb_typeof(s->'kg') IS DISTINCT FROM 'number' OR jsonb_typeof(s->'reps') IS DISTINCT FROM 'number' OR jsonb_typeof(s->'rir') IS DISTINCT FROM 'number' OR (s->>'kg')::numeric NOT BETWEEN 0 AND 1500 OR (s->>'reps')::numeric NOT BETWEEN 0 AND 200 OR (s->>'rir')::numeric NOT BETWEEN 0 AND 10 THEN RAISE EXCEPTION 'Invalid set'; END IF;
   END LOOP;
   canonical:=canonical||jsonb_build_array(jsonb_build_object('exercise_id',prescribed->'id','name',prescribed->'name','library_id',prescribed->'library_id','target',target,'sets',entry->'sets'));
  END LOOP;
  d:=jsonb_set(d,'{exercises}',canonical);
 ELSIF k='meal' THEN
  IF jsonb_typeof(d->'rest') IS DISTINCT FROM 'boolean' OR NOT EXISTS(SELECT 1 FROM public.dietforge_records WHERE owner_id=o AND collection='mealPlanItems' AND data->'meal_plan_id'=d->'plan_id' AND data->'meal_time'=d->'meal_time' AND coalesce(data->>'day_type','normal')=CASE WHEN (d->>'rest')::boolean THEN 'rest' ELSE 'normal' END) THEN RAISE EXCEPTION 'Invalid meal'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.dietforge_records WHERE owner_id=o AND collection='mealPlans' AND id::text=d->>'plan_id' AND data->>'client_id'=c::text) THEN RAISE EXCEPTION 'Invalid plan'; END IF;
 ELSIF k='checkin' THEN
  IF jsonb_typeof(d->'weight') IS DISTINCT FROM 'number' OR (d->>'weight')::numeric NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid weight'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM public.dietforge_client_activity WHERE owner_id=o AND client_id=c AND id=i AND kind<>k) THEN RAISE EXCEPTION 'Activity type cannot change'; END IF;
 INSERT INTO public.dietforge_client_activity VALUES(o,c,i,k,d,now()) ON CONFLICT(owner_id,client_id,id) DO UPDATE SET data=EXCLUDED.data,updated_at=now();
END $$;

CREATE OR REPLACE FUNCTION public.dietforge_video_allowed(path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (
 (split_part(path,'/',1)=auth.uid()::text AND public.dietforge_has_access()) OR EXISTS(
 SELECT 1 FROM public.dietforge_records r
 WHERE r.collection='trainingPrograms' AND r.data->>'status'='active' AND split_part(path,'/',1)=r.owner_id::text
 AND EXISTS(SELECT 1 FROM public.dietforge_records c WHERE c.owner_id=r.owner_id AND c.collection='clients' AND c.id::text=r.data->>'client_id' AND public.dietforge_client_allowed(c.owner_id,c.id))
 AND (EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.data->'resources')='array' THEN r.data->'resources' ELSE '[]'::jsonb END) v WHERE v->>'url'='storage:'||path)
 OR EXISTS(SELECT 1 FROM jsonb_each(CASE WHEN jsonb_typeof(r.data->'week_days')='object' THEN r.data->'week_days' ELSE jsonb_build_object('1',coalesce(r.data->'days','[]'::jsonb)) END) w
 CROSS JOIN LATERAL jsonb_array_elements(w.value) d CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(d->'exercises')='array' THEN d->'exercises' ELSE '[]'::jsonb END) e
 WHERE e->>'video_custom'='true' AND e->>'video_url'='storage:'||path))));
$$;
REVOKE ALL ON FUNCTION public.dietforge_video_allowed(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dietforge_video_allowed(text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
