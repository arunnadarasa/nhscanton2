
-- Restrict contract_events: remove public/anonymous read access and remove permissive insert.
-- All access already goes through trusted server functions using the service role.
DROP POLICY IF EXISTS "anyone can read events" ON public.contract_events;
DROP POLICY IF EXISTS "authenticated can insert events" ON public.contract_events;

-- Allow authenticated users to read (server uses service role and bypasses RLS).
CREATE POLICY "authenticated can read events"
  ON public.contract_events
  FOR SELECT
  TO authenticated
  USING (true);

-- Revoke anon access; keep authenticated read for future client use and service_role for server.
REVOKE ALL ON public.contract_events FROM anon;
GRANT SELECT ON public.contract_events TO authenticated;
GRANT ALL ON public.contract_events TO service_role;

-- canton_parties: intentionally server-only. Allow authenticated SELECT so it's not a misconfig.
CREATE POLICY "authenticated can read canton parties"
  ON public.canton_parties
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON public.canton_parties FROM anon;
GRANT SELECT ON public.canton_parties TO authenticated;
GRANT ALL ON public.canton_parties TO service_role;
