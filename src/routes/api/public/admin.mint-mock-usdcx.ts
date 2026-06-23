// One-shot admin route: mint mock-USDCx Holdings for every Trust party.
// Idempotent in spirit (creates a fresh Holding per call — re-running just
// gives each Trust more balance), but token-gated so it can't be hit by
// random callers on the published site.
//
// Requirements before calling:
//   * mock-usdcx-1.0.0.dar uploaded to the participant
//   * nhs-budget-app-v2-1.0.2.dar uploaded
//   * CANTON_USDCX_PACKAGE_ID set (e.g. "#mock-usdcx" or the package hash)
//   * CANTON_USDCX_TEMPLATE set to "MockUsdcx:Holding" (default)
//   * Optional: CANTON_USDCX_ISSUER overrides the issuer party (defaults to Auditor)
//
// Body (optional): { "amountPerTrust": "200000000.00" }
import { createFileRoute } from "@tanstack/react-router";

import { requireDeployToken } from "@/lib/canton/admin-guard.server";

export const Route = createFileRoute("/api/public/admin/mint-mock-usdcx")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = requireDeployToken(request);
        if (denied) return denied;
        try {
          let amountPerTrust = "200000000.00";
          try {
            const body = (await request.json()) as { amountPerTrust?: string };
            if (body?.amountPerTrust) amountPerTrust = body.amountPerTrust;
          } catch {
            // empty body is fine — use the default
          }

          const { liveMintMockUsdcx, isUsdcxConfigured } = await import(
            "@/lib/canton/live.server"
          );
          if (!isUsdcxConfigured()) {
            return Response.json(
              {
                ok: false,
                error:
                  "CANTON_USDCX_PACKAGE_ID not set. Upload mock-usdcx-1.0.0.dar to the participant, then set the secret.",
              },
              { status: 412 },
            );
          }

          const { TRUSTS, partyTrust } = await import("@/lib/nhs/data");

          const results: Array<{
            code: string;
            party: string;
            ok: boolean;
            contractId?: string;
            issuer?: string;
            error?: string;
          }> = [];

          for (const t of TRUSTS) {
            const party = partyTrust(t.code);
            try {
              const minted = await liveMintMockUsdcx(party, amountPerTrust);
              results.push({
                code: t.code,
                party,
                ok: true,
                contractId: minted.contractId,
                issuer: minted.issuer,
              });
            } catch (e) {
              results.push({
                code: t.code,
                party,
                ok: false,
                error: e instanceof Error ? e.message : String(e),
              });
            }
          }

          const allOk = results.every((r) => r.ok);
          return Response.json(
            { ok: allOk, amountPerTrust, results },
            { status: allOk ? 200 : 500 },
          );
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
