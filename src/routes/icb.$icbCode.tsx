import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AppShell, ledgerModeQuery } from "@/components/AppShell";
import { ICBS, TRUSTS, gbp, partyIcb } from "@/lib/nhs/data";
import {
  countersignCommitment,
  countersignInvoiceFn,
  getAllocationsForParty,
  getCommitmentsForParty,
  getInvoicesForParty,
} from "@/lib/nhs/canton.functions";

export const Route = createFileRoute("/icb/$icbCode")({
  head: ({ params }) => ({
    meta: [
      { title: `ICB ${params.icbCode} cockpit · NHS Ledger` },
      { name: "description", content: `Integrated Care Board ${params.icbCode} commissioning cockpit on Canton.` },
    ],
  }),
  loader: ({ context, params }) => {
    const icb = ICBS.find((i) => i.code === params.icbCode);
    if (!icb) throw notFound();
    const party = partyIcb(icb.code);
    context.queryClient.ensureQueryData(ledgerModeQuery);
    context.queryClient.ensureQueryData(
      queryOptions({
        queryKey: ["alloc", "icb", icb.code],
        queryFn: () => getAllocationsForParty({ data: { party } }),
      }),
    );
    context.queryClient.ensureQueryData(
      queryOptions({
        queryKey: ["commit", "icb", icb.code],
        queryFn: () => getCommitmentsForParty({ data: { party } }),
      }),
    );
  },
  component: IcbPage,
  notFoundComponent: () => (
    <AppShell>
      <p className="text-muted-foreground">ICB not found.</p>
    </AppShell>
  ),
});

function IcbPage() {
  const { icbCode } = Route.useParams();
  const icb = ICBS.find((i) => i.code === icbCode)!;
  const party = partyIcb(icb.code);
  const qc = useQueryClient();

  const allocations = useSuspenseQuery(
    queryOptions({
      queryKey: ["alloc", "icb", icb.code],
      queryFn: () => getAllocationsForParty({ data: { party } }),
    }),
  ).data;
  const pending = useSuspenseQuery(
    queryOptions({
      queryKey: ["commit", "icb", icb.code],
      queryFn: () => getCommitmentsForParty({ data: { party } }),
    }),
  ).data;

  const sign = useServerFn(countersignCommitment);
  const m = useMutation({
    mutationFn: sign,
    onSuccess: () =>
      qc.invalidateQueries({ predicate: (q) => ["commit", "recon", "canton"].includes(q.queryKey[0] as string) }),
  });

  const totalIn = allocations
    .filter((a) => a.payload.recipient === party)
    .reduce((s, a) => s + parseFloat(a.payload.amountGbp), 0);
  const totalOut = allocations
    .filter((a) => a.payload.allocator === party)
    .reduce((s, a) => s + parseFloat(a.payload.amountGbp), 0);

  const trustsHere = TRUSTS.filter((t) => t.icb === icb.code);

  return (
    <AppShell>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Integrated Care Board</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{icb.name} ({icb.code})</h1>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Stat label="Incoming from NHSE" value={gbp(totalIn)} />
        <Stat label="Allocated onward" value={gbp(totalOut)} />
        <Stat label="Indicative envelope" value={gbp(icb.allocationGbp)} />
      </div>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-border bg-card p-5 md:p-6">
          <h2 className="text-lg font-semibold">Trusts commissioned</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {trustsHere.map((t) => (
              <li key={t.code} className="flex items-center justify-between gap-3 py-2">
                <Link to="/trust/$trustId" params={{ trustId: t.code }} className="min-w-0 flex-1 hover:underline">
                  <div className="truncate font-medium">{t.name}</div>
                  <div className="truncate text-xs text-muted-foreground">Trust::{t.code}</div>
                </Link>
                <div className={`shrink-0 text-sm font-semibold ${t.deficitGbp < 0 ? "text-destructive" : "text-emerald-600"}`}>
                  {gbp(t.deficitGbp)}
                </div>
              </li>
            ))}
            {trustsHere.length === 0 && (
              <li className="py-4 text-muted-foreground">No demo trusts seeded for this ICB.</li>
            )}
          </ul>
        </div>

        <div className="min-w-0 rounded-2xl border border-border bg-card p-5 md:p-6">
          <h2 className="text-lg font-semibold">Pending spend commitments</h2>
          <p className="text-xs text-muted-foreground">
            From your commissioned trusts. Countersigning creates a co-signed{" "}
            <code className="break-all"> Nhs:ReconciledSpend</code> visible to the auditor.
          </p>
          <ul className="mt-3 divide-y divide-border text-sm">
            {pending.length === 0 && (
              <li className="py-4 text-muted-foreground">No commitments awaiting countersign.</li>
            )}
            {pending.map((c) => (
              <li key={c.contractId} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {c.payload.category} · <span className="text-muted-foreground">{c.payload.period}</span>
                  </div>
                  <div className="break-all font-mono text-[11px] leading-snug text-muted-foreground">{c.payload.trust}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-semibold">{gbp(c.payload.amountGbp)}</div>
                  <button
                    disabled={m.isPending}
                    onClick={() => m.mutate({ data: { contractId: c.contractId, icbCode: icb.code } })}
                    className="mt-1 rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    Countersign
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
