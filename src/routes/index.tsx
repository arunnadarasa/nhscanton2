import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, ShieldCheck, Zap, Plug, ExternalLink, Eye } from "lucide-react";

import { AppShell, ledgerModeQuery } from "@/components/AppShell";
import {
  DEFICIT_TREND,
  ICBS,
  NHS_HEADLINE,
  SOURCES,
  SPEND_BY_CATEGORY,
  gbp,
} from "@/lib/nhs/data";
import { getAllContracts } from "@/lib/nhs/canton.functions";

const contractsQuery = queryOptions({
  queryKey: ["canton", "contracts"],
  queryFn: () => getAllContracts(),
  staleTime: 5_000,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NHS Ledger · Canton-backed budget transparency" },
      {
        name: "description",
        content:
          "A Canton Network app for the £192bn NHS budget: DHSC → NHS England → ICB → Trust allocations and reconciled spend, with template-level privacy.",
      },
      { property: "og:title", content: "NHS Ledger on Canton" },
      {
        property: "og:description",
        content:
          "Allocate, sub-allocate and reconcile NHS budget on a real Canton ledger. Trust line items stay private to commissioner + auditor.",
      },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(ledgerModeQuery);
    context.queryClient.ensureQueryData(contractsQuery);
  },
  component: HomePage,
});

// NHS-blue first, cyan support, then mid/pale blue, then deficit red
const PIE_COLORS = [
  "var(--primary)",
  "var(--accent)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--muted-foreground)",
];

