BEGIN;
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
('30000000-0000-4000-8000-000000000001','week-coach@dietforge.invalid',now()),
('30000000-0000-4000-8000-000000000002','week-client@dietforge.invalid',now());
INSERT INTO public.dietforge_access(email,expires_at) VALUES('week-coach@dietforge.invalid',now()+interval '1 month');
INSERT INTO public.dietforge_workspaces(owner_id) VALUES('30000000-0000-4000-8000-000000000001');
INSERT INTO public.dietforge_records(owner_id,collection,id,data) VALUES
('30000000-0000-4000-8000-000000000001','clients',1,'{"id":1,"name":"Weekly"}'),
('30000000-0000-4000-8000-000000000001','trainingPrograms',1,'{"id":1,"client_id":1,"status":"active","duration_weeks":2,"days":[{"id":"w1-day","exercises":[]}],"week_days":{"1":[{"id":"w1-day","exercises":[]}],"2":[{"id":"w2-day","name":"Semana dos","exercises":[{"id":"w2-ex","name":"Remo","prescriptions":[{"week":2,"sets":1,"reps_min":8,"reps_max":12,"rir_start":2,"rir_end":1}]}]}]}}');
INSERT INTO public.dietforge_client_portals VALUES('30000000-0000-4000-8000-000000000001',1,'week-client@dietforge.invalid',true);
SELECT set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE valid_session jsonb:='{"date":"2026-09-15","program_id":1,"day_id":"w2-day","week":2,"completed":true,"fatigue":5,"notes":"","exercises":[{"exercise_id":"w2-ex","target":{"week":2,"sets":99},"sets":[{"kg":40,"reps":10,"rir":2,"completed":true}]}]}'; BEGIN
 PERFORM public.dietforge_activity_save('30000000-0000-4000-8000-000000000001',1,'30000000-0000-4000-8000-000000000010','session',valid_session);
END $$;
RESET ROLE;
DO $$ BEGIN ASSERT (SELECT data->'exercises'->0->'target'->>'sets'='1' FROM public.dietforge_client_activity WHERE id='30000000-0000-4000-8000-000000000010'); END $$;
SET LOCAL ROLE authenticated;
DO $$ DECLARE rejected boolean:=false; valid_session jsonb:='{"date":"2026-09-15","program_id":1,"day_id":"w2-day","week":2,"completed":true,"fatigue":5,"notes":"","exercises":[{"exercise_id":"w2-ex","sets":[{"kg":40,"reps":10,"rir":2,"completed":true}]}]}'; BEGIN
 BEGIN PERFORM public.dietforge_activity_save('30000000-0000-4000-8000-000000000001',1,'30000000-0000-4000-8000-000000000011','session',jsonb_set(valid_session,'{day_id}','"w1-day"'));EXCEPTION WHEN OTHERS THEN rejected:=true;END;ASSERT rejected;
END $$;
RESET ROLE;
ROLLBACK;
