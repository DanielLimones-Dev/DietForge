BEGIN;
CREATE TABLE public.dietforge_activity_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,owner_id uuid NOT NULL,client_id bigint NOT NULL,activity_id uuid NOT NULL,
 kind text NOT NULL,data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dietforge_activity_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dietforge_activity_history FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.dietforge_record_activity_version() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN INSERT INTO public.dietforge_activity_history(owner_id,client_id,activity_id,kind,data) VALUES(NEW.owner_id,NEW.client_id,NEW.id,NEW.kind,NEW.data);RETURN NEW;END $$;
CREATE TRIGGER activity_history AFTER INSERT OR UPDATE ON public.dietforge_client_activity FOR EACH ROW EXECUTE FUNCTION public.dietforge_record_activity_version();
REVOKE ALL ON FUNCTION public.dietforge_record_activity_version() FROM PUBLIC,anon,authenticated;
COMMIT;
