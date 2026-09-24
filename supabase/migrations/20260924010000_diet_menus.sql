BEGIN;

ALTER TABLE public.dietforge_records DROP CONSTRAINT IF EXISTS dietforge_records_collection_check;
ALTER TABLE public.dietforge_records ADD CONSTRAINT dietforge_records_collection_check
CHECK(collection IN ('clients','measurements','competitions','checkins','photos','weekPlans','foods','mealPlans','mealPlanItems','trainingPrograms','exercises','recipes','clientMenus','templates'));

CREATE OR REPLACE FUNCTION public._dietforge_load_storage() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); w public.dietforge_workspaces; d jsonb; k text;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO w FROM public.dietforge_workspaces WHERE owner_id=u;
 IF NOT FOUND THEN RETURN NULL; END IF;
 d:=coalesce(w.metadata->'database','{}'::jsonb);
 FOREACH k IN ARRAY ARRAY['clients','measurements','competitions','checkins','photos','weekPlans','foods','mealPlans','mealPlanItems','trainingPrograms','exercises','recipes','clientMenus'] LOOP
  d:=jsonb_set(d,ARRAY[k],coalesce((SELECT jsonb_agg(data ORDER BY id) FROM public.dietforge_records WHERE owner_id=u AND collection=k),'[]'::jsonb));
 END LOOP;
 RETURN jsonb_build_object('revision',w.revision,'snapshot',jsonb_build_object('database',d,'templates',coalesce((SELECT jsonb_agg(data ORDER BY id) FROM public.dietforge_records WHERE owner_id=u AND collection='templates'),'[]'::jsonb),'preferences',coalesce(w.metadata->'preferences','{}'::jsonb)));
END $$;

