CREATE TABLE public.contract_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id text NOT NULL,
  contract_id text,
  act_as text[] NOT NULL DEFAULT '{}',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('submitted','created','failed')),
  error text,
  network text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.contract_events TO authenticated;
GRANT SELECT ON public.contract_events TO anon;
GRANT ALL ON public.contract_events TO service_role;

ALTER TABLE public.contract_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read events" ON public.contract_events
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "authenticated can insert events" ON public.contract_events
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX contract_events_created_at_idx ON public.contract_events (created_at DESC);