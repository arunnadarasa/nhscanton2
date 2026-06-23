import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, ledgerModeQuery } from "@/components/AppShell";
import { TRUSTS, gbp, partyTrust } from "@/lib/nhs/data";
import {
  getAllocationsForParty,
  getCommitmentsForParty,
  getInvoicesForParty,
  getReconciledForParty,
  getUsdcxBalance,
  settleSupplierPayment,
  submitInvoice,
  submitSpendCommitment,
} from "@/lib/nhs/canton.functions";

export const Route = createFileRoute("/trust/$trustId")({
  head: ({ params }) => ({
    meta: [
      { title: `Trust ${params.trustId} · NHS Ledger` },
      {
        name: "description",
        content: `Canton-backed spend commitments and reconciled allocations for NHS Trust ${params.trustId}.`,
      },
    ],
  }),
  loader: ({ context, params }) => {
    const trust = TRUSTS.find((t) => t.code === params.trustId);
    if (!trust) throw notFound();
    const party = partyTrust(trust.code);
    context.queryClient.ensureQueryData(ledgerModeQuery);
    context.queryClient.ensureQueryData(
      queryOptions({
        queryKey: ["alloc", "trust", trust.code],
        queryFn: () => getAllocationsForParty({ data: { party } }),
      }),
    );
    context.queryClient.ensureQueryData(
      queryOptions({
        queryKey: ["commit", "trust", trust.code],
        queryFn: () => getCommitmentsForParty({ data: { party } }),
      }),
    );
    context.queryClient.ensureQueryData(
      queryOptions({
        queryKey: ["recon", "trust", trust.code],
        queryFn: () => getReconciledForParty({ data: { party } }),
      }),
    );
    context.queryClient.ensureQueryData(
      queryOptions({
        queryKey: ["usdcx", "trust", trust.code],
        queryFn: () => getUsdcxBalance({ data: { party } }),
      }),
    );
    context.queryClient.ensureQueryData(
      queryOptions({
        queryKey: ["invoice", "trust", trust.code],
        queryFn: () => getInvoicesForParty({ data: { party } }),
      }),
    );
  },
  component: TrustPage,
  notFoundComponent: () => (
    <AppShell>
      <p className="text-muted-foreground">Trust not found.</p>
    </AppShell>
  ),
});

