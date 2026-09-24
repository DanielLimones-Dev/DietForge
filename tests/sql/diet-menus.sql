-- Run after migrations as postgres on an isolated database. All fixtures roll back.
BEGIN;
CREATE FUNCTION pg_temp.assert_ok(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; END $$;
CREATE FUNCTION pg_temp.reject_sql(s text,label text) RETURNS void LANGUAGE plpgsql AS $$DECLARE failed boolean:=false;BEGIN BEGIN EXECUTE s;EXCEPTION WHEN OTHERS THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'FAIL accepted: %',label;END IF;END$$;
CREATE FUNCTION pg_temp.actor(u text) RETURNS void LANGUAGE plpgsql AS $$BEGIN PERFORM set_config('request.jwt.claim.sub',u,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);END$$;
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
('a1111111-1111-4111-8111-111111111111','menus-coach-a@example.invalid',now()),
('b2222222-2222-4222-8222-222222222222','menus-coach-b@example.invalid',now()),
('c3333333-3333-4333-8333-333333333333','menus-client-a@example.invalid',now()),
('d4444444-4444-4444-8444-444444444444','menus-client-b@example.invalid',now());
INSERT INTO public.dietforge_access(email,expires_at) VALUES('menus-coach-a@example.invalid',now()+interval '1 day'),('menus-coach-b@example.invalid',now()+interval '1 day');
INSERT INTO public.dietforge_workspaces(owner_id) VALUES('a1111111-1111-4111-8111-111111111111'),('b2222222-2222-4222-8222-222222222222');
INSERT INTO public.dietforge_records(owner_id,collection,id,data) VALUES
('a1111111-1111-4111-8111-111111111111','clients',1,'{"id":1,"name":"A"}'),('a1111111-1111-4111-8111-111111111111','clients',2,'{"id":2,"name":"Other"}'),('b2222222-2222-4222-8222-222222222222','clients',1,'{"id":1,"name":"B"}');
INSERT INTO public.dietforge_client_portals VALUES('a1111111-1111-4111-8111-111111111111',1,'menus-client-a@example.invalid',true),('b2222222-2222-4222-8222-222222222222',1,'menus-client-b@example.invalid',true);
INSERT INTO storage.objects(bucket_id,name) VALUES('recipe-photos','a1111111-1111-4111-8111-111111111111/11111111-1111-4111-8111-111111111111.jpg'),('recipe-photos','a1111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg');
SELECT pg_temp.actor('a1111111-1111-4111-8111-111111111111');
SET LOCAL ROLE authenticated;
DO $$DECLARE s jsonb;recipe jsonb;menu jsonb;rev bigint;b bigint;BEGIN
 s:=public.dietforge_load()->'snapshot';
 recipe:='{"id":1,"name":"Recipe","servings":2,"instructions":"Mix","created_at":"2026-09-24T12:00:00Z","updated_at":"2026-09-24T12:00:00Z","photo_path":"a1111111-1111-4111-8111-111111111111/11111111-1111-4111-8111-111111111111.jpg","ingredients":[{"id":"11111111-1111-4111-8111-111111111111","quantity":100,"unit":"g","food":{"id":1,"name":"Rice","category":"grains","source":"manual","fiber":0,"antioxidants":0,"barcode":"fixture-barcode","carb_type":"slow","kcal":100,"protein":2,"carbs":20,"fat":1,"serving_size":100,"serving_unit":"g"}}]}'::jsonb;
 menu:=jsonb_build_object('id',1,'client_id',1,'name','Menu','created_at','2026-09-24T12:00:00Z','updated_at','2026-09-24T12:00:00Z','assigned',true,'secret','never project','meals',jsonb_build_array(jsonb_build_object('id','11111111-1111-4111-8111-111111111111','name','Breakfast','items',jsonb_build_array(jsonb_build_object('id','22222222-2222-4222-8222-222222222222','kind','recipe','recipe',recipe,'portions',1)))));
 s:=jsonb_set(s,'{database,recipes}',jsonb_build_array(recipe));s:=jsonb_set(s,'{database,clientMenus}',jsonb_build_array(menu,menu||'{"id":2,"assigned":false}',menu||'{"id":3}'));
 rev:=public.dietforge_save(s,0,gen_random_uuid());
 PERFORM pg_temp.assert_ok(rev=1,'save revision');
 PERFORM pg_temp.assert_ok(public.dietforge_load()->'snapshot'->'database'->'recipes'->0->'ingredients'->0->'food'->>'barcode'='fixture-barcode','food optional fields preserved');
 PERFORM pg_temp.assert_ok(jsonb_array_length(public.dietforge_load()->'snapshot'->'database'->'recipes')=1,'recipe round trip');
 PERFORM pg_temp.reject_sql(format('SELECT public.dietforge_save(%L::jsonb,1,gen_random_uuid())',jsonb_set(s,'{database,recipes,0,photo_path}','"b2222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111.jpg"'::jsonb)),'foreign recipe photo');
 PERFORM pg_temp.reject_sql(format('SELECT public.dietforge_save(%L::jsonb,1,gen_random_uuid())',jsonb_set(s,'{database,clientMenus,0,client_id}','999'::jsonb)),'nonexistent client');
 PERFORM pg_temp.reject_sql(format('SELECT public.dietforge_save(%L::jsonb,1,gen_random_uuid())',jsonb_set(s,'{database,clientMenus,0,meals}','[]'::jsonb)),'empty assigned menu');
 s:=public.dietforge_load()->'snapshot';
 s:=jsonb_set(s,'{database}',(s->'database')-ARRAY['recipes','clientMenus']);
 PERFORM public.dietforge_save(s,1,gen_random_uuid());
 PERFORM pg_temp.assert_ok(jsonb_array_length(public.dietforge_load()->'snapshot'->'database'->'recipes')=1,'legacy save retains recipes');
 PERFORM pg_temp.assert_ok(jsonb_array_length(public.dietforge_load()->'snapshot'->'database'->'clientMenus')=3,'legacy save retains menus');
 b:=public.dietforge_capture_backup();PERFORM pg_temp.assert_ok(jsonb_array_length(public.dietforge_backup_get(b)->'snapshot'->'database'->'clientMenus')=3,'backup menus');
 PERFORM pg_temp.assert_ok(NOT has_table_privilege('authenticated','public.dietforge_menu_days','SELECT'),'days private');
 PERFORM pg_temp.assert_ok(NOT has_function_privilege('authenticated','public.dietforge_menu_project(jsonb,text,uuid)','EXECUTE'),'projection private');
END$$;
RESET ROLE;
SELECT pg_temp.actor('c3333333-3333-4333-8333-333333333333');
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_ok(jsonb_array_length(public.dietforge_menus_read('a1111111-1111-4111-8111-111111111111',1)->'menus')=2,'draft excluded');
SELECT pg_temp.assert_ok(NOT ((public.dietforge_menus_read('a1111111-1111-4111-8111-111111111111',1)->'menus'->0)?'secret'),'projection whitelist');
SELECT pg_temp.assert_ok(public.dietforge_recipe_photo_allowed('a1111111-1111-4111-8111-111111111111/11111111-1111-4111-8111-111111111111.jpg'),'assigned photo');
SELECT pg_temp.assert_ok(NOT public.dietforge_recipe_photo_allowed('a1111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg'),'private library photo');
SELECT pg_temp.assert_ok((SELECT count(*)=1 FROM storage.objects WHERE bucket_id='recipe-photos'),'storage RLS');
SELECT pg_temp.reject_sql($s$SELECT public.dietforge_menus_read('b2222222-2222-4222-8222-222222222222',1)$s$,'other coach');
SELECT pg_temp.reject_sql($s$SELECT public.dietforge_menus_read('a1111111-1111-4111-8111-111111111111',2)$s$,'other client');
SELECT public.dietforge_menu_day_save('a1111111-1111-4111-8111-111111111111',1,'2026-09-24',1,ARRAY['11111111-1111-4111-8111-111111111111']);
SELECT public.dietforge_menu_day_save('a1111111-1111-4111-8111-111111111111',1,'2026-09-24',1,ARRAY['11111111-1111-4111-8111-111111111111']);
SELECT pg_temp.assert_ok(jsonb_array_length(public.dietforge_menus_read('a1111111-1111-4111-8111-111111111111',1)->'days')=1,'idempotent day');
SELECT pg_temp.reject_sql($s$SELECT public.dietforge_menu_day_save('a1111111-1111-4111-8111-111111111111',1,'2026-09-24',2,'{}')$s$,'draft menu');
SELECT pg_temp.reject_sql($s$SELECT public.dietforge_menu_day_save('a1111111-1111-4111-8111-111111111111',1,'2026-09-24',1,ARRAY['33333333-3333-4333-8333-333333333333'])$s$,'foreign meal');
SELECT pg_temp.reject_sql($s$SELECT public.dietforge_menu_day_save('a1111111-1111-4111-8111-111111111111',1,'2026-09-24',3,ARRAY['11111111-1111-4111-8111-111111111111'])$s$,'switch cannot inherit completion');
SELECT public.dietforge_menu_day_save('a1111111-1111-4111-8111-111111111111',1,'2026-09-24',3,'{}');
RESET ROLE;
SELECT pg_temp.assert_ok(EXISTS(SELECT 1 FROM public.dietforge_retired_menu_days WHERE owner_id='a1111111-1111-4111-8111-111111111111' AND menu_id=1 AND completed_meals=ARRAY['11111111-1111-4111-8111-111111111111']),'menu switch archives previous completion');
UPDATE public.dietforge_client_portals SET enabled=false WHERE owner_id='a1111111-1111-4111-8111-111111111111';
SET LOCAL ROLE authenticated;
SELECT pg_temp.reject_sql($s$SELECT public.dietforge_menus_read('a1111111-1111-4111-8111-111111111111',1)$s$,'revoked read');
SELECT pg_temp.assert_ok(NOT public.dietforge_recipe_photo_allowed('a1111111-1111-4111-8111-111111111111/11111111-1111-4111-8111-111111111111.jpg'),'revoked photo');
RESET ROLE;
DELETE FROM public.dietforge_records WHERE owner_id='a1111111-1111-4111-8111-111111111111' AND collection='clients' AND id=1;
SELECT pg_temp.assert_ok(NOT EXISTS(SELECT 1 FROM public.dietforge_menu_days WHERE owner_id='a1111111-1111-4111-8111-111111111111'),'retire days');
SELECT pg_temp.assert_ok(EXISTS(SELECT 1 FROM public.dietforge_retired_menu_days WHERE owner_id='a1111111-1111-4111-8111-111111111111'),'archive days');
SELECT pg_temp.assert_ok(NOT EXISTS(SELECT 1 FROM public.dietforge_records WHERE owner_id='a1111111-1111-4111-8111-111111111111' AND collection='clientMenus'),'retire menus');
-- Old snapshots without the optional collections remain accepted.
SELECT pg_temp.actor('b2222222-2222-4222-8222-222222222222');
SET LOCAL ROLE authenticated;
DO $$DECLARE s jsonb;BEGIN s:=public.dietforge_load()->'snapshot';s:=jsonb_set(s,'{database}',(s->'database')-ARRAY['recipes','clientMenus']);PERFORM public.dietforge_save(s,0,gen_random_uuid());PERFORM pg_temp.assert_ok(public.dietforge_load()->'snapshot'->'database'->'recipes'='[]'::jsonb,'legacy optional collections');END$$;
ROLLBACK;
