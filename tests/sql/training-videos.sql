BEGIN;
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
('10000000-0000-4000-8000-000000000001','video-coach@dietforge.invalid',now()),
('10000000-0000-4000-8000-000000000002','video-client@dietforge.invalid',now()),
('10000000-0000-4000-8000-000000000003','video-stranger@dietforge.invalid',now());
INSERT INTO public.dietforge_access(email,expires_at) VALUES('video-coach@dietforge.invalid',now()+interval '1 month');
INSERT INTO public.dietforge_workspaces(owner_id) VALUES('10000000-0000-4000-8000-000000000001');
INSERT INTO public.dietforge_records(owner_id,collection,id,data) VALUES
('10000000-0000-4000-8000-000000000001','clients',1,'{"id":1,"name":"Video test"}'),
('10000000-0000-4000-8000-000000000001','trainingPrograms',1,'{"id":1,"client_id":1,"status":"active","resources":[{"id":"r","title":"RIR","url":"storage:10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001.mp4"}],"days":[]}');
INSERT INTO public.dietforge_client_portals VALUES('10000000-0000-4000-8000-000000000001',1,'video-client@dietforge.invalid',true);
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO storage.objects(bucket_id,name) VALUES('training-videos','10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001.mp4');
DO $$ BEGIN ASSERT public.dietforge_video_allowed('10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001.mp4'); END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; rejected boolean:=false; BEGIN
 SELECT count(*) INTO n FROM storage.objects WHERE bucket_id='training-videos';ASSERT n=1;
 ASSERT NOT public.dietforge_video_allowed('10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002.mp4');
 BEGIN INSERT INTO storage.objects(bucket_id,name) VALUES('training-videos','10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002.mp4');EXCEPTION WHEN insufficient_privilege THEN rejected:=true;END;ASSERT rejected;
END $$;
RESET ROLE;
UPDATE public.dietforge_records SET data=jsonb_set(data,'{status}','"draft"') WHERE collection='trainingPrograms' AND owner_id='10000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN ASSERT NOT public.dietforge_video_allowed('10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001.mp4'); END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM storage.objects WHERE bucket_id='training-videos';ASSERT n=0; END $$;
RESET ROLE;
ROLLBACK;
