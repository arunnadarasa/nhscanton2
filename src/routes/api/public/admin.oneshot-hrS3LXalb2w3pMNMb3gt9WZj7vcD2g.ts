// TEMP one-shot endpoint. Path acts as the secret. Delete after use.
// Runs runDeploy then the SpendCommitment + Invoice smoke sequence against
// the configured live ledger.
import { createFileRoute } from "@tanstack/react-router";
import type { Invoice, SpendCommitment } from "@/lib/canton/types";

export const Route = createFileRoute(
  "/api/public/admin/oneshot-hrS3LXalb2w3pMNMb3gt9WZj7vcD2g",
)({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const out: Record<string, unknown> = {};
        try {
          const url = new URL(request.url);
          const baseUrl = `${url.protocol}//${url.host}`;
          const { runDeploy } = await import("@/lib/canton/deploy-core.server");
          const deployRes = await runDeploy({ baseUrl });
          out.deploy = {
            status: deployRes.status,
            body: await deployRes.clone().json().catch(async () => deployRes.clone().text()),
          };
          if (!deployRes.ok) {
            return Response.json({ ok: false, ...out }, { status: 500 });
          }

          const c = await import("@/lib/canton/client.server");
          const { partyTrust, partyIcb, partyAuditor } = await import("@/lib/nhs/data");
          const ts = Date.now();
          const trust = partyTrust("GSTT");
          const commissioner = partyIcb("LDN");
          const auditor = partyAuditor();

          const sc = await c.createSpendCommitment({
            trust, commissioner, auditor, category: `SMOKE-SC-${ts}`,
            amountGbp: "1234.56", period: "2026-06",
          });
          const scVisible = await c.querySpendCommitments(commissioner);
          const scFound = scVisible.find(
            (v: { contractId: string; payload: SpendCommitment }) =>
              v.contractId === sc.contractId,
          );
          if (!scFound) {
            return Response.json(
              { ok: false, step: "query-sc-as-icb", sc, ...out },
              { status: 500 },
            );
          }
          const scReconciled = await c.countersign(scFound);
          out.spendCommitment = { commitment: sc, reconciled: scReconciled };

          const inv = await c.createInvoice({
            trust, commissioner, auditor,
            invoiceRef: `SMOKE-INV-${ts}`,
            category: "Smoke Test", amountGbp: "9876.54", period: "2026-06",
            supplier: "Lovable Smoke Co",
          });
          const invVisible = await c.queryInvoices(commissioner);
          const invFound = invVisible.find(
            (v: { contractId: string; payload: Invoice }) =>
              v.contractId === inv.contractId,
          );
          if (!invFound) {
            return Response.json(
              { ok: false, step: "query-invoice-as-icb", inv, ...out },
              { status: 500 },
            );
          }
          const invReconciled = await c.countersignInvoice(invFound);
          out.invoice = { invoice: inv, reconciled: invReconciled };

          return Response.json({ ok: true, ...out });
        } catch (e) {
          return Response.json(
            {
              ok: false,
              error: e instanceof Error ? e.message : String(e),
              stack: e instanceof Error ? e.stack : undefined,
              ...out,
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
