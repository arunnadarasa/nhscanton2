// Smoke test: end-to-end on the live ledger for BOTH workflows.
//   1) SpendCommitment → Countersign → ReconciledSpend
//   2) Invoice         → CountersignInvoice → ReconciledSpend
import { createFileRoute } from "@tanstack/react-router";

import type { Invoice, SpendCommitment } from "@/lib/canton/types";
import { requireDeployToken } from "@/lib/canton/admin-guard.server";

export const Route = createFileRoute("/api/public/admin/smoke-invoice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = requireDeployToken(request);
        if (denied) return denied;
        try {
          const c = await import("@/lib/canton/client.server");
          const { partyTrust, partyIcb, partyAuditor } = await import("@/lib/nhs/data");
          const trustCode = "GSTT";
          const icbCode = "LDN";
          const ts = Date.now();
          const trust = partyTrust(trustCode);
          const commissioner = partyIcb(icbCode);
          const auditor = partyAuditor();

          // --- SpendCommitment path -----------------------------------------
          const category = `SMOKE-SC-${ts}`;
          const sc = await c.createSpendCommitment({
            trust, commissioner, auditor, category,
            amountGbp: "1234.56", period: "2026-06",
          });
          const scVisible = await c.querySpendCommitments(commissioner);
          const scFound = scVisible.find(
            (v: { contractId: string; payload: SpendCommitment }) =>
              v.contractId === sc.contractId,
          );
          if (!scFound) {
            return Response.json(
              { ok: false, step: "query-sc-as-icb", sc, visibleCount: scVisible.length },
              { status: 500 },
            );
          }
          const scReconciled = await c.countersign(scFound);

          // --- Invoice path -------------------------------------------------
          const invoiceRef = `SMOKE-INV-${ts}`;
          const inv = await c.createInvoice({
            trust, commissioner, auditor, invoiceRef,
            category: "Smoke Test", amountGbp: "9876.54", period: "2026-06",
            supplierName: "Lovable Smoke Co",
          });
          const invVisible = await c.queryInvoices(commissioner);
          const invFound = invVisible.find(
            (v: { contractId: string; payload: Invoice }) =>
              v.contractId === inv.contractId,
          );
          if (!invFound) {
            return Response.json(
              { ok: false, step: "query-invoice-as-icb", inv, visibleCount: invVisible.length },
              { status: 500 },
            );
          }
          const invReconciled = await c.countersignInvoice(invFound);

          return Response.json({
            ok: true,
            spendCommitment: { category, commitment: sc, reconciled: scReconciled },
            invoice: { invoiceRef, invoice: inv, reconciled: invReconciled },
          });
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
