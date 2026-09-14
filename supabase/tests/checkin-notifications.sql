BEGIN;
-- All fixtures and schema changes in this verification are rolled back.
CREATE FUNCTION pg_temp.assert_ok(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; END$$;
CREATE FUNCTION pg_temp.reject_sql(statement text,label text) RETURNS void LANGUAGE plpgsql AS $$DECLARE rejected boolean:=false;BEGIN BEGIN EXECUTE statement;EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'FAIL accepted: %',label;END IF;END$$;
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
('11111111-1111-4111-8111-111111111111','df-test-coach-a@example.invalid',now()),
('22222222-2222-4222-8222-222222222222','df-test-coach-b@example.invalid',now()),
('33333333-3333-4333-8333-333333333333','df-test-client-a@example.invalid',now()),
('44444444-4444-4444-8444-444444444444','df-test-client-b@example.invalid',now());
INSERT INTO public.dietforge_access(email,expires_at) VALUES('df-test-coach-a@example.invalid',now()+interval '1 day'),('df-test-coach-b@example.invalid',now()+interval '1 day');
INSERT INTO public.dietforge_workspaces(owner_id) VALUES('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
INSERT INTO public.dietforge_records(owner_id,collection,id,data) VALUES
('11111111-1111-4111-8111-111111111111','clients',1,'{"id":1,"name":"Test A"}'),
('11111111-1111-4111-8111-111111111111','clients',2,'{"id":2,"name":"Other A"}'),
('22222222-2222-4222-8222-222222222222','clients',1,'{"id":1,"name":"Test B"}');
INSERT INTO public.dietforge_client_portals VALUES
('11111111-1111-4111-8111-111111111111',1,'df-test-client-a@example.invalid',true),
('22222222-2222-4222-8222-222222222222',1,'df-test-client-b@example.invalid',true);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
SELECT pg_temp.assert_ok(public.dietforge_client_allowed('11111111-1111-4111-8111-111111111111',1),'client own access');
SELECT pg_temp.assert_ok(NOT public.dietforge_client_allowed('22222222-2222-4222-8222-222222222222',1),'client other coach denied');
SELECT pg_temp.assert_ok(NOT public.dietforge_client_allowed('11111111-1111-4111-8111-111111111111',2),'client other client denied');
SELECT pg_temp.reject_sql($s$SELECT public.dietforge_portal_read('22222222-2222-4222-8222-222222222222',1)$s$,'cross portal');
SELECT pg_temp.reject_sql($s$SELECT public.dietforge_activity_save('22222222-2222-4222-8222-222222222222',1,'55555555-5555-4555-8555-555555555555','checkin','{"date":"2026-09-14","weight":72}')$s$,'cross write');
SELECT public.dietforge_activity_save('11111111-1111-4111-8111-111111111111',1,'55555555-5555-4555-8555-555555555555','checkin','{"date":"2026-09-14","weight":72,"measurements":{"waist":80},"adherence":{"meals":0,"sleep":5},"notes":"Test","photos":[]}');
SELECT public.dietforge_activity_save('11111111-1111-4111-8111-111111111111',1,'55555555-5555-4555-8555-555555555555','checkin','{"date":"2026-09-14","weight":72,"notes":"retry"}');
DO $$DECLARE patch jsonb; BEGIN
 FOR patch IN SELECT value FROM jsonb_array_elements('[{"body_fat":12},{"weight":19},{"weight":501},{"weight":"72"},{"date":"2026-02-30"},{"adherence":{"sleep":1.5}},{"adherence":{"meals":101}},{"adherence":{"evil":1}},{"measurements":{"waist":0}},{"measurements":{"waist":301}},{"photos":[{"angle":"front_relaxed","path":"22222222-2222-4222-8222-222222222222/1/55555555-5555-4555-8555-555555555555.jpg"}]},{"photos":[{"angle":"front_relaxed","path":"11111111-1111-4111-8111-111111111111/1/55555555-5555-4555-8555-555555555555.jpg"}]},{"owner_id":"fake"}]') LOOP
 PERFORM pg_temp.reject_sql(format('SELECT public.dietforge_activity_save(%L,1,%L,%L,%L::jsonb)','11111111-1111-4111-8111-111111111111','66666666-6666-4666-8666-666666666666','checkin','{"date":"2026-09-14","weight":72}'::jsonb||patch),'invalid checkin '||patch::text);
 END LOOP;
END$$;
SELECT pg_temp.assert_ok(public.dietforge_checkin_photo_allowed('11111111-1111-4111-8111-111111111111/1/55555555-5555-4555-8555-555555555555.jpg'),'own photo path');
SELECT pg_temp.assert_ok(NOT public.dietforge_checkin_photo_allowed('11111111-1111-4111-8111-111111111111/2/55555555-5555-4555-8555-555555555555.jpg'),'other client photo');
SELECT pg_temp.reject_sql('SELECT public.dietforge_notifications_read()','client inbox forbidden');
SELECT pg_temp.reject_sql('SELECT * FROM public.dietforge_notifications','direct table forbidden');
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT pg_temp.assert_ok((public.dietforge_notifications_read()->>'unread')::int=1,'exactly one notice despite retry');
SELECT pg_temp.assert_ok((SELECT count(*) FROM public.dietforge_records)=2,'RLS coach only own records');
SELECT pg_temp.reject_sql($s$SELECT public.dietforge_portal_read('22222222-2222-4222-8222-222222222222',1)$s$,'coach cross access');
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
SELECT pg_temp.assert_ok((public.dietforge_notifications_read()->>'unread')::int=0,'coach B no A alerts');
SELECT public.dietforge_notification_seen(1,'55555555-5555-4555-8555-555555555555');
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT pg_temp.assert_ok((public.dietforge_notifications_read()->>'unread')::int=1,'B cannot mark A read');
SELECT public.dietforge_notification_seen(1,'55555555-5555-4555-8555-555555555555');
SELECT pg_temp.assert_ok((public.dietforge_notifications_read()->>'unread')::int=0,'owner can mark read');
RESET ROLE;
SELECT pg_temp.assert_ok((SELECT count(*)=1 FROM public.dietforge_client_activity WHERE owner_id='11111111-1111-4111-8111-111111111111'),'one checkin despite retry');
SELECT 'PASS: isolation, RPC validation, idempotence, private photos, notification ownership' AS result;
ROLLBACK;