CREATE OR REPLACE FUNCTION public._dietforge_save_storage_before_diet_notices(p_snapshot jsonb,p_expected_revision bigint,p_mutation_id uuid) RETURNS bigint
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
 FOREACH k IN ARRAY ARRAY['clients','measurements','competitions','checkins','photos','weekPlans','foods','mealPlans','mealPlanItems','trainingPrograms','exercises','recipes','clientMenus','templates'] LOOP
  rows:=CASE WHEN k='templates' THEN p_snapshot->'templates' ELSE p_snapshot->'database'->k END;
  IF k IN ('recipes','clientMenus') AND NOT (p_snapshot->'database' ? k) THEN
   SELECT coalesce(jsonb_agg(data ORDER BY id),'[]'::jsonb) INTO rows FROM public.dietforge_records WHERE owner_id=u AND collection=k;
  END IF;
  IF jsonb_typeof(rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Missing collection: %',k; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(rows) r WHERE jsonb_typeof(r) IS DISTINCT FROM 'object' OR NOT (r ? 'id') OR (r->>'id') !~ '^[1-9][0-9]*$') THEN RAISE EXCEPTION 'Invalid ID: %',k; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(rows)) <> (SELECT count(DISTINCT r->>'id') FROM jsonb_array_elements(rows) r) THEN RAISE EXCEPTION 'Duplicate ID: %',k; END IF;
  DELETE FROM public.dietforge_records WHERE owner_id=u AND collection=k AND id NOT IN (SELECT (r->>'id')::bigint FROM jsonb_array_elements(rows) r);
  INSERT INTO public.dietforge_records(owner_id,collection,id,data)
   SELECT u,k,(r->>'id')::bigint,r FROM jsonb_array_elements(rows) r
   ON CONFLICT(owner_id,collection,id) DO UPDATE SET data=EXCLUDED.data;
 END LOOP;
 rev:=rev+1;
 UPDATE public.dietforge_workspaces SET revision=rev,metadata=jsonb_build_object('database',(p_snapshot->'database')-ARRAY['clients','measurements','competitions','checkins','photos','weekPlans','foods','mealPlans','mealPlanItems','trainingPrograms','exercises','recipes','clientMenus'],'preferences',p_snapshot->'preferences'),updated_at=now() WHERE owner_id=u;
 INSERT INTO public.dietforge_mutations(owner_id,mutation_id,revision) VALUES(u,p_mutation_id,rev);
 RETURN rev;
END $$;


-- Canonical public projection doubles as validation; extra private fields never escape.
CREATE FUNCTION public.dietforge_menu_project(v jsonb,k text,o uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE keys text[]; outv jsonb; a jsonb; child jsonb; field text; ids text[]; path text;
BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid menu object'; END IF;
 CASE k
 WHEN 'food' THEN keys:=ARRAY['id','name','category','protein','carbs','fat','fiber','antioxidants','kcal','serving_size','serving_unit','source','barcode','carb_type'];
 WHEN 'ingredient' THEN keys:=ARRAY['id','food','quantity','unit'];
 WHEN 'recipe' THEN keys:=ARRAY['id','name','servings','instructions','photo_path','ingredients','created_at','updated_at'];
 WHEN 'menu' THEN keys:=ARRAY['id','client_id','name','assigned','meals','created_at','updated_at'];
 WHEN 'meal' THEN keys:=ARRAY['id','name','items'];
 WHEN 'item' THEN keys:=ARRAY['id','kind','recipe','portions','ingredient'];
 ELSE RAISE EXCEPTION 'Invalid projection'; END CASE;
 SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) INTO outv FROM jsonb_each(v) WHERE key=ANY(keys);
 IF k IN ('recipe','menu','food') THEN
  IF jsonb_typeof(v->'id') IS DISTINCT FROM 'number' OR (v->>'id') !~ '^[1-9][0-9]{0,14}$' THEN RAISE EXCEPTION 'Invalid numeric ID'; END IF;
 ELSE
  IF jsonb_typeof(v->'id') IS DISTINCT FROM 'string' OR (v->>'id') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN RAISE EXCEPTION 'Invalid UUID'; END IF;
 END IF;
 IF k IN ('recipe','menu','meal','food') AND (jsonb_typeof(v->'name') IS DISTINCT FROM 'string' OR length(btrim(v->>'name')) NOT BETWEEN 1 AND 200) THEN RAISE EXCEPTION 'Invalid name'; END IF;
 IF k='food' THEN
  FOREACH field IN ARRAY ARRAY['protein','carbs','fat','fiber','antioxidants','kcal','serving_size'] LOOP
   IF jsonb_typeof(v->field) IS DISTINCT FROM 'number' OR (v->>field)::numeric<0 OR (v->>field)::numeric>100000 THEN RAISE EXCEPTION 'Invalid nutrient'; END IF;
  END LOOP;
  IF jsonb_typeof(v->'category') IS DISTINCT FROM 'string' OR v->>'category' NOT IN ('protein','carbs','vegetables','fruits','fats','dairy','grains','legumes','nuts','beverages','supplements','other') OR jsonb_typeof(v->'source') IS DISTINCT FROM 'string' OR v->>'source' NOT IN ('api','manual') OR jsonb_typeof(v->'serving_unit') IS DISTINCT FROM 'string' OR length(btrim(v->>'serving_unit')) NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Invalid food metadata'; END IF;
  IF v ? 'barcode' AND jsonb_typeof(v->'barcode') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid barcode'; END IF;
  IF v ? 'carb_type' AND (jsonb_typeof(v->'carb_type') IS DISTINCT FROM 'string' OR v->>'carb_type' NOT IN ('fast','slow','mixed')) THEN RAISE EXCEPTION 'Invalid carb type'; END IF;
  IF (v->>'serving_size')::numeric<=0 THEN RAISE EXCEPTION 'Invalid serving size'; END IF;
 END IF;
 IF k='ingredient' THEN
  IF jsonb_typeof(v->'quantity') IS DISTINCT FROM 'number' OR (v->>'quantity')::numeric<=0 OR (v->>'quantity')::numeric>100000 OR v->>'unit' NOT IN ('g','ml','lb','pieza') OR NOT(v?'unit') THEN RAISE EXCEPTION 'Invalid ingredient amount'; END IF;
  outv:=jsonb_set(outv,'{food}',public.dietforge_menu_project(v->'food','food',o));
 END IF;
 IF k IN ('recipe','menu') THEN
  FOREACH field IN ARRAY ARRAY['created_at','updated_at'] LOOP
   IF jsonb_typeof(v->field) IS DISTINCT FROM 'string' OR length(v->>field)>40 OR NOT isfinite((v->>field)::timestamptz) THEN RAISE EXCEPTION 'Invalid timestamp'; END IF;
  END LOOP;
 END IF;
 IF k='recipe' THEN
  IF jsonb_typeof(v->'servings') IS DISTINCT FROM 'number' OR (v->>'servings')::numeric<=0 OR (v->>'servings')::numeric>10000 OR jsonb_typeof(v->'instructions') IS DISTINCT FROM 'string' OR length(v->>'instructions')>10000 THEN RAISE EXCEPTION 'Invalid recipe'; END IF;
  IF v ? 'photo_path' AND jsonb_typeof(v->'photo_path') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid photo path'; END IF;
  path:=v->>'photo_path';
  IF path IS NOT NULL AND (path !~ ('^'||o::text||'/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|jpeg|png|webp)$') OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='recipe-photos' AND name=path)) THEN RAISE EXCEPTION 'Invalid recipe photo'; END IF;
 END IF;
 IF k='menu' THEN
  IF jsonb_typeof(v->'assigned') IS DISTINCT FROM 'boolean' OR jsonb_typeof(v->'client_id') IS DISTINCT FROM 'number' OR (v->>'client_id') !~ '^[1-9][0-9]{0,14}$' OR NOT EXISTS(SELECT 1 FROM public.dietforge_records WHERE owner_id=o AND collection='clients' AND id=(v->>'client_id')::bigint) THEN RAISE EXCEPTION 'Invalid menu client'; END IF;
 END IF;
 IF k='item' THEN
  IF v->>'kind'='recipe' THEN
   IF jsonb_typeof(v->'portions') IS DISTINCT FROM 'number' OR (v->>'portions')::numeric<=0 OR (v->>'portions')::numeric>10000 THEN RAISE EXCEPTION 'Invalid portions'; END IF;
   outv:=(outv-'ingredient')||jsonb_build_object('recipe',public.dietforge_menu_project(v->'recipe','recipe',o));
  ELSIF v->>'kind'='food' THEN outv:=(outv-ARRAY['recipe','portions'])||jsonb_build_object('ingredient',public.dietforge_menu_project(v->'ingredient','ingredient',o));
  ELSE RAISE EXCEPTION 'Invalid item kind'; END IF;
 END IF;
 IF k IN ('recipe','menu','meal') THEN
  field:=CASE k WHEN 'recipe' THEN 'ingredients' WHEN 'menu' THEN 'meals' ELSE 'items' END;
  IF jsonb_typeof(v->field) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid children'; END IF;
  IF k='recipe' AND jsonb_array_length(v->field)=0 THEN RAISE EXCEPTION 'Recipe needs ingredients'; END IF;
  IF k='menu' AND v->'assigned'='true'::jsonb AND (jsonb_array_length(v->field)=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(v->field) meal WHERE jsonb_typeof(meal->'items') IS DISTINCT FROM 'array' OR meal->'items'='[]'::jsonb)) THEN RAISE EXCEPTION 'Assigned menu needs nonempty meals'; END IF;
  a:='[]'::jsonb;ids:=ARRAY[]::text[];
  FOR child IN SELECT value FROM jsonb_array_elements(v->field) LOOP
   IF child->>'id'=ANY(ids) THEN RAISE EXCEPTION 'Duplicate child ID'; END IF;
   ids:=array_append(ids,child->>'id');
   a:=a||jsonb_build_array(public.dietforge_menu_project(child,CASE k WHEN 'recipe' THEN 'ingredient' WHEN 'menu' THEN 'meal' ELSE 'item' END,o));
  END LOOP;
  outv:=jsonb_set(outv,ARRAY[field],a);
 END IF;
 RETURN outv;
