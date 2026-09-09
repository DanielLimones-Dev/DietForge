BEGIN;
DO $$ DECLARE a jsonb; b jsonb; failed boolean; BEGIN
 PERFORM set_config('request.jwt.claims','{"sub":"a2c805ce-24ae-4804-8bc3-8ab6865bf4fb","role":"authenticated"}',true);
 ASSERT public.dietforge_is_admin();
 ASSERT (public.dietforge_my_access()->>'active')::boolean;
 a:=public.dietforge_admin_set_access('fixture-admin-test@example.invalid','renew',1,'fixture','11111111-1111-4111-8111-111111111111');
 ASSERT (a->>'expires_at')::timestamptz=now()+interval '1 month';
 b:=public.dietforge_admin_set_access('fixture-admin-test@example.invalid','renew',1,'fixture','11111111-1111-4111-8111-111111111111');
 ASSERT a=b;
 b:=public.dietforge_admin_set_access('fixture-admin-test@example.invalid','renew',3,'fixture','11111111-1111-4111-8111-111111111112');
 ASSERT (b->>'expires_at')::timestamptz=(a->>'expires_at')::timestamptz+interval '3 months';
 a:=public.dietforge_admin_set_access('fixture-admin-test@example.invalid','renew',12,'fixture','11111111-1111-4111-8111-111111111113');
 ASSERT (a->>'expires_at')::timestamptz=(b->>'expires_at')::timestamptz+interval '1 year';
 b:=public.dietforge_admin_set_access('fixture-admin-test@example.invalid','suspend',null,'fixture','11111111-1111-4111-8111-111111111114');
 ASSERT (b->>'suspended')::boolean;
 a:=public.dietforge_admin_set_access('fixture-admin-test@example.invalid','resume',null,'fixture','11111111-1111-4111-8111-111111111115');
 ASSERT NOT (a->>'suspended')::boolean;
 failed:=false; BEGIN PERFORM public.dietforge_admin_set_access('fixture-admin-test@example.invalid','renew',2,'fixture',gen_random_uuid()); EXCEPTION WHEN OTHERS THEN failed:=true; END; ASSERT failed;
 failed:=false; BEGIN PERFORM public.dietforge_admin_set_access('tilabrona99@gmail.com','suspend',null,'fixture',gen_random_uuid()); EXCEPTION WHEN OTHERS THEN failed:=true; END; ASSERT failed;
 UPDATE public.dietforge_access SET expires_at=now()-interval '1 day' WHERE email='fixture-admin-test@example.invalid';
 a:=public.dietforge_admin_set_access('fixture-admin-test@example.invalid','renew',3,'fixture',gen_random_uuid());
 ASSERT (a->>'expires_at')::timestamptz=now()+interval '3 months';
 PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
 ASSERT NOT public.dietforge_is_admin();
 failed:=false; BEGIN PERFORM public.dietforge_admin_list(); EXCEPTION WHEN insufficient_privilege THEN failed:=true; END; ASSERT failed;
 failed:=false; BEGIN PERFORM public.dietforge_admin_set_access('fixture-admin-test@example.invalid','renew',12,'fixture',gen_random_uuid()); EXCEPTION WHEN insufficient_privilege THEN failed:=true; END; ASSERT failed;
 ASSERT NOT has_function_privilege('anon','public.upsert_subscription(text,text,text,text,text,text,timestamp with time zone,timestamp with time zone)','EXECUTE');
 ASSERT NOT has_function_privilege('authenticated','public._dietforge_load_storage()','EXECUTE');
 ASSERT NOT has_table_privilege('authenticated','public.dietforge_access','UPDATE');
END $$;

-- An expired confirmed coach cannot read or write even with a valid session.
DO $$ DECLARE u uuid; mail text; BEGIN
 SELECT id,lower(email) INTO u,mail FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.dietforge_admins) AND email_confirmed_at IS NOT NULL LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'A confirmed non-admin fixture is required'; END IF;
 INSERT INTO public.dietforge_access(email,expires_at,trial_started_at,suspended) VALUES(mail,now()-interval '1 day',now()-interval '30 days',false)
 ON CONFLICT(email) DO UPDATE SET expires_at=excluded.expires_at,trial_started_at=excluded.trial_started_at,suspended=false;
 UPDATE public.subscriptions SET current_period_end=now()-interval '1 day' WHERE lower(email)=mail;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$ DECLARE failed boolean:=false; BEGIN
 ASSERT NOT public.dietforge_has_access();
 ASSERT (SELECT count(*) FROM public.dietforge_records)=0;
 BEGIN PERFORM public.dietforge_load(); EXCEPTION WHEN insufficient_privilege THEN failed:=true; END; ASSERT failed;
 failed:=false;
 BEGIN PERFORM public.dietforge_save('{}',0,gen_random_uuid()); EXCEPTION WHEN insufficient_privilege THEN failed:=true; END; ASSERT failed;
END $$;
RESET ROLE;
ROLLBACK;
