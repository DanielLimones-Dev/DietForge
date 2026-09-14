-- Run against a migrated test database as postgres. Synthetic fixtures only; always rollback.
BEGIN;
CREATE FUNCTION pg_temp.assert_ok(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; END$$;
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
('81111111-1111-4111-8111-111111111111','retire-coach-a@example.invalid',now()),
('82222222-2222-4222-8222-222222222222','retire-coach-b@example.invalid',now()),
('83333333-3333-4333-8333-333333333333','retire-client@example.invalid',now());
INSERT INTO public.dietforge_access(email,expires_at) VALUES('retire-coach-a@example.invalid',now()+interval '1 day'),('retire-coach-b@example.invalid',now()+interval '1 day');
INSERT INTO public.dietforge_workspaces(owner_id) VALUES('81111111-1111-4111-8111-111111111111'),('82222222-2222-4222-8222-222222222222');
INSERT INTO public.dietforge_records(owner_id,collection,id,data) VALUES
('81111111-1111-4111-8111-111111111111','clients',1,'{"id":1,"name":"Old"}'),
('82222222-2222-4222-8222-222222222222','clients',1,'{"id":1,"name":"Other coach"}');
INSERT INTO public.dietforge_client_portals VALUES('81111111-1111-4111-8111-111111111111',1,'retire-client@example.invalid',true),('82222222-2222-4222-8222-222222222222',1,'retire-client@example.invalid',true);
INSERT INTO storage.objects(bucket_id,name) VALUES('checkin-photos','81111111-1111-4111-8111-111111111111/1/85555555-5555-4555-8555-555555555555.jpg');
SELECT set_config('request.jwt.claim.sub','83333333-3333-4333-8333-333333333333',true);
SET LOCAL ROLE authenticated;
SELECT public.dietforge_activity_save('81111111-1111-4111-8111-111111111111',1,'85555555-5555-4555-8555-555555555555','checkin','{"date":"2026-09-14","weight":70}');
SELECT pg_temp.assert_ok(NOT has_function_privilege('authenticated','public.dietforge_activity_save_unlocked(uuid,bigint,uuid,text,jsonb)','EXECUTE'),'internal save denied');
SELECT pg_temp.assert_ok(NOT has_function_privilege('authenticated','public.dietforge_portal_grant_unlocked(bigint,text,boolean)','EXECUTE'),'internal grant denied');
SELECT pg_temp.assert_ok(NOT has_table_privilege('authenticated','public.dietforge_retired_activity','SELECT'),'archive private');
RESET ROLE;
DELETE FROM public.dietforge_records WHERE owner_id='81111111-1111-4111-8111-111111111111' AND collection='clients' AND id=1;
SELECT pg_temp.assert_ok((SELECT count(*)=1 FROM public.dietforge_retired_activity WHERE owner_id='81111111-1111-4111-8111-111111111111'),'archived exactly once');
SELECT pg_temp.assert_ok(NOT EXISTS(SELECT 1 FROM public.dietforge_notifications WHERE owner_id='81111111-1111-4111-8111-111111111111'),'notifications retired');
SELECT pg_temp.assert_ok(EXISTS(SELECT 1 FROM public.dietforge_client_portals WHERE owner_id='82222222-2222-4222-8222-222222222222'),'other coach untouched');
INSERT INTO public.dietforge_records(owner_id,collection,id,data) VALUES('81111111-1111-4111-8111-111111111111','clients',1,'{"id":1,"name":"New"}');
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_ok(NOT public.dietforge_client_allowed('81111111-1111-4111-8111-111111111111',1),'reused ID not authorized');
SELECT set_config('request.jwt.claim.sub','81111111-1111-4111-8111-111111111111',true);
SELECT public.dietforge_portal_grant(1,'retire-client@example.invalid',true);
SELECT pg_temp.assert_ok(NOT public.dietforge_checkin_photo_allowed('81111111-1111-4111-8111-111111111111/1/85555555-5555-4555-8555-555555555555.jpg'),'tombstone blocks old photo after regrant');
DO $$DECLARE b bigint;rev bigint;s jsonb;rejected boolean:=false; BEGIN
 PERFORM public.dietforge_activity_save('81111111-1111-4111-8111-111111111111',1,'86666666-6666-4666-8666-666666666666','checkin','{"date":"2026-09-14","weight":71}');
 b:=public.dietforge_capture_backup();
 PERFORM public.dietforge_activity_save('81111111-1111-4111-8111-111111111111',1,'87777777-7777-4777-8777-777777777777','checkin','{"date":"2026-09-14","weight":72}');
 BEGIN PERFORM public.dietforge_backup_restore(b,999,'88888888-8888-4888-8888-888888888888');EXCEPTION WHEN OTHERS THEN rejected:=true;END;
 PERFORM pg_temp.assert_ok(rejected,'conflict rejected');
 PERFORM pg_temp.assert_ok(jsonb_array_length(public.dietforge_portal_read('81111111-1111-4111-8111-111111111111',1)->'activity')=2,'conflict leaves live rows');
 rev:=public.dietforge_backup_restore(b,0,'88888888-8888-4888-8888-888888888888');
 PERFORM pg_temp.assert_ok(jsonb_array_length(public.dietforge_portal_read('81111111-1111-4111-8111-111111111111',1)->'activity')=1,'restore does not merge newer activity');
 PERFORM public.dietforge_portal_grant(1,'retire-client@example.invalid',true);
 PERFORM pg_temp.assert_ok(public.dietforge_backup_restore(b,0,'88888888-8888-4888-8888-888888888888')=rev,'restore retry idempotent');
END $$;
SELECT set_config('request.jwt.claim.sub','83333333-3333-4333-8333-333333333333',true);
SELECT pg_temp.assert_ok(public.dietforge_client_allowed('81111111-1111-4111-8111-111111111111',1),'retry preserves newly regranted portal');
RESET ROLE;
SELECT 'PASS: retirement, reuse, ownership, photo tombstones, restore conflict and retry' AS result;
ROLLBACK;
