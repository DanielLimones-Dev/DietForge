BEGIN;
-- Admin deletion retires the private photo-path registry of the target coach
-- without touching other owners. All fixtures are synthetic and roll back.
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('80000000-0000-4000-8000-000000000001','target-photos@dietforge.invalid',now());
INSERT INTO public.dietforge_access(email,expires_at) VALUES('target-photos@dietforge.invalid',now()+interval '1 month');
INSERT INTO public.dietforge_workspaces(owner_id) VALUES('80000000-0000-4000-8000-000000000001');
INSERT INTO public.dietforge_records(owner_id,collection,id,data) VALUES
 ('80000000-0000-4000-8000-000000000001','clients',1,'{"id":1,"name":"Cliente a eliminar"}');
INSERT INTO storage.objects(bucket_id,name) VALUES
 ('checkin-photos','80000000-0000-4000-8000-000000000001/1/11111111-1111-4111-8111-111111111111.jpg'),
 ('recipe-photos','80000000-0000-4000-8000-000000000001/22222222-2222-4222-8222-222222222222.jpg'),
 ('training-videos','80000000-0000-4000-8000-000000000001/33333333-3333-4333-8333-333333333333.mp4'),
 ('checkin-photos','90000000-0000-4000-8000-000000000009/1/99999999-9999-4999-8999-999999999999.jpg');
INSERT INTO public.dietforge_retired_photo_paths(path) VALUES
 ('80000000-0000-4000-8000-000000000001/1/44444444-4444-4444-8444-444444444444.jpg'),
 ('90000000-0000-4000-8000-000000000009/1/55555555-5555-4555-8555-555555555555.jpg');
SELECT set_config('request.jwt.claims','{"sub":"a2c805ce-24ae-4804-8bc3-8ab6865bf4fb","role":"authenticated"}',true);
DO $$ DECLARE r jsonb; BEGIN
 r:=public.dietforge_admin_delete_coach('target-photos@dietforge.invalid','81000000-0000-4000-8000-000000000001');
 ASSERT (r->>'deleted')::boolean;
 ASSERT (r->>'user_id')::text='80000000-0000-4000-8000-000000000001';
 ASSERT NOT EXISTS(SELECT 1 FROM public.dietforge_records WHERE owner_id='80000000-0000-4000-8000-000000000001');
 ASSERT NOT EXISTS(SELECT 1 FROM public.dietforge_retired_photo_paths WHERE path LIKE '80000000-0000-4000-8000-000000000001/%');
 ASSERT EXISTS(SELECT 1 FROM public.dietforge_retired_photo_paths WHERE path LIKE '90000000-0000-4000-8000-000000000009/%');
END $$;
RESET ROLE;
ROLLBACK;