END $$;
REVOKE ALL ON FUNCTION public.dietforge_menu_project(jsonb,text,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.dietforge_validate_menu_record() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 NEW.data:=public.dietforge_menu_project(NEW.data,CASE NEW.collection WHEN 'recipes' THEN 'recipe' ELSE 'menu' END,NEW.owner_id);
 IF (NEW.data->>'id')::bigint<>NEW.id THEN RAISE EXCEPTION 'Record ID mismatch'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.dietforge_validate_menu_record() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validate_menu_record BEFORE INSERT OR UPDATE ON public.dietforge_records FOR EACH ROW WHEN(NEW.collection IN ('recipes','clientMenus')) EXECUTE FUNCTION public.dietforge_validate_menu_record();
-- Fail atomically on malformed or conflicting legacy metadata; never silently discard it.
DO $$DECLARE w record;k text;r jsonb; BEGIN
 FOR w IN SELECT owner_id,metadata FROM public.dietforge_workspaces LOOP
  FOREACH k IN ARRAY ARRAY['recipes','clientMenus'] LOOP
   IF w.metadata->'database' ? k THEN
    IF jsonb_typeof(w.metadata->'database'->k) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid legacy menu array'; END IF;
    FOR r IN SELECT value FROM jsonb_array_elements(w.metadata->'database'->k) LOOP
     INSERT INTO public.dietforge_records(owner_id,collection,id,data) VALUES(w.owner_id,k,(r->>'id')::bigint,r);
    END LOOP;
   END IF;
  END LOOP;
  UPDATE public.dietforge_workspaces SET metadata=jsonb_set(metadata,'{database}',coalesce(metadata->'database','{}'::jsonb)-ARRAY['recipes','clientMenus']) WHERE owner_id=w.owner_id;
 END LOOP;
END $$;
CREATE TABLE public.dietforge_menu_days (
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 client_id bigint NOT NULL,date date NOT NULL,menu_id bigint NOT NULL,completed_meals text[] NOT NULL DEFAULT '{}',
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(owner_id,client_id,date)
);
CREATE TABLE public.dietforge_retired_menu_days (
 archive_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 client_id bigint NOT NULL,date date NOT NULL,menu_id bigint NOT NULL,completed_meals text[] NOT NULL,retired_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dietforge_menu_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dietforge_retired_menu_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dietforge_menu_days,public.dietforge_retired_menu_days FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.dietforge_retire_client(uuid,bigint) RENAME TO dietforge_retire_client_before_menus;
CREATE FUNCTION public.dietforge_retire_client(o uuid,c bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.dietforge_retire_client_before_menus(o,c);
 INSERT INTO public.dietforge_retired_menu_days(owner_id,client_id,date,menu_id,completed_meals) SELECT owner_id,client_id,date,menu_id,completed_meals FROM public.dietforge_menu_days WHERE owner_id=o AND client_id=c;
 DELETE FROM public.dietforge_menu_days WHERE owner_id=o AND client_id=c;
 DELETE FROM public.dietforge_records WHERE owner_id=o AND collection='clientMenus' AND (data->>'client_id')::bigint=c;
END $$;
REVOKE ALL ON FUNCTION public.dietforge_retire_client(uuid,bigint),public.dietforge_retire_client_before_menus(uuid,bigint) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.dietforge_menus_read(o uuid,c bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE menus jsonb;days jsonb;
BEGIN
 IF NOT public.dietforge_client_allowed(o,c) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(public.dietforge_menu_project(data,'menu',o) ORDER BY id),'[]'::jsonb) INTO menus FROM public.dietforge_records WHERE owner_id=o AND collection='clientMenus' AND (data->>'client_id')::bigint=c AND data->'assigned'='true'::jsonb;
 SELECT coalesce(jsonb_agg(jsonb_build_object('date',d.date,'menu_id',d.menu_id,'completed_meals',d.completed_meals) ORDER BY d.date),'[]'::jsonb) INTO days FROM public.dietforge_menu_days d WHERE owner_id=o AND client_id=c AND EXISTS(SELECT 1 FROM jsonb_array_elements(menus) m WHERE (m->>'id')::bigint=d.menu_id);
 RETURN jsonb_build_object('menus',menus,'days',days);
END $$;
CREATE FUNCTION public.dietforge_menu_day_save(o uuid,c bigint,d date,m bigint,completed text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE menu jsonb;oldmenu bigint;
BEGIN
 PERFORM 1 FROM public.dietforge_workspaces WHERE owner_id=o FOR UPDATE;
 IF NOT public.dietforge_client_allowed(o,c) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF d IS NULL OR NOT isfinite(d) OR completed IS NULL THEN RAISE EXCEPTION 'Invalid day'; END IF;
 SELECT data INTO menu FROM public.dietforge_records WHERE owner_id=o AND collection='clientMenus' AND id=m AND (data->>'client_id')::bigint=c AND data->'assigned'='true'::jsonb;
 IF menu IS NULL THEN RAISE EXCEPTION 'Assigned menu required' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(completed) id WHERE id IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(menu->'meals') meal WHERE meal->>'id'=id)) OR cardinality(completed)<>(SELECT count(DISTINCT id) FROM unnest(completed) id) THEN RAISE EXCEPTION 'Invalid completed meals'; END IF;
 SELECT menu_id INTO oldmenu FROM public.dietforge_menu_days WHERE owner_id=o AND client_id=c AND date=d;
 IF oldmenu IS NOT NULL AND oldmenu<>m AND cardinality(completed)>0 THEN RAISE EXCEPTION 'Changing menu requires empty completion'; END IF;
 IF oldmenu IS NOT NULL AND oldmenu<>m THEN
  INSERT INTO public.dietforge_retired_menu_days(owner_id,client_id,date,menu_id,completed_meals)
   SELECT owner_id,client_id,date,menu_id,completed_meals FROM public.dietforge_menu_days WHERE owner_id=o AND client_id=c AND date=d;
 END IF;
 INSERT INTO public.dietforge_menu_days(owner_id,client_id,date,menu_id,completed_meals) VALUES(o,c,d,m,completed) ON CONFLICT(owner_id,client_id,date) DO UPDATE SET menu_id=EXCLUDED.menu_id,completed_meals=EXCLUDED.completed_meals,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.dietforge_menus_read(uuid,bigint),public.dietforge_menu_day_save(uuid,bigint,date,bigint,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dietforge_menus_read(uuid,bigint),public.dietforge_menu_day_save(uuid,bigint,date,bigint,text[]) TO authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('recipe-photos','recipe-photos',false,5242880,ARRAY['image/jpeg','image/png','image/webp']);
CREATE FUNCTION public.dietforge_recipe_photo_allowed(path text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE o uuid;
BEGIN
 IF path !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|jpeg|png|webp)$' THEN RETURN false; END IF;
 o:=split_part(path,'/',1)::uuid;
 IF auth.uid()=o AND public.dietforge_has_access() THEN RETURN true; END IF;
 RETURN EXISTS(SELECT 1 FROM public.dietforge_records r CROSS JOIN LATERAL jsonb_array_elements(r.data->'meals') meal CROSS JOIN LATERAL jsonb_array_elements(meal->'items') item WHERE r.owner_id=o AND r.collection='clientMenus' AND r.data->'assigned'='true'::jsonb AND public.dietforge_client_allowed(o,(r.data->>'client_id')::bigint) AND item->>'kind'='recipe' AND item->'recipe'->>'photo_path'=path);
END $$;
REVOKE ALL ON FUNCTION public.dietforge_recipe_photo_allowed(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dietforge_recipe_photo_allowed(text) TO authenticated;
CREATE POLICY recipe_photo_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='recipe-photos' AND public.dietforge_recipe_photo_allowed(name));
CREATE POLICY recipe_photo_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='recipe-photos' AND split_part(name,'/',1)=auth.uid()::text AND public.dietforge_has_access() AND name ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|jpeg|png|webp)$');
-- No UPDATE/DELETE policy: immutable images preserve inserted recipe copies.
REVOKE ALL ON FUNCTION public._dietforge_load_storage(),public._dietforge_save_storage_before_diet_notices(jsonb,bigint,uuid) FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
