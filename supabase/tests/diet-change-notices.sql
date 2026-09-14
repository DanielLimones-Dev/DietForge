-- Apply migrations first, run as postgres. No fixture survives this transaction.
BEGIN;
CREATE FUNCTION pg_temp.assert_ok(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label;END IF;END$$;
CREATE FUNCTION pg_temp.reject_sql(statement text,label text) RETURNS void LANGUAGE plpgsql AS $$DECLARE rejected boolean:=false;BEGIN BEGIN EXECUTE statement;EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'FAIL accepted: %',label;END IF;END$$;
CREATE FUNCTION pg_temp.save_rows(k text,rows jsonb) RETURNS void LANGUAGE plpgsql AS $$DECLARE s jsonb;BEGIN
 s:=public.dietforge_load();PERFORM public.dietforge_save(jsonb_set(s->'snapshot',ARRAY['database',k],rows),(s->>'revision')::bigint,gen_random_uuid());
END$$;
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
('91111111-1111-4111-8111-111111111111','diet-notice-coach-a@example.invalid',now()),
('92222222-2222-4222-8222-222222222222','diet-notice-coach-b@example.invalid',now()),
('93333333-3333-4333-8333-333333333333','diet-notice-client-a@example.invalid',now()),
('94444444-4444-4444-8444-444444444444','diet-notice-client-b@example.invalid',now());
INSERT INTO public.dietforge_access(email,expires_at) VALUES('diet-notice-coach-a@example.invalid',now()+interval '1 day'),('diet-notice-coach-b@example.invalid',now()+interval '1 day');
INSERT INTO public.dietforge_workspaces(owner_id) VALUES('91111111-1111-4111-8111-111111111111'),('92222222-2222-4222-8222-222222222222');
INSERT INTO public.dietforge_records(owner_id,collection,id,data) VALUES
('91111111-1111-4111-8111-111111111111','clients',1,'{"id":1,"name":"Diet A"}'),
('91111111-1111-4111-8111-111111111111','clients',2,'{"id":2,"name":"Diet other"}'),
('92222222-2222-4222-8222-222222222222','clients',1,'{"id":1,"name":"Diet B"}');
INSERT INTO public.dietforge_client_portals VALUES
('91111111-1111-4111-8111-111111111111',1,'diet-notice-client-a@example.invalid',true),
('91111111-1111-4111-8111-111111111111',2,'diet-notice-client-b@example.invalid',true),
('92222222-2222-4222-8222-222222222222',1,'diet-notice-client-b@example.invalid',true);
SELECT set_config('request.jwt.claim.sub','91111111-1111-4111-8111-111111111111',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_ok(public.dietforge_diet_notice_read('91111111-1111-4111-8111-111111111111',1)='{"revision":null,"pending":false}'::jsonb,'empty no notice');
SELECT pg_temp.save_rows('mealPlans','[{"id":1,"client_id":1,"name":"Plan A","total_kcal":2000}]');
SELECT pg_temp.assert_ok((public.dietforge_diet_notice_read('91111111-1111-4111-8111-111111111111',1)->>'pending')::boolean,'new plan notifies');
SELECT pg_temp.assert_ok(NOT (public.dietforge_diet_notice_read('91111111-1111-4111-8111-111111111111',2)->>'pending')::boolean,'unrelated client not notified');
SELECT pg_temp.save_rows('foods','[{"id":1,"name":"Rice","kcal":100},{"id":2,"name":"Unused","kcal":20}]');
SELECT pg_temp.save_rows('mealPlanItems','[{"id":1,"meal_plan_id":1,"food_id":1,"quantity":100,"meal_time":"breakfast"}]');
SELECT set_config('test.diet.version',public.dietforge_diet_notice_read('91111111-1111-4111-8111-111111111111',1)->>'revision',true);
SELECT public.dietforge_diet_notice_seen('91111111-1111-4111-8111-111111111111',1,current_setting('test.diet.version')::uuid);
SELECT set_config('request.jwt.claim.sub','93333333-3333-4333-8333-333333333333',true);
SELECT pg_temp.assert_ok((public.dietforge_diet_notice_read('91111111-1111-4111-8111-111111111111',1)->>'pending')::boolean,'coach acknowledgment not client acknowledgment');
SELECT pg_temp.assert_ok(public.dietforge_diet_notice_seen('91111111-1111-4111-8111-111111111111',1,current_setting('test.diet.version')::uuid),'client close current');
SELECT pg_temp.assert_ok(NOT (public.dietforge_diet_notice_read('91111111-1111-4111-8111-111111111111',1)->>'pending')::boolean,'close persists');
SELECT pg_temp.reject_sql($s$SELECT public.dietforge_diet_notice_read('92222222-2222-4222-8222-222222222222',1)$s$,'cross coach denied');
SELECT pg_temp.reject_sql($s$SELECT public.dietforge_diet_notice_read('91111111-1111-4111-8111-111111111111',2)$s$,'cross client denied');
SELECT pg_temp.reject_sql($s$SELECT public.dietforge_diet_notice_seen('91111111-1111-4111-8111-111111111111',2,gen_random_uuid())$s$,'cross seen denied');
SELECT pg_temp.assert_ok(NOT has_table_privilege('authenticated','public.dietforge_diet_notices','SELECT'),'private notice table');
SELECT pg_temp.assert_ok(NOT has_function_privilege('authenticated','public.dietforge_refresh_diet_notices(uuid,boolean)','EXECUTE'),'private refresh');
SELECT set_config('request.jwt.claim.sub','91111111-1111-4111-8111-111111111111',true);
-- No false notice for unreferenced food, row ordering, timestamps or unrelated snapshot data.
SELECT pg_temp.save_rows('foods','[{"id":2,"name":"Unused edited","kcal":30},{"id":1,"name":"Rice","kcal":100,"updated_at":"new timestamp"}]');
SELECT pg_temp.save_rows('mealPlans','[{"id":1,"client_id":1,"name":"Plan A","total_kcal":2000,"updated_at":"new timestamp"}]');
SELECT pg_temp.save_rows('checkins','[{"id":1,"client_id":1,"weight":75,"date":"2026-09-14"}]');
SELECT pg_temp.assert_ok(public.dietforge_diet_notice_read('91111111-1111-4111-8111-111111111111',1)->>'revision'=current_setting('test.diet.version'),'unrelated changes retain revision');
-- Referenced food changes content and stale close cannot acknowledge it.
SELECT pg_temp.save_rows('foods','[{"id":1,"name":"Rice","kcal":110},{"id":2,"name":"Unused edited","kcal":30}]');
SELECT set_config('request.jwt.claim.sub','93333333-3333-4333-8333-333333333333',true);
SELECT pg_temp.assert_ok(NOT public.dietforge_diet_notice_seen('91111111-1111-4111-8111-111111111111',1,current_setting('test.diet.version')::uuid),'stale close rejected');
SELECT pg_temp.assert_ok((public.dietforge_diet_notice_read('91111111-1111-4111-8111-111111111111',1)->>'pending')::boolean,'new revision remains pending');
SELECT set_config('test.diet.version',public.dietforge_diet_notice_read('91111111-1111-4111-8111-111111111111',1)->>'revision',true);
SELECT public.dietforge_diet_notice_seen('91111111-1111-4111-8111-111111111111',1,current_setting('test.diet.version')::uuid);
SELECT set_config('request.jwt.claim.sub','91111111-1111-4111-8111-111111111111',true);
DO $$DECLARE b bigint;s jsonb;BEGIN
 b:=public.dietforge_capture_backup();s:=public.dietforge_load();
 PERFORM public.dietforge_backup_restore(b,(s->>'revision')::bigint,gen_random_uuid());
 PERFORM pg_temp.assert_ok(public.dietforge_diet_notice_read('91111111-1111-4111-8111-111111111111',1)->>'revision'<>current_setting('test.diet.version'),'restore creates fresh version');
 PERFORM public.dietforge_portal_grant(1,'diet-notice-client-a@example.invalid',true);
END$$;
SELECT set_config('request.jwt.claim.sub','93333333-3333-4333-8333-333333333333',true);
SELECT pg_temp.assert_ok((public.dietforge_diet_notice_read('91111111-1111-4111-8111-111111111111',1)->>'pending')::boolean,'restore does not reuse read');
SELECT set_config('request.jwt.claim.sub','91111111-1111-4111-8111-111111111111',true);
SELECT pg_temp.save_rows('clients','[{"id":2,"name":"Diet other"}]');
SELECT pg_temp.save_rows('clients','[{"id":1,"name":"Reused ID"},{"id":2,"name":"Diet other"}]');
SELECT public.dietforge_portal_grant(1,'diet-notice-client-a@example.invalid',true);
SELECT set_config('request.jwt.claim.sub','93333333-3333-4333-8333-333333333333',true);
SELECT pg_temp.assert_ok((public.dietforge_diet_notice_read('91111111-1111-4111-8111-111111111111',1)->>'pending')::boolean,'reused ID has fresh unread version');
RESET ROLE;
SELECT 'PASS: diet effective changes, ownership, reader persistence, stale close, restore and retirement' AS result;
ROLLBACK;
