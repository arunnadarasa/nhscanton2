// Resolve logical party hints ("DHSC", "ICB-LDN", "Trust-GSTT", "Auditor")
// to fully-qualified Canton party IDs ("DHSC::1220ab...").
//
// The mapping is populated by /api/public/admin/deploy after it allocates
// each party on the participant. Cached per-isolate after first read.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Row = { logical_name: string; party_id: string };

let cache: Map<string, string> | null = null;
let inflight: Promise<Map<string, string>> | null = null;

async function loadMap(): Promise<Map<string, string>> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await supabaseAdmin
      .from("canton_parties")
      .select("logical_name, party_id");
    if (error) throw new Error(`canton_parties: ${error.message}`);
    const m = new Map<string, string>();
    for (const r of (data ?? []) as Row[]) m.set(r.logical_name, r.party_id);
    cache = m;
    inflight = null;
    return m;
  })();
  return inflight;
}

export function invalidatePartyCache() {
  cache = null;
  inflight = null;
}

/** Resolve a logical hint or pass through if already a party ID (contains `::`). */
export async function resolveParty(p: string): Promise<string> {
  if (!p) return p;
  if (p.includes("::")) return p; // already a fully-qualified party ID
  const m = await loadMap();
  const id = m.get(p);
  if (!id) {
    throw new Error(
      `Canton party "${p}" has not been allocated yet — run /deploy → "Initialize live ledger"`,
    );
  }
  return id;
}

/** Shallow-resolve any string field in `payload` whose value matches a known logical hint. */
export async function resolvePayloadParties<T extends Record<string, unknown>>(
  payload: T,
): Promise<T> {
  const m = await loadMap();
  if (m.size === 0) return payload;
  const out: Record<string, unknown> = { ...payload };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "string" && m.has(v)) out[k] = m.get(v)!;
  }
  return out as T;
}

export async function upsertParties(rows: Array<{ logical_name: string; party_id: string }>) {
  if (rows.length === 0) return;
  const { error } = await supabaseAdmin
    .from("canton_parties")
    .upsert(rows, { onConflict: "logical_name" });
  if (error) throw new Error(`canton_parties upsert: ${error.message}`);
  invalidatePartyCache();
}

export async function listParties(): Promise<Row[]> {
  const m = await loadMap();
  return Array.from(m.entries()).map(([logical_name, party_id]) => ({ logical_name, party_id }));
}
