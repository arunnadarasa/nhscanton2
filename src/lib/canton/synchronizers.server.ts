// Helpers for discovering the participant's connected synchronizer(s).
// Used by the bootstrap so we can register party-to-participant topology
// transactions on the global synchronizer (Splice / Seaport Devnet), not
// just on the participant's local store.
//
// Canton 3.x JSON API v2:
//   GET /v2/state/connected-synchronizers
//     → { connectedSynchronizers: [{ synchronizerAlias, synchronizerId, ... }] }

export type ConnectedSynchronizer = {
  synchronizerAlias?: string;
  synchronizerId?: string;
  permission?: string;
};

export async function fetchConnectedSynchronizers(
  ledgerBase: string,
  adminJwt: string,
): Promise<{
  ok: boolean;
  status: number;
  synchronizers: ConnectedSynchronizer[];
  body?: string;
}> {
  const res = await fetch(`${ledgerBase}/v2/state/connected-synchronizers`, {
    headers: { Authorization: `Bearer ${adminJwt}` },
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, synchronizers: [], body: text.slice(0, 800) };
  }
  let json: { connectedSynchronizers?: ConnectedSynchronizer[] } = {};
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, status: res.status, synchronizers: [], body: text.slice(0, 800) };
  }
  return {
    ok: true,
    status: res.status,
    synchronizers: json.connectedSynchronizers ?? [],
  };
}

/** Pick the first connected synchronizer id, or undefined if none. */
export function pickPrimarySynchronizerId(
  syncs: ConnectedSynchronizer[],
): string | undefined {
  for (const s of syncs) if (s.synchronizerId) return s.synchronizerId;
  return undefined;
}
