BEGIN;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('checkin-photos','checkin-photos',false,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;
CREATE OR REPLACE FUNCTION public.dietforge_checkin_photo_allowed(path text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF path !~ '^[a-f0-9-]{36}/[0-9]{1,15}/[a-f0-9-]{36}\.(jpg|png|webp)$' THEN RETURN false; END IF;
 RETURN public.dietforge_client_allowed(split_part(path,'/',1)::uuid,split_part(path,'/',2)::bigint);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.dietforge_checkin_photo_allowed(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dietforge_checkin_photo_allowed(text) TO authenticated;
CREATE POLICY checkin_photo_read ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='checkin-photos' AND public.dietforge_checkin_photo_allowed(name));
CREATE POLICY checkin_photo_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='checkin-photos' AND public.dietforge_checkin_photo_allowed(name));
-- Immutable objects: replacements use a new path, retaining historic references.
CREATE OR REPLACE FUNCTION public.dietforge_validate_checkin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d jsonb:=NEW.data; pair record; photo jsonb;
BEGIN
 IF NEW.kind<>'checkin' THEN RETURN NEW; END IF;
 IF jsonb_typeof(d->'weight') IS DISTINCT FROM 'number' OR (d->>'weight')::numeric NOT BETWEEN 20 AND 500 THEN RAISE EXCEPTION 'Invalid weight'; END IF;
 IF TG_OP='UPDATE' AND auth.uid() IS DISTINCT FROM NEW.owner_id AND OLD.data ? 'body_fat' THEN RAISE EXCEPTION 'Coach assessment is protected' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(d) AS keys(key) WHERE key NOT IN ('date','weight','body_fat','measurements','adherence','notes','photos')) THEN RAISE EXCEPTION 'Unknown check-in field'; END IF;
 IF auth.uid() IS DISTINCT FROM NEW.owner_id AND d ? 'body_fat' THEN RAISE EXCEPTION 'Only coach can assess body fat' USING ERRCODE='42501'; END IF;
 IF d ? 'body_fat' AND (jsonb_typeof(d->'body_fat') IS DISTINCT FROM 'number' OR (d->>'body_fat')::numeric NOT BETWEEN 0 AND 75) THEN RAISE EXCEPTION 'Invalid body fat'; END IF;
 IF d ? 'notes' AND (jsonb_typeof(d->'notes') IS DISTINCT FROM 'string' OR length(d->>'notes')>5000) THEN RAISE EXCEPTION 'Invalid notes'; END IF;
 IF d ? 'measurements' THEN
  IF jsonb_typeof(d->'measurements') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid measurements'; END IF;
  FOR pair IN SELECT * FROM jsonb_each(d->'measurements') LOOP
   IF pair.key NOT IN ('neck','shoulders','chest','waist','hips','left_arm','right_arm','left_thigh','right_thigh','left_calf','right_calf') OR jsonb_typeof(pair.value) IS DISTINCT FROM 'number' OR pair.value::text::numeric NOT BETWEEN 0.1 AND 300 THEN RAISE EXCEPTION 'Invalid measurement'; END IF;
  END LOOP;
 END IF;
 IF d ? 'adherence' THEN
  IF jsonb_typeof(d->'adherence') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid adherence'; END IF;
  FOR pair IN SELECT * FROM jsonb_each(d->'adherence') LOOP
   IF jsonb_typeof(pair.value) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid adherence value'; END IF;
   IF pair.key IN ('meals','supplements','training','cardio') THEN
    IF pair.value::text::numeric NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Invalid adherence percent'; END IF;
   ELSIF pair.key IN ('energy','sleep','hunger','libido','digestion') THEN
    IF pair.value::text::numeric NOT BETWEEN 1 AND 5 OR pair.value::text::numeric<>trunc(pair.value::text::numeric) THEN RAISE EXCEPTION 'Invalid rating'; END IF;
   ELSE RAISE EXCEPTION 'Unknown adherence field'; END IF;
  END LOOP;
 END IF;
 IF d ? 'photos' THEN
  IF jsonb_typeof(d->'photos') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'photos')>8 THEN RAISE EXCEPTION 'Invalid photos'; END IF;
  IF (SELECT count(DISTINCT value->>'angle') FROM jsonb_array_elements(d->'photos'))<>jsonb_array_length(d->'photos') THEN RAISE EXCEPTION 'Duplicate photo angle'; END IF;
  FOR photo IN SELECT value FROM jsonb_array_elements(d->'photos') LOOP
   IF photo->>'angle' IS NULL OR photo->>'angle' NOT IN ('front_relaxed','back_relaxed','front_double_biceps','back_lat_spread','side_chest','side_triceps','ab_thigh','most_muscular') OR photo->>'path' IS NULL
   OR NOT public.dietforge_checkin_photo_allowed(photo->>'path') OR split_part(photo->>'path','/',1)<>NEW.owner_id::text OR split_part(photo->>'path','/',2)<>NEW.client_id::text
   OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='checkin-photos' AND name=photo->>'path') THEN RAISE EXCEPTION 'Invalid photo reference'; END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_checkin BEFORE INSERT OR UPDATE ON public.dietforge_client_activity FOR EACH ROW EXECUTE FUNCTION public.dietforge_validate_checkin();
REVOKE ALL ON FUNCTION public.dietforge_validate_checkin() FROM PUBLIC,anon,authenticated;

CREATE TABLE public.dietforge_notifications(
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 client_id bigint NOT NULL, activity_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz,
 PRIMARY KEY(owner_id,client_id,activity_id)
);
ALTER TABLE public.dietforge_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dietforge_notifications FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.dietforge_notify_checkin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.kind='checkin' AND auth.uid()<>NEW.owner_id THEN
  INSERT INTO public.dietforge_notifications(owner_id,client_id,activity_id) VALUES(NEW.owner_id,NEW.client_id,NEW.id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER notify_new_checkin AFTER INSERT ON public.dietforge_client_activity FOR EACH ROW EXECUTE FUNCTION public.dietforge_notify_checkin();
REVOKE ALL ON FUNCTION public.dietforge_notify_checkin() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.dietforge_notifications_read() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.dietforge_has_access() THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('unread',(SELECT count(*) FROM public.dietforge_notifications WHERE owner_id=auth.uid() AND read_at IS NULL),'items',coalesce((SELECT jsonb_agg(to_jsonb(n)) FROM (
 SELECT n.client_id,n.activity_id,n.created_at,n.read_at,coalesce(r.data->>'name','Cliente no disponible') AS client_name
 FROM public.dietforge_notifications n LEFT JOIN public.dietforge_records r ON r.owner_id=n.owner_id AND r.collection='clients' AND r.id=n.client_id
 WHERE n.owner_id=auth.uid() ORDER BY (n.read_at IS NULL) DESC,n.created_at DESC LIMIT 50
 ) n),'[]'::jsonb));
END $$;
CREATE OR REPLACE FUNCTION public.dietforge_notification_seen(c bigint,i uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.dietforge_has_access() THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 UPDATE public.dietforge_notifications SET read_at=coalesce(read_at,now()) WHERE owner_id=auth.uid() AND client_id=c AND activity_id=i;
END $$;
REVOKE ALL ON FUNCTION public.dietforge_notifications_read(),public.dietforge_notification_seen(bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dietforge_notifications_read(),public.dietforge_notification_seen(bigint,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
