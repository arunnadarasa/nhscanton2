// Debug: measure /v2/parties response size & timing on the validator.
import { createFileRoute } from "@tanstack/react-router";
import { getCantonEndpoints, getCantonMode } from "@/lib/canton/mode.server";
import { requireDeployToken } from "@/lib/canton/admin-guard.server";

export const Route = createFileRoute("/api/public/admin/list-parties-probe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = requireDeployToken(request);
        if (denied) return denied;
        const mode = getCantonMode();
        const { ledgerApi, adminApi } = getCantonEndpoints();
        const adminBase = ((adminApi ?? ledgerApi) ?? "").replace(/\/+$/, "");
        const { getAdminAccessToken } = await import("@/lib/canton/tokens.server");
        const jwt = await getAdminAccessToken();
        const auth = { Authorization: `Bearer ${jwt}` };

        const variants = [
          `${adminBase}/v2/parties`,
          `${adminBase}/v2/parties?pageSize=5`,
          `${adminBase}/v2/parties?pageSize=5&parties=DHSC`,
        ];
        const results: unknown[] = [];
        for (const u of variants) {
          const t0 = Date.now();
          try {
            const r = await fetch(u, { headers: auth });
            const text = await r.text();
            let count: number | string = "n/a";
            try {
              const j = JSON.parse(text) as { partyDetails?: unknown[] };
              count = j.partyDetails?.length ?? "no-partyDetails";
            } catch { /* not json */ }
            results.push({
              url: u,
              status: r.status,
              ms: Date.now() - t0,
              bytes: text.length,
              partyCount: count,
              preview: text.slice(0, 400),
            });
          } catch (e) {
            results.push({ url: u, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) });
          }
        }
        return Response.json({ mode, adminBase, results });
      },
    },
  },
});
