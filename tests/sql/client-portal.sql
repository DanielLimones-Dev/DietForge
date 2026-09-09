-- All identities and records are synthetic; every mutation rolls back.
BEGIN;
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('10000000-0000-4000-8000-000000000001','coach-a@dietforge.invalid',now()),
 ('10000000-0000-4000-8000-000000000002','coach-b@dietforge.invalid',now()),
 ('10000000-0000-4000-8000-000000000003','client@dietforge.invalid',now()),
 ('10000000-0000-4000-8000-000000000004','stranger@dietforge.invalid',now());
INSERT INTO public.dietforge_access(email,expires_at) VALUES('coach-a@dietforge.invalid',now()+interval '1 month'),('coach-b@dietforge.invalid',now()+interval '1 month');
INSERT INTO public.dietforge_workspaces(owner_id) VALUES('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
INSERT INTO public.dietforge_records(owner_id,collection,id,data) VALUES
 ('10000000-0000-4000-8000-000000000001','clients',1,'{"id":1,"name":"A","notes":"private coach notes"}'),
 ('10000000-0000-4000-8000-000000000001','clients',2,'{"id":2,"name":"Other client"}'),
 ('10000000-0000-4000-8000-000000000002','clients',1,'{"id":1,"name":"B"}');
INSERT INTO public.dietforge_records(owner_id,collection,id,data) VALUES
('10000000-0000-4000-8000-000000000001','trainingPrograms',1,'{"id":1,"client_id":1,"status":"active","duration_weeks":5,"days":[{"id":"day","exercises":[{"id":"press","name":"Press","library_id":"press","prescriptions":[{"week":1,"sets":1,"reps_min":8,"reps_max":12,"rir_start":2,"rir_end":1}]}]}]}');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT public.dietforge_portal_grant(1,'client@dietforge.invalid',true);
DO $$ DECLARE s jsonb; rev bigint; b bigint; failed boolean:=false; BEGIN
 s:=public.dietforge_load(); ASSERT jsonb_array_length(s->'snapshot'->'database'->'clients')=2;
 b:=public.dietforge_capture_backup();
 rev:=public.dietforge_save(jsonb_set(s->'snapshot','{database,clients,0,name}','"Edited"'),0,'20000000-0000-4000-8000-000000000001');ASSERT rev=1;
 BEGIN PERFORM public.dietforge_save(s->'snapshot',0,gen_random_uuid());EXCEPTION WHEN serialization_failure THEN failed:=true;END;ASSERT failed;
 rev:=public.dietforge_backup_restore(b,1,'20000000-0000-4000-8000-000000000002');ASSERT rev=2;
 ASSERT public.dietforge_load()->'snapshot'->'database'->'clients'->0->>'name'='A';
 ASSERT NOT has_table_privilege('authenticated','public.dietforge_client_activity','SELECT');
 ASSERT NOT has_function_privilege('authenticated','public._dietforge_save_storage(jsonb,bigint,uuid)','EXECUTE');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE failed boolean:=false;BEGIN
 ASSERT jsonb_array_length(public.dietforge_load()->'snapshot'->'database'->'clients')=1;
 ASSERT public.dietforge_load()->'snapshot'->'database'->'clients'->0->>'name'='B';
 BEGIN PERFORM public.dietforge_portal_read('10000000-0000-4000-8000-000000000001',1);EXCEPTION WHEN insufficient_privilege THEN failed:=true;END;ASSERT failed;
 ASSERT jsonb_array_length(public.dietforge_backup_list())=0;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE s jsonb;failed boolean:=false;BEGIN
 s:=public.dietforge_portal_read('10000000-0000-4000-8000-000000000001',1);ASSERT s->'client'->>'name'='A';ASSERT NOT(s->'client' ? 'notes');
 PERFORM public.dietforge_activity_save('10000000-0000-4000-8000-000000000001',1,'30000000-0000-4000-8000-000000000001','checkin','{"date":"2026-09-08","weight":75}');
 ASSERT jsonb_array_length(public.dietforge_portal_read('10000000-0000-4000-8000-000000000001',1)->'activity')=1;
 BEGIN PERFORM public.dietforge_portal_read('10000000-0000-4000-8000-000000000001',2);EXCEPTION WHEN insufficient_privilege THEN failed:=true;END;ASSERT failed;
 failed:=false;BEGIN PERFORM public.dietforge_load();EXCEPTION WHEN insufficient_privilege THEN failed:=true;END;ASSERT failed;
 failed:=false;BEGIN PERFORM public.dietforge_activity_save('10000000-0000-4000-8000-000000000001',1,gen_random_uuid(),'event','{"date":"2026-09-08","title":"tamper"}');EXCEPTION WHEN insufficient_privilege THEN failed:=true;END;ASSERT failed;
 failed:=false;BEGIN PERFORM public.dietforge_activity_save('10000000-0000-4000-8000-000000000001',1,gen_random_uuid(),'checkin','{"date":"2026-09-08","weight":-10}');EXCEPTION WHEN OTHERS THEN failed:=true;END;ASSERT failed;
END $$;
DO $$ DECLARE d jsonb:='{"date":"2026-09-08","program_id":1,"day_id":"day","week":1,"fatigue":5,"completed":true,"exercises":[{"exercise_id":"press","name":"Fake","target":{"reps_max":1},"sets":[{"kg":40,"reps":12,"rir":2,"completed":true}]}]}'; failed boolean:=false; result jsonb; BEGIN
 PERFORM public.dietforge_activity_save('10000000-0000-4000-8000-000000000001',1,'30000000-0000-4000-8000-000000000002','session',d);
 SELECT value->'data' INTO result FROM jsonb_array_elements(public.dietforge_portal_read('10000000-0000-4000-8000-000000000001',1)->'activity') WHERE value->>'kind'='session';
 ASSERT result->'exercises'->0->>'name'='Press';
 ASSERT result->'exercises'->0->'target'->>'reps_max'='12';
 BEGIN PERFORM public.dietforge_activity_save('10000000-0000-4000-8000-000000000001',1,gen_random_uuid(),'session',jsonb_set(d,'{exercises,0,sets,0,completed}','false')); EXCEPTION WHEN OTHERS THEN failed:=true;END;ASSERT failed;
 failed:=false;BEGIN PERFORM public.dietforge_activity_save('10000000-0000-4000-8000-000000000001',1,gen_random_uuid(),'session',jsonb_set(d,'{exercises}','[]')); EXCEPTION WHEN OTHERS THEN failed:=true;END;ASSERT failed;
END $$;
RESET ROLE;
UPDATE public.dietforge_client_portals SET enabled=false WHERE owner_id='10000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ DECLARE failed boolean:=false;BEGIN BEGIN PERFORM public.dietforge_portal_read('10000000-0000-4000-8000-000000000001',1);EXCEPTION WHEN insufficient_privilege THEN failed:=true;END;ASSERT failed;END $$;
RESET ROLE;
UPDATE public.dietforge_access SET expires_at=now()-interval '1 day' WHERE email='coach-a@dietforge.invalid';
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE failed boolean:=false;BEGIN BEGIN PERFORM public.dietforge_load();EXCEPTION WHEN insufficient_privilege THEN failed:=true;END;ASSERT failed;failed:=false;BEGIN PERFORM public.dietforge_save('{}',2,gen_random_uuid());EXCEPTION WHEN insufficient_privilege THEN failed:=true;END;ASSERT failed;END $$;
RESET ROLE;
ROLLBACK;
