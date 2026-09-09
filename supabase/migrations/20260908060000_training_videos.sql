-- Private uploads. Clients can read only objects referenced by their active
-- program; filenames or membership in another coach's portal grant no access.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('training-videos','training-videos',false,52428800,ARRAY['video/mp4','video/webm','video/quicktime'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.dietforge_video_allowed(path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (
 (split_part(path,'/',1)=auth.uid()::text AND public.dietforge_has_access()) OR EXISTS(
 SELECT 1 FROM public.dietforge_records r
 WHERE r.collection='trainingPrograms' AND r.data->>'status'='active'
 AND split_part(path,'/',1)=r.owner_id::text
 AND EXISTS(SELECT 1 FROM public.dietforge_records c WHERE c.owner_id=r.owner_id AND c.collection='clients' AND c.id::text=r.data->>'client_id' AND public.dietforge_client_allowed(c.owner_id,c.id))
 AND (
 EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.data->'resources')='array' THEN r.data->'resources' ELSE '[]'::jsonb END) v WHERE v->>'url'='storage:'||path)
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.data->'days')='array' THEN r.data->'days' ELSE '[]'::jsonb END) d
 CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(d->'exercises')='array' THEN d->'exercises' ELSE '[]'::jsonb END) e
 WHERE e->>'video_custom'='true' AND e->>'video_url'='storage:'||path)
 )));
$$;
REVOKE ALL ON FUNCTION public.dietforge_video_allowed(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dietforge_video_allowed(text) TO authenticated;
CREATE POLICY training_video_read ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='training-videos' AND public.dietforge_video_allowed(name));
CREATE POLICY training_video_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='training-videos' AND split_part(name,'/',1)=auth.uid()::text AND public.dietforge_has_access()
AND name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(mp4|webm|mov)$');
-- No UPDATE/DELETE policy: replacing or unassigning never destroys a video
-- still referenced by another program or a retained backup.
