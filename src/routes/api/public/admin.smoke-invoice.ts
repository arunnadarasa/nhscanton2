// Smoke test: end-to-end SpendCommitment → Countersign → ReconciledSpend on the live ledger.
// (The deployed DAR exposes SpendCommitment/Countersign; Invoice is app-side only.)
import { createFileRoute } from "@tanstack/react-router";

import type { SpendCommitment } from "@/lib/canton/types";

export const Route = createFileRoute("/api/public/admin/smoke-invoice")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const c = await import("@/lib/canton/client.server");
          const { partyTrust, partyIcb, partyAuditor } = await import("@/lib/nhs/data");
          const trustCode = "GSTT";
          const icbCode = "LDN";
          const ts = Date.now();
          const category = `SMOKE-${ts}`;
          const created = await c.createSpendCommitment({
            trust: partyTrust(trustCode),
            commissioner: partyIcb(icbCode),
            auditor: partyAuditor(),
            category,
            amountGbp: "1234.56",
            period: "2026-06",
          });
          const visible = await c.querySpendCommitments(partyIcb(icbCode));
          const found = visible.find(
            (v: { contractId: string; payload: SpendCommitment }) => v.contractId === created.contractId,
          );
          if (!found) {
            return Response.json(
              { ok: false, step: "query-as-icb", created, visibleCount: visible.length },
              { status: 500 },
            );
          }
          const reconciled = await c.countersign(found);
          return Response.json({ ok: true, category, commitment: created, reconciled });
        } catch (e) {
          return Response.json(
            {
              ok: false,
              error: e instanceof Error ? e.message : String(e),
              stack: e instanceof Error ? e.stack : undefined,
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
