BEGIN;
-- Server-owned effective diet versions. Reading a notice never changes its version.
CREATE TABLE public.dietforge_diet_notices (
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 client_id bigint NOT NULL,fingerprint text NOT NULL,revision uuid,
 PRIMARY KEY(owner_id,client_id)
);
CREATE TABLE public.dietforge_diet_notice_reads (
 owner_id uuid NOT NULL,client_id bigint NOT NULL,
 reader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 revision uuid NOT NULL,read_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,client_id,reader_id),
 FOREIGN KEY(owner_id,client_id) REFERENCES public.dietforge_diet_notices(owner_id,client_id) ON DELETE CASCADE
);
ALTER TABLE public.dietforge_diet_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dietforge_diet_notice_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dietforge_diet_notices,public.dietforge_diet_notice_reads FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.dietforge_refresh_diet_notices(o uuid,baseline boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c record;content jsonb;f text;old_f text;
BEGIN
 FOR c IN SELECT id FROM public.dietforge_records WHERE owner_id=o AND collection='clients' LOOP
  WITH plans AS (
   SELECT id,data FROM public.dietforge_records WHERE owner_id=o AND collection='mealPlans' AND data->>'client_id'=c.id::text
  ),items AS (
   SELECT i.id,i.data FROM public.dietforge_records i WHERE i.owner_id=o AND i.collection='mealPlanItems'
   AND EXISTS(SELECT 1 FROM plans p WHERE p.id::text=i.data->>'meal_plan_id')
  ),foods AS (
   SELECT f.id,f.data FROM public.dietforge_records f WHERE f.owner_id=o AND f.collection='foods'
   AND EXISTS(SELECT 1 FROM items i WHERE i.data->>'food_id'=f.id::text)
  ) SELECT jsonb_build_object(
   'plans',coalesce((SELECT jsonb_agg(data-ARRAY['updated_at','created_at'] ORDER BY id) FROM plans),'[]'::jsonb),
   'items',coalesce((SELECT jsonb_agg(data-ARRAY['updated_at','created_at'] ORDER BY id) FROM items),'[]'::jsonb),
   'foods',coalesce((SELECT jsonb_agg(data-ARRAY['updated_at','created_at'] ORDER BY id) FROM foods),'[]'::jsonb)
  ) INTO content;
  f:=md5(content::text);
  SELECT fingerprint INTO old_f FROM public.dietforge_diet_notices WHERE owner_id=o AND client_id=c.id;
  IF NOT FOUND THEN
   INSERT INTO public.dietforge_diet_notices(owner_id,client_id,fingerprint,revision)
   VALUES(o,c.id,f,CASE WHEN baseline OR jsonb_array_length(content->'plans')=0 THEN NULL ELSE gen_random_uuid() END);
  ELSIF old_f IS DISTINCT FROM f THEN
   UPDATE public.dietforge_diet_notices SET fingerprint=f,revision=gen_random_uuid() WHERE owner_id=o AND client_id=c.id;
  END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.dietforge_refresh_diet_notices(uuid,boolean) FROM PUBLIC,anon,authenticated;
-- Bootstrap existing content without claiming that an edit occurred during deployment.
DO $$DECLARE w record;BEGIN
 FOR w IN SELECT owner_id FROM public.dietforge_workspaces LOOP
  PERFORM public.dietforge_refresh_diet_notices(w.owner_id,true);
 END LOOP;
END $$;
-- Called once after a complete snapshot, so intermediate row changes cannot cause notices.
ALTER FUNCTION public._dietforge_save_storage(jsonb,bigint,uuid) RENAME TO _dietforge_save_storage_before_diet_notices;
REVOKE ALL ON FUNCTION public._dietforge_save_storage_before_diet_notices(jsonb,bigint,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public._dietforge_save_storage(p_snapshot jsonb,p_expected_revision bigint,p_mutation_id uuid) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rev bigint;
BEGIN
 rev:=public._dietforge_save_storage_before_diet_notices(p_snapshot,p_expected_revision,p_mutation_id);
 PERFORM public.dietforge_refresh_diet_notices(auth.uid());
 RETURN rev;
END $$;
REVOKE ALL ON FUNCTION public._dietforge_save_storage(jsonb,bigint,uuid) FROM PUBLIC,anon,authenticated;
-- Restore and numeric-ID retirement must discard every reader's previous acknowledgment.
ALTER FUNCTION public.dietforge_retire_client(uuid,bigint) RENAME TO dietforge_retire_client_before_diet_notices;
REVOKE ALL ON FUNCTION public.dietforge_retire_client_before_diet_notices(uuid,bigint) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.dietforge_retire_client(o uuid,c bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.dietforge_retire_client_before_diet_notices(o,c);
 DELETE FROM public.dietforge_diet_notices WHERE owner_id=o AND client_id=c;
END $$;
REVOKE ALL ON FUNCTION public.dietforge_retire_client(uuid,bigint) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.dietforge_diet_notice_read(o uuid,c bigint) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v uuid;seen uuid;
BEGIN
 IF NOT public.dietforge_client_allowed(o,c) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT revision INTO v FROM public.dietforge_diet_notices WHERE owner_id=o AND client_id=c;
 SELECT revision INTO seen FROM public.dietforge_diet_notice_reads WHERE owner_id=o AND client_id=c AND reader_id=auth.uid();
 RETURN jsonb_build_object('revision',v,'pending',v IS NOT NULL AND v IS DISTINCT FROM seen);
END $$;
CREATE FUNCTION public.dietforge_diet_notice_seen(o uuid,c bigint,v uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_v uuid;
BEGIN
 PERFORM 1 FROM public.dietforge_workspaces WHERE owner_id=o FOR UPDATE;
 IF NOT public.dietforge_client_allowed(o,c) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT revision INTO current_v FROM public.dietforge_diet_notices WHERE owner_id=o AND client_id=c;
 IF v IS NULL OR current_v IS DISTINCT FROM v THEN RETURN false; END IF;
 INSERT INTO public.dietforge_diet_notice_reads(owner_id,client_id,reader_id,revision)
 VALUES(o,c,auth.uid(),v) ON CONFLICT(owner_id,client_id,reader_id)
 DO UPDATE SET revision=EXCLUDED.revision,read_at=now();
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.dietforge_diet_notice_read(uuid,bigint),public.dietforge_diet_notice_seen(uuid,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dietforge_diet_notice_read(uuid,bigint),public.dietforge_diet_notice_seen(uuid,bigint,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
