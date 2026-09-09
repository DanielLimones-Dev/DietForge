BEGIN;

-- Public, read-only probe for uptime checks. It exposes no workspace or user data.
CREATE OR REPLACE FUNCTION public.dietforge_healthcheck() RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'ok', true,
    'service', 'dietforge-database',
    'checked_at', statement_timestamp()
  );
$$;

REVOKE ALL ON FUNCTION public.dietforge_healthcheck() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dietforge_healthcheck() TO anon, authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;
