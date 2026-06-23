// TEMP smoke test: end-to-end Invoice → ReconciledSpend on the live ledger.
import { createFileRoute } from "@tanstack/react-router";

import type { Invoice } from "@/lib/canton/types";

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
          const invoiceRef = `SMOKE-${ts}`;
          const created = await c.createInvoice({
            trust: partyTrust(trustCode),
            commissioner: partyIcb(icbCode),
            auditor: partyAuditor(),
            invoiceRef,
            category: "Smoke Test",
            amountGbp: "1234.56",
            period: "2026-06",
            supplier: "Lovable Smoke Co",
          });
          const visible = await c.queryInvoices(partyIcb(icbCode));
          const found = visible.find(
            (v: { contractId: string; payload: Invoice }) => v.contractId === created.contractId,
          );
          if (!found) {
            return Response.json(
              { step: "query-invoice-as-icb", created, visibleCount: visible.length },
              { status: 500 },
            );
          }
          const reconciled = await c.countersignInvoice(found);
          return Response.json({ ok: true, invoiceRef, invoice: created, reconciled });
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
