BEGIN;

-- Security hardening 2026-10-29
-- 1) A workspace owner must not use the client-portal email branch to keep
--    reading or writing their own clients after the license expires/suspends.
-- 2) The legacy check_subscription function must not be executable by anon;
--    only the trusted service role may query it.

CREATE OR REPLACE FUNCTION public.dietforge_client_allowed(o uuid,c bigint) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL
 AND EXISTS(SELECT 1 FROM public.dietforge_records WHERE owner_id=o AND collection='clients' AND id=c)
 AND (
  (o=auth.uid() AND public.dietforge_has_access())
  OR (o<>auth.uid() AND EXISTS(
   SELECT 1 FROM public.dietforge_client_portals p JOIN auth.users u ON u.id=auth.uid()
   WHERE p.owner_id=o AND p.client_id=c AND p.enabled
   AND u.email_confirmed_at IS NOT NULL AND lower(u.email)=p.email))
 );
$$;
REVOKE ALL ON FUNCTION public.dietforge_client_allowed(uuid,bigint) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.dietforge_portal_memberships() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('owner_id',p.owner_id,'client_id',p.client_id,'name',r.data->>'name','email',p.email,'enabled',p.enabled)),'[]'::jsonb)
 FROM public.dietforge_client_portals p
 JOIN public.dietforge_records r ON r.owner_id=p.owner_id AND r.collection='clients' AND r.id=p.client_id
 WHERE (p.owner_id=auth.uid() AND public.dietforge_has_access())
    OR (p.owner_id<>auth.uid() AND p.enabled AND EXISTS(
     SELECT 1 FROM auth.users WHERE id=auth.uid()
     AND email_confirmed_at IS NOT NULL AND lower(email)=p.email));
$$;
REVOKE ALL ON FUNCTION public.dietforge_portal_memberships() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dietforge_portal_memberships() TO authenticated;

CREATE OR REPLACE FUNCTION public.dietforge_portal_grant_unlocked(c bigint,mail text,enabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_mail text;
BEGIN
 IF NOT public.dietforge_has_access() OR NOT EXISTS(SELECT 1 FROM public.dietforge_records WHERE owner_id=auth.uid() AND collection='clients' AND id=c) THEN
  RAISE EXCEPTION 'Access denied' USING ERRCODE='42501';
 END IF;
 IF mail IS NULL OR length(mail)>254 OR mail !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' OR enabled IS NULL THEN
  RAISE EXCEPTION 'Invalid email';
 END IF;
 SELECT lower(email) INTO owner_mail FROM auth.users WHERE id=auth.uid();
 IF lower(btrim(mail))=coalesce(owner_mail,'') THEN
  RAISE EXCEPTION 'El correo del coach no puede usarse como acceso de portal.' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.dietforge_client_portals(owner_id,client_id,email,enabled)
 VALUES(auth.uid(),c,lower(btrim(mail)),enabled)
 ON CONFLICT(owner_id,client_id) DO UPDATE SET email=EXCLUDED.email,enabled=EXCLUDED.enabled;
END $$;
REVOKE ALL ON FUNCTION public.dietforge_portal_grant_unlocked(bigint,text,boolean) FROM PUBLIC,anon,authenticated;

-- Existing self-grants become inert because the owner is excluded above; they
-- are not deleted here, so no user data is destroyed by this migration.

CREATE OR REPLACE FUNCTION public.check_subscription(p_email TEXT)
RETURNS TABLE (
  active BOOLEAN,
  status TEXT,
  current_period_end TIMESTAMPTZ
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT
  s.status = 'active' AS active,
  s.status,
  s.current_period_end
 FROM public.subscriptions s
 WHERE s.email = p_email
 LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.check_subscription(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.check_subscription(text) TO service_role;

-- Defense in depth: the table privileges are already revoked, but remove the
-- legacy permissive policies so a future grant cannot expose billing rows.
DROP POLICY IF EXISTS anon_select_subscriptions ON public.subscriptions;
DROP POLICY IF EXISTS anon_select_stripe_events ON public.stripe_events;

NOTIFY pgrst,'reload schema';
COMMIT;