function TrustPage() {
  const { trustId } = Route.useParams();
  const trust = TRUSTS.find((t) => t.code === trustId)!;
  const party = partyTrust(trust.code);
  const qc = useQueryClient();

  const mode = useSuspenseQuery(ledgerModeQuery).data;
  const allocations = useSuspenseQuery(
    queryOptions({
      queryKey: ["alloc", "trust", trust.code],
      queryFn: () => getAllocationsForParty({ data: { party } }),
    }),
  ).data;
  const commitments = useSuspenseQuery(
    queryOptions({
      queryKey: ["commit", "trust", trust.code],
      queryFn: () => getCommitmentsForParty({ data: { party } }),
    }),
  ).data;
  const reconciled = useSuspenseQuery(
    queryOptions({
      queryKey: ["recon", "trust", trust.code],
      queryFn: () => getReconciledForParty({ data: { party } }),
    }),
  ).data;
  const usdcx = useSuspenseQuery(
    queryOptions({
      queryKey: ["usdcx", "trust", trust.code],
      queryFn: () => getUsdcxBalance({ data: { party } }),
    }),
  ).data;

  const submit = useServerFn(submitSpendCommitment);
  const m = useMutation({
    mutationFn: submit,
    onSuccess: () => {
      toast.success("Commitment submitted to Canton");
      qc.invalidateQueries({
        predicate: (q) => ["commit", "canton"].includes(q.queryKey[0] as string),
      });
    },
    onError: (e) => toast.error("Submit failed", { description: (e as Error).message }),
  });

  const settle = useServerFn(settleSupplierPayment);
  const settleM = useMutation({
    mutationFn: settle,
    onSuccess: () => {
      toast.success("USDCx settlement confirmed");
      qc.invalidateQueries({
        predicate: (q) =>
          ["commit", "recon", "usdcx"].includes(q.queryKey[0] as string),
      });
    },
    onError: (e) => toast.error("Settlement failed", { description: (e as Error).message }),
  });

  const [category, setCategory] = useState("Staff");
  const [amount, setAmount] = useState("12000000");
  const [period, setPeriod] = useState("2024-Q4");
  const [supplier, setSupplier] = useState("");

  const incoming = allocations.reduce((s, a) => s + parseFloat(a.payload.amountGbp), 0);
  const committed = commitments.reduce((s, a) => s + parseFloat(a.payload.amountGbp), 0);
  const reconciledTotal = reconciled.reduce((s, a) => s + parseFloat(a.payload.amountGbp), 0);

  const settleable = commitments.filter((c) => c.payload.supplier);

  const usdcxLabel =
    mode.usdcx === "configured"
      ? "USDCx live on DevNet"
      : mode.usdcx === "simulated"
        ? "USDCx simulated"
        : "USDCx not configured";
  const usdcxTone =
    mode.usdcx === "configured"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
      : mode.usdcx === "simulated"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
        : "border-muted-foreground/40 bg-muted text-muted-foreground";

  return (
    <AppShell>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Trust · commissioned by ICB::{trust.icb}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{trust.name}</h1>
        </div>
        <Link to="/icb/$icbCode" params={{ icbCode: trust.icb }} className="text-sm text-primary hover:underline">
          → ICB cockpit
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Stat label="Incoming allocations" value={gbp(incoming)} />
        <Stat label="Pending commitments" value={gbp(committed)} />
        <Stat label="Reconciled spend" value={gbp(reconciledTotal)} />
        <Stat label="Reported deficit" value={gbp(trust.deficitGbp)} warn={trust.deficitGbp < 0} />
      </div>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Submit spend commitment</h2>
          <p className="text-xs text-muted-foreground">
            Creates <code>Nhs:SpendCommitment</code>. Disclosed to ICB::{trust.icb} only,
            until they countersign — then auditor is added as observer.
            Add a supplier party to make it settleable atomically with USDCx.
          </p>
          <div className="mt-4 space-y-3">
            <Row>
              <label className="text-xs">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
                {["Staff", "Drugs", "Estates", "Commissioned services", "Other"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Row>
            <Row>
              <label className="text-xs">Amount (GBP)</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} className="input" />
            </Row>
            <Row>
              <label className="text-xs">Period</label>
              <input value={period} onChange={(e) => setPeriod(e.target.value)} className="input" />
            </Row>
            <Row>
              <label className="text-xs">
                Supplier party <span className="text-muted-foreground">(optional — enables USDCx settlement)</span>
              </label>
              <input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="e.g. Supplier::AcmePharma"
                className="input"
              />
            </Row>
            <button
              onClick={() =>
                m.mutate({
                  data: {
                    trustCode: trust.code,
                    icbCode: trust.icb,
                    category,
                    amountGbp: amount,
                    period,
                    supplier: supplier.trim() ? supplier.trim() : undefined,
                  },
                })
              }
              disabled={m.isPending}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {m.isPending ? "Signing on Canton…" : "Submit to commissioner"}
            </button>
            {m.isError && (
              <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                {(m.error as Error).message}
              </div>
            )}
          </div>
          <ul className="mt-4 divide-y divide-border text-sm">
            {commitments.length === 0 && (
              <li className="py-2 text-xs text-muted-foreground">No commitments yet.</li>
            )}
            {commitments.map((c) => (
              <li key={c.contractId} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium">{c.payload.category}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {c.payload.period}
                    {c.payload.supplier && <> · → {c.payload.supplier}</>}
                  </div>
                </div>
                <div className="font-mono text-sm font-semibold">{gbp(c.payload.amountGbp)}</div>
              </li>
            ))}
          </ul>
        </div>


        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Supplier settlement · USDCx</h2>
              <p className="text-xs text-muted-foreground">
                Atomic DvP on Canton: one transaction transfers wrapped-USDC to the
                supplier <em>and</em> creates <code>Nhs:ReconciledSpend</code>. Either both
                legs commit or both revert.
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${usdcxTone}`}
            >
              {usdcxLabel}
            </span>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-background/60 px-4 py-3 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Trust USDCx balance
              </span>
              <span className="font-mono text-lg font-semibold">
                {gbp(usdcx.amount)}
              </span>
            </div>
            {mode.usdcx === "not-configured" && (
              <p className="mt-2 text-xs text-muted-foreground">
                Set <code>CANTON_USDCX_PACKAGE_ID</code> to enable live settlement.
                See <code>docs/canton-deploy/06-usdcx.md</code>.
              </p>
            )}
          </div>

          <ul className="mt-4 divide-y divide-border text-sm">
            {settleable.length === 0 && (
              <li className="py-4 text-muted-foreground">
                No settleable commitments — submit one above with a supplier party set.
              </li>
            )}
            {settleable.map((c) => (
              <li key={c.contractId} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="font-medium">{c.payload.category}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    → {c.payload.supplier} · {c.payload.period}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-mono text-sm font-semibold">
                    {gbp(c.payload.amountGbp)}
                  </div>
                  <button
                    onClick={() =>
                      settleM.mutate({
                        data: { contractId: c.contractId, trustCode: trust.code },
                      })
                    }
                    disabled={
                      settleM.isPending ||
                      mode.usdcx === "not-configured" ||
                      parseFloat(c.payload.amountGbp) > usdcx.amount
                    }
                    className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                    title={
                      parseFloat(c.payload.amountGbp) > usdcx.amount
                        ? "Insufficient USDCx balance"
                        : "Atomic settle: USDCx transfer + countersign"
                    }
                  >
                    {settleM.isPending ? "Settling…" : "Settle with USDCx"}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {settleM.isSuccess && settleM.data && (
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
              <div className="font-semibold text-emerald-700">Settlement confirmed</div>
              <div className="mt-1 font-mono text-muted-foreground">
                tx: {settleM.data.settlementTxId}
              </div>
              <div className="font-mono text-muted-foreground">
                ReconciledSpend cid: {settleM.data.reconciled.contractId}
              </div>
            </div>
          )}
          {settleM.isError && (
            <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {(settleM.error as Error).message}
            </div>
          )}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Reconciled spend ledger</h2>
        <p className="text-xs text-muted-foreground">
          Co-signed by Trust + ICB. Auditor has read access. Supplier-settled rows
          carry the USDCx transaction id.
        </p>
        <ul className="mt-3 divide-y divide-border text-sm">
          {reconciled.length === 0 && (
            <li className="py-4 text-muted-foreground">No reconciled spend yet.</li>
          )}
          {reconciled.map((r) => (
            <li key={r.contractId} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="font-medium">{r.payload.category}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {r.payload.period}
                  {r.payload.supplier && <> · settled → {r.payload.supplier}</>}
                  {r.payload.settlementTxId && (
                    <> · <span className="font-mono">{r.payload.settlementTxId}</span></>
                  )}
                </div>
              </div>
              <div className="font-semibold">{gbp(r.payload.amountGbp)}</div>
            </li>
          ))}
        </ul>
      </section>

      <style>{`
        .input { width: 100%; border-radius: 0.5rem; border: 1px solid var(--border);
          background: var(--background); padding: 0.5rem 0.75rem; font-size: 0.875rem; }
      `}</style>
    </AppShell>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${warn ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1">{children}</div>;
}
