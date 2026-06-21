CREATE TABLE public.canton_parties (
  logical_name text PRIMARY KEY,
  party_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.canton_parties TO service_role;
ALTER TABLE public.canton_parties ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (used by server functions) can read/write.