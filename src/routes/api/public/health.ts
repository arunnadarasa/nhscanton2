import { createFileRoute } from "@tanstack/react-router";

import { ledgerMode } from "@/lib/canton/client.server";
import { livePing } from "@/lib/canton/live.server";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const m = ledgerMode();
        let liveCheck: { ok: boolean; offset?: string; error?: string } | undefined;
        if (m.mode === "live") {
          try {
            const r = await livePing();
            liveCheck = { ok: true, offset: r.offset };
          } catch (e) {
            liveCheck = { ok: false, error: e instanceof Error ? e.message : String(e) };
          }
        }
        return Response.json({
          app: "nhs-canton-ledger",
          ledger: m,
          liveCheck,
          api: "json-ledger-api/v2",
          timestamp: new Date().toISOString(),
        });
      },
    },
  },
});
