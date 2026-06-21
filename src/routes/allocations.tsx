import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, ledgerModeQuery } from "@/components/AppShell";
import { ICBS, NHS_HEADLINE, TRUSTS, gbp, partyDhsc, partyIcb, partyNhsE } from "@/lib/nhs/data";
import {
  allocateFromDhsc,
  allocateToIcb,
  allocateToTrust,
  getAllocationsForParty,
} from "@/lib/nhs/canton.functions";

const sameParty = (p: string, name: string) => p === name || p.startsWith(`${name}::`);


const nhseAllocationsQuery = queryOptions({
  queryKey: ["alloc", "NHSE"],
  queryFn: () => getAllocationsForParty({ data: { party: partyNhsE() } }),
});
const dhscAllocationsQuery = queryOptions({
  queryKey: ["alloc", "DHSC"],
  queryFn: () => getAllocationsForParty({ data: { party: partyDhsc() } }),
});

export const Route = createFileRoute("/allocations")({
  head: () => ({
    meta: [
      { title: "Allocations · NHS Ledger" },
      { name: "description", content: "DHSC → NHS England → ICB → Trust allocation cockpit on Canton." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(ledgerModeQuery);
    context.queryClient.ensureQueryData(nhseAllocationsQuery);
    context.queryClient.ensureQueryData(dhscAllocationsQuery);
  },
  component: AllocationsPage,
});

function AllocationsPage() {
  const qc = useQueryClient();
  const { data: dhscOut } = useSuspenseQuery(dhscAllocationsQuery);
  const { data: nhseIn } = useSuspenseQuery(nhseAllocationsQuery);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["alloc"] }).then(() =>
    qc.invalidateQueries({ queryKey: ["canton"] }),
  );

  const fromDhsc = useServerFn(allocateFromDhsc);
  const toIcbFn = useServerFn(allocateToIcb);
  const toTrustFn = useServerFn(allocateToTrust);

  const onErr = (label: string) => (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    toast.error(`${label} failed`, { description: msg });
  };
  const onOk = (label: string) => () => {
    toast.success(`${label} submitted to Canton`);
    void invalidate();
  };
  const mDhsc = useMutation({ mutationFn: fromDhsc, onSuccess: onOk("DHSC → NHSE"), onError: onErr("DHSC → NHSE") });
  const mIcb = useMutation({ mutationFn: toIcbFn, onSuccess: onOk("NHSE → ICB"), onError: onErr("NHSE → ICB") });
  const mTrust = useMutation({ mutationFn: toTrustFn, onSuccess: onOk("ICB → Trust"), onError: onErr("ICB → Trust") });

  const [dhscAmount, setDhscAmount] = useState("168800000000");
  const [icbCode, setIcbCode] = useState(ICBS[0]!.code);
  const [icbAmount, setIcbAmount] = useState(String(ICBS[0]!.allocationGbp));
  const [trustIcb, setTrustIcb] = useState(TRUSTS[0]!.icb);
  const [trustCode, setTrustCode] = useState(TRUSTS[0]!.code);
  const [trustAmount, setTrustAmount] = useState("250000000");

  const { data: icbOut = [] } = useQuery({
    queryKey: ["alloc", "ICB", trustIcb],
    queryFn: () => getAllocationsForParty({ data: { party: partyIcb(trustIcb) } }),
  });

  return (
    <AppShell>
      <h1 className="text-3xl font-bold tracking-tight">Allocation cockpit</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Move funds down the NHS chain. Each click creates a <code>Nhs:BudgetAllocation</code> contract on
        Canton, signed by the allocator and disclosed to the recipient only.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card
          step="1"
          title="DHSC → NHS England"
          subtitle={`Fiscal year ${NHS_HEADLINE.fiscalYear} envelope`}
        >
          <Field label="Amount (GBP)">
            <input
              className="input"
              value={dhscAmount}
              onChange={(e) => setDhscAmount(e.target.value)}
            />
          </Field>
          <Button
            loading={mDhsc.isPending}
            onClick={() =>
              mDhsc.mutate({ data: { amountGbp: dhscAmount, purpose: "Annual mandate" } })
            }
          >
            Allocate {gbp(Number(dhscAmount) || 0)}
          </Button>
          <ErrLine m={mDhsc} />
          <Ledger title="DHSC outgoing" rows={dhscOut} />
        </Card>

        <Card step="2" title="NHS England → ICB" subtitle="Per-region sub-allocation">
          <Field label="ICB">
            <select className="input" value={icbCode} onChange={(e) => setIcbCode(e.target.value)}>
              {ICBS.map((i) => (
                <option key={i.code} value={i.code}>
                  {i.code} — {i.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount (GBP)">
            <input className="input" value={icbAmount} onChange={(e) => setIcbAmount(e.target.value)} />
          </Field>
          <Button
            loading={mIcb.isPending}
            onClick={() =>
              mIcb.mutate({
                data: { icbCode, amountGbp: icbAmount, purpose: `Core allocation ${icbCode}` },
              })
            }
          >
            Allocate to ICB::{icbCode}
          </Button>
          <ErrLine m={mIcb} />
          <Ledger title="NHS England outgoing" rows={nhseIn.filter((c) => sameParty(c.payload.allocator, "NHSEngland"))} />
        </Card>

        <Card step="3" title="ICB → Trust" subtitle="Commission a provider">
          <Field label="ICB">
            <select
              className="input"
              value={trustIcb}
              onChange={(e) => {
                setTrustIcb(e.target.value);
                const first = TRUSTS.find((t) => t.icb === e.target.value);
                if (first) setTrustCode(first.code);
              }}
            >
              {ICBS.map((i) => (
                <option key={i.code} value={i.code}>
                  {i.code}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Trust">
            <select className="input" value={trustCode} onChange={(e) => setTrustCode(e.target.value)}>
              {TRUSTS.filter((t) => t.icb === trustIcb).map((t) => (
                <option key={t.code} value={t.code}>
                  {t.code} — {t.name}
                </option>
              ))}
              {TRUSTS.filter((t) => t.icb === trustIcb).length === 0 && (
                <option value="">No demo trust seeded for this ICB</option>
              )}
            </select>
          </Field>
          <Field label="Amount (GBP)">
            <input
              className="input"
              value={trustAmount}
              onChange={(e) => setTrustAmount(e.target.value)}
            />
          </Field>
          <Button
            loading={mTrust.isPending}
            disabled={!trustCode}
            onClick={() =>
              mTrust.mutate({
                data: {
                  icbCode: trustIcb,
                  trustCode,
                  amountGbp: trustAmount,
                  purpose: `Commissioning Trust::${trustCode}`,
                },
              })
            }
          >
            Allocate to Trust::{trustCode || "?"}
          </Button>
          <ErrLine m={mTrust} />
          <p className="mt-3 break-words text-xs text-muted-foreground">
            Privacy: this contract is only disclosed to ICB::{trustIcb} and Trust::{trustCode}.
            Other ICBs see nothing.
          </p>
          <Ledger
            title={`ICB::${trustIcb} outgoing`}
            rows={icbOut.filter((c) => sameParty(c.payload.allocator, `ICB-${trustIcb}`))}
          />
        </Card>
      </div>

      <style>{`
        .input { width: 100%; border-radius: 0.5rem; border: 1px solid var(--border);
          background: var(--background); padding: 0.5rem 0.75rem; font-size: 0.875rem; }
        .input:focus { outline: 2px solid var(--ring); outline-offset: 1px; }
      `}</style>
    </AppShell>
  );
}

function Card({
  step,
  title,
  subtitle,
  children,
}: {
  step: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-primary">{step}</span>
        Step
      </div>
      <h3 className="mt-2 text-lg font-semibold">{title}</h3>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Button({
  children,
  onClick,
  loading,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="w-full whitespace-normal break-words rounded-md bg-primary px-4 py-2 text-sm font-medium leading-tight text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
    >
      {loading ? "Submitting to Canton…" : children}
    </button>
  );
}

function shortParty(p: string): string {
  const idx = p.indexOf("::");
  if (idx === -1) return p;
  const name = p.slice(0, idx);
  const fp = p.slice(idx + 2);
  if (fp.length <= 12) return p;
  return `${name}::${fp.slice(0, 6)}…${fp.slice(-4)}`;
}

function Ledger({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ contractId: string; payload: { recipient: string; amountGbp: string; purpose: string } }>;
}) {
  return (
    <div className="mt-4 min-w-0">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</div>
      {rows.length === 0 ? (
        <p className="mt-2 rounded-md border border-dashed border-border bg-muted/40 px-2 py-2 text-xs text-muted-foreground">
          No allocations yet for this party.
        </p>
      ) : (
        <ul className="mt-2 space-y-1 text-xs">
          {rows.slice(-4).map((r) => (
            <li key={r.contractId} className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-muted px-2 py-1">
              <span className="min-w-0 flex-1 truncate font-mono">{shortParty(r.payload.recipient)}</span>
              <span className="shrink-0 font-semibold">{gbp(r.payload.amountGbp)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ErrLine({ m }: { m: { isError: boolean; error: unknown } }) {
  if (!m.isError) return null;
  const raw = m.error instanceof Error ? m.error.message : String(m.error);
  const isUnknownInformees = raw.includes("UNKNOWN_INFORMEES");
  const isSecuritySensitive =
    raw.includes("security-sensitive") || (raw.includes(" 403") && raw.includes("/v2/commands/"));
  const needsDeploy =
    isUnknownInformees || isSecuritySensitive || raw.includes("has not been allocated yet");
  const friendly = isUnknownInformees
    ? "Party is allocated on the participant but not yet registered on the Devnet global synchronizer. Re-run Deploy to onboard parties to the synchronizer, then retry."
    : isSecuritySensitive
      ? "Canton rejected the command (403). The runtime token's user id does not match the ledger user that holds CanActAs rights for this party. Re-run Deploy — it now creates the user under the token's subject and re-grants rights."
      : raw.length > 240
        ? `${raw.slice(0, 240)}…`
        : raw;
  return (
    <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive">
      <p className="break-words">{friendly}</p>
      {needsDeploy && (
        <a
          href="/deploy"
          className="mt-2 inline-flex items-center rounded-md bg-destructive px-2 py-1 text-[11px] font-medium text-destructive-foreground hover:opacity-90"
        >
          Open Deploy →
        </a>
      )}
      {(isUnknownInformees || isSecuritySensitive || raw.length > 240) && (
        <details className="mt-1">
          <summary className="cursor-pointer text-[10px] uppercase tracking-wider opacity-70">
            Raw error
          </summary>
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-relaxed opacity-80">
            {raw}
          </pre>
        </details>
      )}
    </div>
  );
}
