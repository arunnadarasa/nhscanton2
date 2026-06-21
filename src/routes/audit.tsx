import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";

import { AppShell, ledgerModeQuery } from "@/components/AppShell";
import { gbp, partyAuditor } from "@/lib/nhs/data";
import { getReconciledForParty } from "@/lib/nhs/canton.functions";

const auditQuery = queryOptions({
  queryKey: ["recon", "auditor"],
  queryFn: () => getReconciledForParty({ data: { party: partyAuditor() } }),
  staleTime: 2_000,
});

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit stream · NHS Ledger" },
      { name: "description", content: "Read-only stream of reconciled NHS spend disclosed to the National Audit Office." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(ledgerModeQuery);
    context.queryClient.ensureQueryData(auditQuery);
  },
  component: AuditPage,
});

function AuditPage() {
  const { data } = useSuspenseQuery(auditQuery);
  const total = data.reduce((s, c) => s + parseFloat(c.payload.amountGbp), 0);

  const byCat = data.reduce<Record<string, number>>((acc, c) => {
    acc[c.payload.category] = (acc[c.payload.category] ?? 0) + parseFloat(c.payload.amountGbp);
    return acc;
  }, {});

  return (
    <AppShell>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">National Audit Office</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Reconciled spend stream</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Only co-signed <code>Nhs:ReconciledSpend</code> contracts are disclosed to the auditor party.
          Unreconciled commitments stay private to the Trust and its commissioning ICB.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Reconciled total</div>
          <div className="mt-2 text-3xl font-bold">{gbp(total)}</div>
          <div className="mt-1 text-xs text-muted-foreground">{data.length} co-signed contracts</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">By category</div>
          <ul className="mt-2 space-y-1 text-sm">
            {Object.entries(byCat).map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span>{k}</span>
                <span className="font-semibold">{gbp(v)}</span>
              </li>
            ))}
            {Object.keys(byCat).length === 0 && (
              <li className="text-muted-foreground">No reconciled spend yet — countersign a commitment in an ICB cockpit.</li>
            )}
          </ul>
        </div>
      </div>

      <section className="mt-10 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Disclosed contracts</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2">Contract</th>
                <th>Trust</th>
                <th>Commissioner</th>
                <th>Category</th>
                <th>Period</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((c) => (
                <tr key={c.contractId}>
                  <td className="py-2 font-mono text-xs">{c.contractId.slice(0, 14)}…</td>
                  <td>{c.payload.trust}</td>
                  <td>{c.payload.commissioner}</td>
                  <td>{c.payload.category}</td>
                  <td>{c.payload.period}</td>
                  <td className="text-right font-semibold">{gbp(c.payload.amountGbp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
