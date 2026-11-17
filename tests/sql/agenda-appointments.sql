-- All identities, clients and appointments are synthetic; everything rolls back.
-- Dates are relative so the portal's past-date guard does not turn this into a time bomb.
BEGIN;
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('70000000-0000-4000-8000-000000000001','coach-agenda@dietforge.invalid',now()),
 ('70000000-0000-4000-8000-000000000002','client-agenda-a@dietforge.invalid',now()),
 ('70000000-0000-4000-8000-000000000003','client-agenda-b@dietforge.invalid',now());
INSERT INTO public.dietforge_access(email,expires_at) VALUES('coach-agenda@dietforge.invalid',now()+interval '1 month');
INSERT INTO public.dietforge_workspaces(owner_id) VALUES('70000000-0000-4000-8000-000000000001');
INSERT INTO public.dietforge_records(owner_id,collection,id,data) VALUES
 ('70000000-0000-4000-8000-000000000001','clients',1,'{"id":1,"name":"Cliente agenda A"}'),
 ('70000000-0000-4000-8000-000000000001','clients',2,'{"id":2,"name":"Cliente agenda B"}');
SELECT set_config('request.jwt.claims','{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT public.dietforge_portal_grant(1,'client-agenda-a@dietforge.invalid',true);
SELECT public.dietforge_portal_grant(2,'client-agenda-b@dietforge.invalid',true);
RESET ROLE;

-- The client books: no completion flag is required and the coach sees it.
SELECT set_config('request.jwt.claims','{"sub":"70000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE failed boolean:=false; appointment jsonb; d text:=to_char(current_date+30,'YYYY-MM-DD'); BEGIN
 -- The kind CHECK constraint is part of the schema contract; without it every appointment fails.
 ASSERT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.dietforge_client_activity'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%appointment%'),'kind constraint accepts appointments';
 PERFORM public.dietforge_activity_save('70000000-0000-4000-8000-000000000001',1,'71000000-0000-4000-8000-000000000001','appointment',jsonb_build_object('date',d,'time','10:00','note','Revisión de medidas','status','requested'));
 SELECT value->'data' INTO appointment FROM jsonb_array_elements(public.dietforge_portal_read('70000000-0000-4000-8000-000000000001',1)->'activity') WHERE value->>'kind'='appointment';
 ASSERT appointment->>'time'='10:00';
 ASSERT appointment->>'status'='requested';
 ASSERT NOT (appointment ? 'completed');
 BEGIN PERFORM public.dietforge_activity_save('70000000-0000-4000-8000-000000000001',1,'71000000-0000-4000-8000-000000000001','appointment',jsonb_build_object('date',d,'time','10:00','note','','status','confirmed')); EXCEPTION WHEN insufficient_privilege THEN failed:=true; END;
 ASSERT failed,'the portal never confirms its own appointment';
 failed:=false;
 BEGIN PERFORM public.dietforge_activity_save('70000000-0000-4000-8000-000000000001',1,gen_random_uuid(),'appointment',jsonb_build_object('date',d,'time','25:00','note','','status','requested')); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 ASSERT failed,'invalid appointment time is rejected';
 failed:=false;
 BEGIN PERFORM public.dietforge_activity_save('70000000-0000-4000-8000-000000000001',1,gen_random_uuid(),'appointment','{"date":"2020-01-01","time":"10:00","note":"","status":"requested"}'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 ASSERT failed,'the portal cannot book a past date';
END $$;
RESET ROLE;

-- Another client cannot book the same coach at the same time.
SELECT set_config('request.jwt.claims','{"sub":"70000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE failed boolean:=false; d text:=to_char(current_date+30,'YYYY-MM-DD'); BEGIN
 BEGIN PERFORM public.dietforge_activity_save('70000000-0000-4000-8000-000000000001',2,'72000000-0000-4000-8000-000000000001','appointment',jsonb_build_object('date',d,'time','10:00','note','','status','requested')); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 ASSERT failed,'double booking the same slot is rejected';
 PERFORM public.dietforge_activity_save('70000000-0000-4000-8000-000000000001',2,'72000000-0000-4000-8000-000000000001','appointment',jsonb_build_object('date',d,'time','10:30','note','','status','requested'));
END $$;
RESET ROLE;

-- The coach confirms; after that, the portal can only cancel, never reschedule.
SELECT set_config('request.jwt.claims','{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE appointment jsonb; d text:=to_char(current_date+30,'YYYY-MM-DD'); BEGIN
 PERFORM public.dietforge_activity_save('70000000-0000-4000-8000-000000000001',1,'71000000-0000-4000-8000-000000000001','appointment',jsonb_build_object('date',d,'time','10:00','note','Revisión de medidas','status','confirmed'));
 SELECT value->'data' INTO appointment FROM jsonb_array_elements(public.dietforge_portal_read('70000000-0000-4000-8000-000000000001',1)->'activity') WHERE value->>'kind'='appointment';
 ASSERT appointment->>'status'='confirmed';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"70000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE failed boolean:=false; d text:=to_char(current_date+31,'YYYY-MM-DD'); BEGIN
 BEGIN PERFORM public.dietforge_activity_save('70000000-0000-4000-8000-000000000001',1,'71000000-0000-4000-8000-000000000001','appointment',jsonb_build_object('date',d,'time','11:00','note','','status','requested')); EXCEPTION WHEN insufficient_privilege THEN failed:=true; END;
 ASSERT failed,'the portal cannot reschedule or reopen a confirmed appointment';
 -- A cancellation ignores a forged new date/time/note and keeps the original record.
 PERFORM public.dietforge_activity_save('70000000-0000-4000-8000-000000000001',1,'71000000-0000-4000-8000-000000000001','appointment',jsonb_build_object('date',d,'time','11:00','note','texto falso','status','cancelled'));
 failed:=false;
 BEGIN PERFORM public.dietforge_activity_save('70000000-0000-4000-8000-000000000001',1,'71000000-0000-4000-8000-000000000001','appointment',jsonb_build_object('date',d,'time','11:00','note','','status','requested')); EXCEPTION WHEN insufficient_privilege THEN failed:=true; END;
 ASSERT failed,'the portal cannot reopen a cancelled appointment';
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE appointment jsonb; BEGIN
 SELECT value->'data' INTO appointment FROM jsonb_array_elements(public.dietforge_portal_read('70000000-0000-4000-8000-000000000001',1)->'activity') WHERE value->>'kind'='appointment';
 ASSERT appointment->>'status'='cancelled';
 ASSERT appointment->>'time'='10:00','cancellation preserves the original time';
 ASSERT appointment->>'note'='Revisión de medidas','cancellation preserves the original reason';
END $$;
RESET ROLE;

-- The coach may log a past date; nobody may book beyond one year.
SELECT set_config('request.jwt.claims','{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE failed boolean:=false; BEGIN
 PERFORM public.dietforge_activity_save('70000000-0000-4000-8000-000000000001',1,gen_random_uuid(),'appointment','{"date":"2020-01-01","time":"09:00","note":"registro histórico","status":"confirmed"}');
 failed:=false;
 BEGIN PERFORM public.dietforge_activity_save('70000000-0000-4000-8000-000000000001',1,gen_random_uuid(),'appointment',jsonb_build_object('date',to_char(current_date+400,'YYYY-MM-DD'),'time','09:00','note','','status','requested')); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 ASSERT failed,'appointments beyond one year are rejected';
END $$;
RESET ROLE;
ROLLBACK;