function HomePage() {
  const { data: contracts } = useSuspenseQuery(contractsQuery);

  return (
    <AppShell>
      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="hero-mesh relative isolate overflow-hidden rounded-[1.75rem] border border-white/70 bg-card/80 p-6 shadow-soft backdrop-blur-sm sm:p-8 md:rounded-[2.25rem] md:p-14">
        {/* layered ambient: grid + drifting aurora blobs */}
        <div aria-hidden className="grid-overlay pointer-events-none absolute inset-0 -z-10 opacity-60" />
        <div aria-hidden className="aurora-blob pointer-events-none absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
        <div aria-hidden className="aurora-blob pointer-events-none absolute -bottom-20 -left-10 -z-10 h-72 w-72 rounded-full bg-primary/20 blur-3xl" style={{ animationDelay: "-7s" }} />

        <div className="relative max-w-4xl fade-up">
          <div className="mb-4 inline-flex flex-wrap items-center gap-2 rounded-full border border-primary/15 bg-white/70 px-3 py-1.5 backdrop-blur md:mb-5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary md:text-[11px]">
              Canton Network
            </span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-accent md:text-[11px]">
              Healthcare Track
            </span>
          </div>

          <h1 className="font-display text-3xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-4xl md:text-6xl lg:text-7xl">
            The{" "}
            <span className="text-shimmer bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              £{(NHS_HEADLINE.totalBudgetGbp / 1e9).toFixed(0)}bn
            </span>{" "}
            NHS budget,
            <br className="hidden md:block" /> reconciled on a privacy-enabled
            ledger.
          </h1>


          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base md:mt-6 md:text-lg">
            DHSC funds NHS England. NHS England sub-allocates to 42 ICBs. ICBs
            commission NHS Trusts. Every transfer is a Daml contract on Canton —
            visible to its parties, invisible to everyone else. Auditors get a
            read-only stream once spend is countersigned.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2.5 md:mt-8 md:gap-3">
            <Link
              to="/allocations"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-16px_color-mix(in_oklab,var(--primary)_55%,transparent)] md:px-6 md:py-3.5"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative">Open allocation cockpit</span>
              <ArrowUpRight className="relative h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <Link
              to="/ledger"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-white/70 px-5 py-3 text-sm font-semibold text-foreground backdrop-blur transition hover:border-primary/40 hover:bg-white hover:text-primary md:px-6 md:py-3.5"
            >
              <Eye className="h-4 w-4 opacity-70" />
              Inspect ledger <span className="font-mono text-xs text-muted-foreground">({contracts.length})</span>
            </Link>
          </div>

        </div>
      </section>

      {/* ─── KPI strip ────────────────────────────────────────── */}
      <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total NHS DEL"
          value={gbp(NHS_HEADLINE.totalBudgetGbp)}
          sub={`${NHS_HEADLINE.fiscalYear} Fiscal Year`}
        />
        <Stat
          label="NHS England Share"
          value={gbp(NHS_HEADLINE.nhsEnglandGbp)}
          sub="Front-line services"
        />
        <Stat
          label="Spend per Head"
          value={`£${NHS_HEADLINE.perCapitaGbp.toLocaleString()}`}
          sub="Per resident, England"
        />
        <Stat
          label="Aggregate Trust Deficit"
          value={gbp(NHS_HEADLINE.trustDeficitGbp)}
          sub="Provider sector 2023/24"
          warn
        />
      </section>

      {/* ─── Charts ──────────────────────────────────────────── */}
      <section className="mt-8 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3" title="Provider deficit trend"
          subtitle="Source: King's Fund NHS trusts deficit dataset.">
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={DEFICIT_TREND} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-deficit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" />
                <XAxis dataKey="year" fontSize={11} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => gbp(v as number)} fontSize={11} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} width={70} />
                <Tooltip
                  formatter={(v) => gbp(v as number)}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="gbp" stroke="var(--primary)" strokeWidth={2.5} fill="url(#grad-deficit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2" title="Where the money goes" subtitle="Nuffield Trust breakdown.">
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={SPEND_BY_CATEGORY}
                  dataKey="gbp"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={98}
                  paddingAngle={3}
                  stroke="var(--card)"
                  strokeWidth={3}
                >
                  {SPEND_BY_CATEGORY.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => gbp(v as number)}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-5 grid gap-x-6 gap-y-2 md:grid-cols-2">
            {SPEND_BY_CATEGORY.map((c, i) => (
              <li
                key={c.name}
                className="flex items-center justify-between gap-3 border-b border-border/50 py-1.5 text-xs last:border-b-0"
              >
                <span className="flex items-center gap-2.5 text-foreground">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="font-medium">{c.name}</span>
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {gbp(c.gbp)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* ─── ICB allocations ─────────────────────────────────── */}
      <section className="mt-8">
        <Card title={`ICB indicative allocations · ${NHS_HEADLINE.fiscalYear}`}
          subtitle="Seven NHS regions, ranked by core DEL allocation.">
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={ICBS} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="code" fontSize={11} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => gbp(v as number)} fontSize={11} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} width={70} />
                <Tooltip
                  formatter={(v) => gbp(v as number)}
                  labelFormatter={(l) => `ICB ${l}`}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="allocationGbp" fill="var(--primary)" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      {/* ─── Workflow on Canton ──────────────────────────────── */}
      <WorkflowSection />

      {/* ─── Why Canton ──────────────────────────────────────── */}
      <section className="mt-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent">
              The technology
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold text-foreground md:text-4xl">
              Why Canton
            </h2>
          </div>
          <Link
            to="/canton-vs-evm"
            className="hidden items-center gap-1 text-sm font-semibold text-primary hover:underline md:inline-flex"
          >
            Canton vs EVM <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <Feature
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Privacy by template"
          >
            A Trust's individual spend lines are disclosed only to its
            commissioning ICB and the National Audit Office. Other ICBs, other
            trusts, and the public ledger see nothing.
          </Feature>
          <Feature
            icon={<Zap className="h-5 w-5" />}
            title="Atomic multi-party workflows"
          >
            Countersigning a <code className="font-mono text-xs">SpendCommitment</code>{" "}
            atomically archives it and creates a{" "}
            <code className="font-mono text-xs">ReconciledSpend</code> contract
            co-signed by Trust + ICB, observable by Auditor.
          </Feature>
          <Feature
            icon={<Plug className="h-5 w-5" />}
            title="Real ledger, real client"
          >
            Talks Canton 3.4 <code className="font-mono text-xs">JSON Ledger API v2</code>{" "}
            directly (no <code className="font-mono text-xs">@daml/ledger</code> v1
            sidecar). Point at any participant with three env vars to go live.
          </Feature>
        </div>
      </section>

      {/* ─── Sources ─────────────────────────────────────────── */}
      <section className="mt-12 rounded-3xl border border-border bg-secondary/40 p-8 backdrop-blur md:p-10">
        <h3 className="font-display text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
          Data sources & references
        </h3>
        <ul className="mt-6 grid gap-x-12 gap-y-3 text-sm md:grid-cols-2">
          {SOURCES.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center justify-between gap-3 border-b border-border/60 py-2 font-medium text-foreground/80 transition hover:border-primary/40 hover:text-primary"
              >
                <span className="flex items-center gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {s.label}
                </span>
                <ExternalLink className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}

// ─── Primitives ──────────────────────────────────────────────

function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`group relative min-w-0 overflow-hidden rounded-3xl border border-white/60 bg-card/80 p-6 shadow-soft backdrop-blur-sm transition-shadow hover:shadow-glow md:p-8 ${className}`}
    >
      {/* hairline accent that lights up on hover */}
      <span
        aria-hidden
        className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />
      <div className="mb-6">
        <h2 className="font-display text-lg font-bold text-foreground md:text-xl">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub: string;
  warn?: boolean;
}) {
  return (
    <div
      className="group relative isolate overflow-hidden rounded-2xl border border-white/60 bg-card/80 p-5 shadow-soft backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-glow md:p-6"
    >
      {/* gradient top bar */}
      <span
        aria-hidden
        className={`absolute inset-x-0 top-0 h-[3px] ${
          warn
            ? "bg-gradient-to-r from-destructive/60 via-destructive to-destructive/60"
            : "bg-gradient-to-r from-primary/60 via-accent to-primary/60"
        }`}
      />
      {/* hover spotlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/15 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
      />
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition group-hover:text-accent">
        {label}
      </div>
      <div
        className={`mt-3 font-display text-3xl font-bold tracking-tight ${
          warn ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[11px] font-medium text-muted-foreground">
        {sub}
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/60 bg-card/80 p-7 shadow-soft backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-glow">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
      />
      <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary shadow-inner ring-1 ring-primary/10 transition-all group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-primary/30">
        {icon}
      </div>
      <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
        {children}
      </p>
    </div>
  );
}

// ─── Workflow section ────────────────────────────────────────

type WorkflowStep = {
  index: string;
  party: string;
  contract: string;
  description: string;
  visibility: string;
};

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    index: "01",
    party: "DHSC",
    contract: "FundingAllocation",
    description:
      "Department of Health & Social Care issues the annual DEL envelope onto Canton, signing as funder.",
    visibility: "DHSC + NHS England",
  },
  {
    index: "02",
    party: "NHS England",
    contract: "SubAllocation",
    description:
      "NHS England splits the envelope across 42 ICBs, each as a co-signed Daml contract on the ledger.",
    visibility: "NHS England + receiving ICB",
  },
  {
    index: "03",
    party: "Integrated Care Board",
    contract: "SpendCommitment",
    description:
      "The ICB commissions Trusts by proposing line-item spend commitments awaiting countersignature.",
    visibility: "ICB + commissioned Trust",
  },
  {
    index: "04",
    party: "NHS Trust",
    contract: "ReconciledSpend",
    description:
      "The Trust countersigns, atomically archiving the commitment and producing reconciled spend.",
    visibility: "Trust + ICB + Auditor stream",
  },
];

function WorkflowSection() {
  return (
    <section className="mt-12">
      <div className="mb-8 max-w-3xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent">
          The flow
        </p>
        <h2 className="mt-2 font-display text-3xl font-bold text-foreground md:text-4xl">
          How money moves on the ledger
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
          Every step is a Daml contract on Canton — co-signed by the parties
          involved, invisible to everyone else, and streamed read-only to the
          National Audit Office once countersigned.
        </p>
      </div>

      <div className="relative rounded-[2rem] border border-white/60 bg-card/70 p-6 shadow-soft backdrop-blur-sm md:p-10">
        {/* Desktop: horizontal flow */}
        <div className="hidden lg:grid lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch lg:gap-3">
          {WORKFLOW_STEPS.map((step, i) => (
            <React.Fragment key={step.index}>
              <WorkflowNode step={step} delay={i * 120} />
              {i < WORKFLOW_STEPS.length - 1 && (
                <Connector delay={i * 600} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Mobile / tablet: vertical flow */}
        <div className="flex flex-col gap-3 lg:hidden">
          {WORKFLOW_STEPS.map((step, i) => (
            <div key={step.index} className="flex flex-col">
              <WorkflowNode step={step} delay={i * 120} />
              {i < WORKFLOW_STEPS.length - 1 && <ConnectorVertical delay={i * 600} />}
            </div>
          ))}
        </div>

        {/* Audit branch */}
        <div className="mt-8 flex items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 px-5 py-3 text-xs font-semibold text-foreground backdrop-blur-sm">
            <Eye className="h-4 w-4 text-primary" />
            <span>
              National Audit Office observes every{" "}
              <code className="font-mono text-[11px] text-primary">
                ReconciledSpend
              </code>{" "}
              as a read-only stream
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkflowNode({ step, delay }: { step: WorkflowStep; delay: number }) {
  return (
    <div
      className="node-rise group relative flex h-full flex-col rounded-2xl border border-white/70 bg-white/90 p-5 shadow-soft backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] font-bold tracking-[0.18em] text-accent">
          {step.index}
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-primary/50 transition group-hover:bg-primary" />
      </div>
      <div className="mt-3 font-display text-base font-bold leading-tight text-foreground">
        {step.party}
      </div>
      <code className="mt-1 inline-block w-fit rounded-md bg-primary/8 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
        {step.contract}
      </code>
      <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
        {step.description}
      </p>
      <div className="mt-4 flex items-center gap-1.5 border-t border-border/60 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <ShieldCheck className="h-3 w-3 text-accent" />
        <span className="truncate">{step.visibility}</span>
      </div>
    </div>
  );
}

function Connector({ delay }: { delay: number }) {
  return (
    <div className="relative flex min-w-[2.5rem] items-center self-center">
      <div className="h-px w-full bg-gradient-to-r from-primary/30 via-primary/50 to-accent/40" />
      <span
        className="flow-pulse absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_12px_2px_color-mix(in_oklab,var(--accent)_60%,transparent)]"
        style={{ animationDelay: `${delay}ms` }}
      />
    </div>
  );
}

function ConnectorVertical({ delay }: { delay: number }) {
  return (
    <div className="relative mx-auto flex h-8 w-px items-stretch">
      <div className="h-full w-px bg-gradient-to-b from-primary/30 via-primary/50 to-accent/40" />
      <span
        className="flow-pulse-v absolute left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_12px_2px_color-mix(in_oklab,var(--accent)_60%,transparent)]"
        style={{ animationDelay: `${delay}ms` }}
      />
    </div>
  );
}
