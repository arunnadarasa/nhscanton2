import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, FileText, CheckCircle2, XCircle, Clock } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { CreateContractForm } from "@/components/contracts/CreateContractForm";
import { Badge } from "@/components/ui/badge";
import {
  listContractEvents,
  listActiveContracts,
  listKnownParties,
} from "@/lib/canton/contracts.functions";
import {
  TEMPLATE_LIST,
  TEMPLATES,
  TEMPLATES_BY_CATEGORY,
  type TemplateCategory,
  type TemplateId,
} from "@/lib/canton/templates";

const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  privacy: "Privacy flow",
  tokenisation: "Tokenisation",
  proofs: "Proofs & settlement",
  invoice: "Invoice",
};

export const Route = createFileRoute("/contracts/new")({
  head: () => ({
    meta: [
      { title: "Create Contract · NHS Ledger" },
      {
        name: "description",
        content:
          "Generic Daml template form — privacy-enhanced allocations, tokenisation, proofs, and invoices on the live Canton ledger.",
      },
      { property: "og:title", content: "Create Contract · NHS Ledger" },
      {
        property: "og:description",
        content: "Submit Daml contracts to the Canton ledger from a Seaport-style form.",
      },
    ],
  }),
  component: CreateContractPage,
});

function CreateContractPage() {
  const [templateId, setTemplateId] = useState<TemplateId>(
    "NhsTokenisedBudgetAllocation:BudgetAllocationPrivacy",
  );

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-4 md:px-6 md:py-10">
        <div className="mb-4 md:mb-6">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Create Contract
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground md:text-sm">
            Submit a Daml contract to the active Canton ledger. Equivalent to Seaport's
            Create-Contract flow.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-[260px_minmax(0,1fr)_320px]">
          {/* Templates — collapsible on mobile, sidebar on desktop */}
          <details className="group order-2 rounded-xl border border-border bg-white/60 p-3 md:order-none md:contents md:rounded-none md:border-0 md:bg-transparent md:p-0" open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 md:hidden">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Templates ({TEMPLATE_LIST.length}) — {TEMPLATES[templateId].label}
              </span>
              <span className="text-xs text-muted-foreground group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <div className="mt-3 space-y-3 md:mt-0 md:space-y-3">
            <div className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground md:block">
              Templates ({TEMPLATE_LIST.length})
            </div>
            <div className="space-y-5">
              {(Object.keys(TEMPLATES_BY_CATEGORY) as TemplateCategory[]).map((cat) => {
                const items = TEMPLATES_BY_CATEGORY[cat];
                if (items.length === 0) return null;
                return (
                  <div key={cat} className="space-y-2">
                    <div className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                      {CATEGORY_LABEL[cat]}
                    </div>
                    {items.map((t) => {
                      const active = t.id === templateId;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTemplateId(t.id)}
                          className={`flex w-full flex-col items-start rounded-xl border p-3 text-left transition ${
                            active
                              ? "border-primary bg-primary/10"
                              : "border-border bg-white hover:bg-secondary"
                          }`}
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <div className="min-w-0 flex-1 truncate font-semibold text-sm">{t.label}</div>
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {t.fields.length} fields
                            </Badge>
                          </div>
                          {t.description && (
                            <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
                              {t.description}
                            </div>
                          )}
                          <div className="mt-1 w-full truncate text-[10px] font-mono text-muted-foreground/80">
                            {t.module}:{t.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            </div>
          </details>

          {/* Form */}
          <div className="order-1 rounded-2xl border border-border bg-white/60 p-5 shadow-soft backdrop-blur md:order-none">
            <CreateContractForm templateId={templateId} />
          </div>

          {/* Execution log + active contracts */}
          <div className="order-3 space-y-5 md:order-none">
            <ExecutionLog />
            <ActiveContractsPanel templateId={templateId} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}


function ExecutionLog() {
  const fetchEvents = useServerFn(listContractEvents);
  const q = useQuery({
    queryKey: ["contract-events"],
    queryFn: () => fetchEvents(),
    refetchInterval: 3000,
  });

  const events = q.data ?? [];

  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <div className="text-sm font-semibold">Execution Log</div>
      </div>
      {events.length === 0 && (
        <div className="py-6 text-center text-xs text-muted-foreground">
          <FileText className="mx-auto mb-2 h-6 w-6 opacity-50" />
          No events yet
        </div>
      )}
      <ul className="space-y-2 max-h-[320px] overflow-y-auto">
        {events.map((ev) => (
          <li
            key={ev.id}
            className="flex items-start gap-2 rounded-lg border border-border/60 bg-secondary/30 p-2"
          >
            <span className="mt-0.5 shrink-0">
              {ev.status === "created" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              ) : ev.status === "failed" ? (
                <XCircle className="h-3.5 w-3.5 text-rose-600" />
              ) : (
                <Clock className="h-3.5 w-3.5 text-amber-600" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-semibold">{ev.template_id}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {new Date(ev.created_at).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {ev.status}
                {ev.network ? ` · ${ev.network}` : ""}
                {ev.contract_id ? ` · ${ev.contract_id.slice(0, 10)}…` : ""}
              </div>
              {ev.error && (
                <div className="mt-1 truncate text-[10px] text-rose-600" title={ev.error}>
                  {ev.error}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActiveContractsPanel({ templateId }: { templateId: TemplateId }) {
  const fetchParties = useServerFn(listKnownParties);
  const fetchActive = useServerFn(listActiveContracts);

  const partiesQ = useQuery({
    queryKey: ["known-parties"],
    queryFn: () => fetchParties(),
  });
  const firstParty = partiesQ.data?.[0]?.party_id ?? TEMPLATES[templateId].defaultActAs ?? "";

  const q = useQuery({
    queryKey: ["active-contracts", templateId, firstParty],
    queryFn: () => fetchActive({ data: { templateId, party: firstParty } }),
    enabled: !!firstParty,
    refetchInterval: 5000,
  });

  const contracts = q.data ?? [];
  const label = useMemo(() => TEMPLATES[templateId].label, [templateId]);

  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Active contracts
      </div>
      <div className="mb-3 text-sm font-semibold">
        {label} <span className="text-muted-foreground">({contracts.length})</span>
      </div>
      {contracts.length === 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground">
          No active contracts found for this template
        </div>
      ) : (
        <ul className="space-y-2 max-h-[300px] overflow-y-auto">
          {contracts.map((c) => {
            const payload = c.payload as Record<string, unknown>;
            const amount = payload.amountGbp as string | undefined;
            return (
              <li
                key={c.contractId}
                className="rounded-lg border border-border/60 bg-secondary/30 p-2 text-xs"
              >
                <div className="truncate font-mono text-[10px] text-muted-foreground">
                  {c.contractId.slice(0, 18)}…
                </div>
                {amount && (
                  <div className="font-semibold">
                    £{Number(amount).toLocaleString()}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
