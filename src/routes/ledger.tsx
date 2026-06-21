import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo } from "react";

import { AppShell, ledgerModeQuery } from "@/components/AppShell";
import { gbp } from "@/lib/nhs/data";
import { getAllContracts } from "@/lib/nhs/canton.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const q = queryOptions({
  queryKey: ["canton", "explorer"],
  queryFn: () => getAllContracts(),
  staleTime: 2_000,
});

const SORT_KEYS = ["created", "template", "contractId"] as const;
const ORDERS = ["asc", "desc"] as const;

const searchSchema = z.object({
  sort: fallback(z.enum(SORT_KEYS), "created").default("created"),
  order: fallback(z.enum(ORDERS), "desc").default("desc"),
});

export const Route = createFileRoute("/ledger")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Ledger explorer · NHS Ledger" },
      { name: "description", content: "Raw Canton contract explorer for the NHS budget app." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(ledgerModeQuery);
    context.queryClient.ensureQueryData(q);
  },
  component: LedgerPage,
});

function shortParty(p: string): string {
  const idx = p.indexOf("::");
  if (idx === -1) return p;
  const name = p.slice(0, idx);
  const fp = p.slice(idx + 2);
  if (fp.length <= 14) return p;
  return `${name}::${fp.slice(0, 6)}…${fp.slice(-4)}`;
}

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PartyList({ parties }: { parties: string[] }) {
  if (parties.length === 0) return <div className="text-sm text-muted-foreground">—</div>;
  return (
    <ul className="mt-1 flex flex-col gap-1">
      {parties.map((p) => (
        <li
          key={p}
          title={p}
          className="break-all rounded-md bg-muted px-2 py-1 font-mono text-xs"
        >
          {shortParty(p)}
        </li>
      ))}
    </ul>
  );
}

function LedgerPage() {
  const { data } = useSuspenseQuery(q);
  const { sort, order } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const sorted = useMemo(() => {
    const arr = [...data];
    const dir = order === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      if (sort === "created") {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sort === "template") {
        cmp = a.templateId.localeCompare(b.templateId);
      } else {
        cmp = a.contractId.localeCompare(b.contractId);
      }
      return cmp * dir;
    });
    return arr;
  }, [data, sort, order]);

  const orderLabels: Record<typeof sort, { asc: string; desc: string }> = {
    created: { asc: "Oldest first", desc: "Newest first" },
    template: { asc: "A → Z", desc: "Z → A" },
    contractId: { asc: "A → Z", desc: "Z → A" },
  };

  return (
    <AppShell>
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight">Ledger explorer</h1>
        <p className="mt-2 text-muted-foreground">
          All active contracts in the Canton ledger. In live mode this view is filtered by the auditor's disclosure;
          in simulated mode it shows the full demo state (privacy is still enforced at every other endpoint).
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Sort by</label>
            <Select
              value={sort}
              onValueChange={(v) =>
                navigate({ search: { sort: v as typeof sort, order } })
              }
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created">Created</SelectItem>
                <SelectItem value="template">Template</SelectItem>
                <SelectItem value="contractId">Contract ID</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Order</label>
            <Select
              value={order}
              onValueChange={(v) =>
                navigate({ search: { sort, order: v as typeof order } })
              }
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">{orderLabels[sort].desc}</SelectItem>
                <SelectItem value="asc">{orderLabels[sort].asc}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground sm:ml-auto sm:pb-2">
            {sorted.length} {sorted.length === 1 ? "contract" : "contracts"}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {sorted.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
              No contracts yet. Open the allocation cockpit to create some.
            </div>
          )}
          {sorted.map((c) => (
            <div
              key={c.contractId}
              className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                <div className="min-w-0 break-all font-mono text-xs text-muted-foreground">
                  {c.contractId}
                </div>
                <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                  <div className="w-fit rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {c.templateId}
                  </div>
                  <div className="text-xs text-muted-foreground" title={c.createdAt}>
                    {formatCreatedAt(c.createdAt)}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Signatories</div>
                  <PartyList parties={c.signatories} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Observers</div>
                  <PartyList parties={c.observers} />
                </div>
              </div>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-[11px] sm:text-xs">
{JSON.stringify(
  {
    ...c.payload,
    ...("amountGbp" in c.payload ? { amountGbp_fmt: gbp((c.payload as { amountGbp: string }).amountGbp) } : {}),
  },
  null,
  2,
)}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
