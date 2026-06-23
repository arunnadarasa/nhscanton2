// Debug-only endpoint: walks the same steps as admin.deploy but returns
// per-step timing and any error caught around each step, so we can see
// which one 502s in production.

import { createFileRoute } from "@tanstack/react-router";
import { getCantonEndpoints, getCantonMode } from "@/lib/canton/mode.server";
import { requireDeployToken } from "@/lib/canton/admin-guard.server";

type Step = { name: string; ms: number; ok: boolean; data?: unknown; error?: string };

async function timed<T>(name: string, fn: () => Promise<T>, steps: Step[]): Promise<T | undefined> {
  const t0 = Date.now();
  try {
    const data = await fn();
    steps.push({ name, ms: Date.now() - t0, ok: true, data });
    return data;
  } catch (e) {
    steps.push({ name, ms: Date.now() - t0, ok: false, error: e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e) });
    return undefined;
  }
}

export const Route = createFileRoute("/api/public/admin/deploy-trace")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = requireDeployToken(request);
        if (denied) return denied;
        const steps: Step[] = [];
        const mode = getCantonMode();
        const { ledgerApi, adminApi } = getCantonEndpoints();
        const adminBase = (adminApi ?? ledgerApi ?? "").replace(/\/+$/, "");
        const ledgerBase = (ledgerApi ?? "").replace(/\/+$/, "");

        const adminJwt = await timed("mint-admin-token", async () => {
          const { getAdminAccessToken } = await import("@/lib/canton/tokens.server");
          const t = await getAdminAccessToken();
          return { length: t.length };
        }, steps);
        if (!adminJwt) return Response.json({ mode, steps });

        const { getAdminAccessToken } = await import("@/lib/canton/tokens.server");
        const jwt = await getAdminAccessToken();
        const auth = { Authorization: `Bearer ${jwt}` };

        await timed("discover-synchronizers", async () => {
          const { fetchConnectedSynchronizers } = await import("@/lib/canton/synchronizers.server");
          return await fetchConnectedSynchronizers(ledgerBase, jwt);
        }, steps);

        await timed("list-existing-parties (db)", async () => {
          const { listParties } = await import("@/lib/canton/parties.server");
          const rows = await listParties();
          return { count: rows.length, sample: rows.slice(0, 5) };
        }, steps);

        await timed("allocate-DHSC", async () => {
          const r = await fetch(`${adminBase}/v2/parties`, {
            method: "POST",
            headers: { ...auth, "Content-Type": "application/json" },
            body: JSON.stringify({ partyIdHint: "DHSC" }),
          });
          return { status: r.status, body: (await r.text()).slice(0, 400) };
        }, steps);

        return Response.json({ mode, endpoints: { ledgerBase, adminBase }, steps });
      },
    },
  },
});
