import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Trophy,
  Shield,
  Sparkles,
  CheckCircle2,
  Circle,
  ExternalLink,
  Coins,
  Building2,
  Cpu,
  LayoutDashboard,
  Globe2,
  Bot,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/hackathon")({
  head: () => ({
    meta: [
      { title: "Hackathon brief · NHS Ledger on Canton" },
      {
        name: "description",
        content:
          "How the NHS Ledger maps to the Canton Foundation hackathon: three tracks, four judging criteria, submission checklist, and a 3-minute path through the demo.",
      },
      { property: "og:title", content: "Hackathon brief · NHS Ledger on Canton" },
      {
        property: "og:description",
        content:
          "Track 2 primary (TradeFi/RWA), Track 1 secondary (Private DeFi & Capital Markets). Public-money RWA on Canton 3.4.",
      },
    ],
  }),
  component: HackathonPage,
});

type Fit = "Primary" | "Strong fit" | "Honest miss";

const TRACKS: {
  number: number;
  title: string;
  fit: Fit;
  icon: typeof Coins;
  what: string;
  judgesLookFor: string[];
  howWeHit: string;
  links?: { label: string; to: string }[];
}[] = [
  {
    number: 2,
    title: "TradeFi, RWA & Tokenized Assets",
    fit: "Primary",
    icon: Coins,
    what:
      "Real-world financial infrastructure — trade finance, tokenized assets, and business workflows tied to real economic activity (invoice / supply-chain financing, inter-company netting, tokenized deposits, RWA-based products, enterprise workflows on tokenized RWAs).",
    judgesLookFor: [
      "Strong real-world business relevance",
      "Clear asset / financing logic",
      "Practical workflow design",
      "A use case where tokenization or on-chain coordination genuinely helps",
    ],
    howWeHit:
      "The £192bn DHSC settlement is the real-world asset. DHSC → NHS England → ICB → Trust allocations are modelled as tokenized obligations; countersigning a SpendCommitment atomically archives it and mints a ReconciledSpend. Cross-ICB netting and Trust-level sub-allocations are exactly the enterprise workflow on tokenized RWAs the brief asks for — just applied to public money instead of capital markets.",
    links: [
      { label: "/allocations", to: "/allocations" },
      { label: "/trust/GSTT", to: "/trust/GSTT" },
    ],
  },
  {
    number: 1,
    title: "Private DeFi & Capital Markets",
    fit: "Strong fit",
    icon: Shield,
    what:
      "Financial applications where privacy and confidentiality actually matter — confidential lending, private credit / invoice financing, OTC trading, private deal execution, capital-markets tools where pricing, counterparties or positions shouldn't be public.",
    judgesLookFor: [
      "Clear use of privacy / confidentiality",
      "A real financial use case",
      "Strong product logic, not infra for infra's sake",
      "Credible relevance to institutional or professional markets",
    ],
    howWeHit:
      "Public-money privacy is the same primitive as capital-markets privacy. An ICB sees only its envelope and its Trusts' sub-allocations; peer ICBs see nothing; the National Audit Office sees only co-signed ReconciledSpend contracts. Disclosure is enforced at the Daml template level via signatories and observers, not by application code.",
    links: [
      { label: "/icb/LDN", to: "/icb/LDN" },
      { label: "/audit", to: "/audit" },
    ],
  },
  {
    number: 3,
    title: "Payments, Neobanking & Agentic Commerce",
    fit: "Honest miss",
    icon: Bot,
    what:
      "Modern payments, wallets/neobank tools, treasury & business-banking workflows, agentic commerce with privacy, systems where software agents can initiate or coordinate commercial actions safely.",
    judgesLookFor: [
      "Clear end-user value",
      "Smooth payments / commerce workflow",
      "Strong product thinking",
      "A believable use of agents, if AI is involved",
      "Trust, reliability, practical usefulness",
    ],
    howWeHit:
      "Not pitching this track. There is no consumer wallet, no payments rail, and no AI agent in the demo — GBP settlement itself is not on-ledger. The treasury-workflow theme overlaps, but the agentic-commerce framing doesn't fit a public-sector allocation flow and we'd rather be honest than overclaim.",
  },
];

const CRITERIA: {
  title: string;
  icon: typeof Cpu;
  how: string;
  evidence: { label: string; to?: string; href?: string }[];
}[] = [
  {
    title: "Technical execution",
    icon: Cpu,
    how:
      "Five Daml templates with signatories, observers and controller choices. Talks Canton 3.4 JSON Ledger API v2 directly via fetch — no EOL @daml/ledger v1 sidecar. Tri-mode adapter (Seaport-managed Devnet via OIDC, self-hosted Fly.io participant, in-memory simulator) with a header pill toggle. Four documented deployment paths: Seaport Devnet (recommended, provisioned via Encode Hackathon), LocalNet, Docker, and Fly.io.",
    evidence: [
      { label: "/deploy", to: "/deploy" },
      { label: "/ledger", to: "/ledger" },
    ],
  },
  {
    title: "Originality & creativity",
    icon: Sparkles,
    how:
      "Public-money RWA. Canton's institutional privacy model is almost always pitched at capital markets; we apply the same template-level disclosure to a public-sector allocation hierarchy where the privacy boundary isn't 'don't leak our trades' but 'don't leak another Trust's spend lines.' Fresh framing, same primitive.",
    evidence: [{ label: "/", to: "/" }],
  },
  {
    title: "User experience & design",
    icon: LayoutDashboard,
    how:
      "Role-scoped views, not one god dashboard. DHSC sees the £192bn envelope. An ICB sees its own allocation tree. A Trust sees only its sub-allocations. The Auditor sees a stream of co-signed reconciliations. A LIVE / SIMULATED badge in the header makes the ledger mode unambiguous.",
    evidence: [
      { label: "/allocations", to: "/allocations" },
      { label: "/icb/LDN", to: "/icb/LDN" },
      { label: "/trust/GSTT", to: "/trust/GSTT" },
      { label: "/audit", to: "/audit" },
    ],
  },
  {
    title: "Real-world applicability",
    icon: Globe2,
    how:
      "£192bn DHSC settlement, the real 42 ICBs, headline figures sourced from King's Fund, Nuffield Trust, IFS and NHS England. NAO audit lineage is a concrete, documented UK government pain point — not a toy domain.",
    evidence: [{ label: "/ (overview)", to: "/" }],
  },
];

const SUBMISSION: { label: string; done: boolean; note: string; to?: string; href?: string }[] = [
  {
    label: "Public repository",
    done: true,
    note: "Daml templates, server functions, and deploy docs all in-tree.",
    href: "https://github.com/",
  },
  {
    label: "Link to live product",
    done: true,
    note: "This app. Every track card deep-links into a live screen.",
    to: "/",
  },
  {
    label: "Presentation deck",
    done: true,
    note: "Slide-shaped narrative of the NHS Ledger pitch, live in-app.",
    to: "/deck",
  },
  {
    label: "3-minute video pitch with demo",
    done: true,
    note: "Recorded walkthrough covering the problem, the Canton model, and a live demo.",
    href: "https://youtu.be/q2zUKGgZYfw",
  },
];

const THEMES: { label: string; hit: "yes" | "partial" }[] = [
  { label: "Treasury operations & collateral mobility", hit: "yes" },
  { label: "Compliance & institutional controls", hit: "yes" },
  { label: "Privacy-enabled market infrastructure", hit: "yes" },
  { label: "Tokenized assets & settlement workflows", hit: "yes" },
  { label: "Institutional-grade blockchain infrastructure", hit: "yes" },
  { label: "Operational risk management", hit: "partial" },
];

const CHECKLIST: { to: string; label: string; note: string }[] = [
  { to: "/", label: "Open /", note: "See the £192bn breakdown and Canton pitch." },
  { to: "/allocations", label: "Open /allocations", note: "Create a SubAllocation as DHSC." },
  { to: "/icb/LDN", label: "Open /icb/LDN", note: "Countersign a SpendCommitment as the ICB." },
  { to: "/audit", label: "Open /audit", note: "Confirm only co-signed spend reaches the auditor." },
  { to: "/ledger", label: "Open /ledger", note: "Inspect raw contracts with signatories & observers." },
  { to: "/deploy", label: "Open /deploy", note: "See how to point the app at a real Canton 3.4 participant." },
];

const SCOPE = [
  "Live demos now run against Seaport-managed Canton Devnet (provisioned via the Encode Hackathon) — the in-memory fallback still mirrors Canton's disclosure rules for offline work. The Fly.io self-hosted path remains supported but is paused as the default.",
  "GBP settlement itself is not on-ledger. The model records obligations and reconciliations, not central-bank money movement.",
  "Party allocation, DAR upload and JWT issuance are operator steps, documented on /deploy rather than performed from the UI.",
  "Not pitching Track 3 (Payments / Neobanking / Agentic Commerce). No consumer wallet or AI agent in the demo.",
];

function fitColor(fit: Fit) {
  if (fit === "Primary") return "bg-primary text-primary-foreground";
  if (fit === "Strong fit") return "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30";
  return "bg-muted text-muted-foreground border border-border";
}

function HackathonPage() {
  return (
    <AppShell>
      {/* Header */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-8 md:p-10">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Canton Foundation hackathon · judging brief
        </p>
        <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight md:text-4xl">
          NHS Ledger on Canton
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          "Build something that makes a real user or institution want to show up and start using
          Canton. Build for a world where users control who sees what using Canton's privacy
          model." This page maps the NHS Ledger to the brief, track by track and criterion by
          criterion.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            "$7,000 prize pool",
            "Canton 3.4",
            "JSON Ledger API v2",
            "Seaport Devnet (live)",
            "5 Daml templates",
            "4 deploy paths",
          ].map((b) => (
            <Badge key={b} variant="secondary">
              {b}
            </Badge>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/allocations"
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open allocation cockpit
          </Link>
          <Link
            to="/ledger"
            className="rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-accent"
          >
            Inspect ledger
          </Link>
          <a
            href="https://www.encodeclub.com/programmes/canton-hackathon"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-accent"
          >
            Encode Club programme <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>

      {/* Submission checklist */}
      <section className="mt-10 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">Submission checklist</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          The four required deliverables from the Canton Foundation brief.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {SUBMISSION.map((s) => {
            const Inner = (
              <>
                <div className="mt-0.5 shrink-0">
                  {s.done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.label}</p>
                  <p className="text-sm text-muted-foreground">{s.note}</p>
                </div>
              </>
            );
            const wrap =
              "flex items-start gap-3 rounded-lg border border-border bg-background p-3";
            if (s.to) {
              return (
                <li key={s.label}>
                  <Link to={s.to} className={`${wrap} hover:bg-accent`}>
                    {Inner}
                  </Link>
                </li>
              );
            }
            if (s.href) {
              return (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${wrap} hover:bg-accent`}
                  >
                    {Inner}
                  </a>
                </li>
              );
            }
            return (
              <li key={s.label} className={wrap}>
                {Inner}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Tracks */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">The three tracks, head-on</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each card uses the brief's own "what to build" and "what judges look for", then maps
          the NHS Ledger onto it honestly.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {TRACKS.map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.number}
                className="flex flex-col rounded-2xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${fitColor(t.fit)}`}
                  >
                    {t.fit}
                  </span>
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Track {t.number}
                </p>
                <h3 className="mt-1 font-semibold">{t.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t.what}</p>

                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  What judges look for
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {t.judgesLookFor.map((j) => (
                    <li key={j} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                      <span className="text-muted-foreground">{j}</span>
                    </li>
                  ))}
                </ul>

                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-primary">
                  How we hit it
                </p>
                <p className="mt-2 text-sm">{t.howWeHit}</p>

                {t.links && t.links.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {t.links.map((l) => (
                      <Link
                        key={l.label}
                        to={l.to}
                        className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent"
                      >
                        {l.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Criteria */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">
          How we score on the four judging criteria
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The brief scores every submission on these four pillars, regardless of track. Each row
          links to live evidence inside the app.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {CRITERIA.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.title} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">{c.title}</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{c.how}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.evidence.map((e) =>
                    e.to ? (
                      <Link
                        key={e.label}
                        to={e.to}
                        className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent"
                      >
                        {e.label}
                      </Link>
                    ) : (
                      <a
                        key={e.label}
                        href={e.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent"
                      >
                        {e.label}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Institutional themes */}
      <section className="mt-10 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">Institutional themes hit</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          From the brief's "workflows institutions actually need on-chain" banner.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <span
              key={t.label}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                t.hit === "yes"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                  : "border-border bg-muted text-muted-foreground"
              }`}
            >
              {t.hit === "yes" ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Circle className="h-3.5 w-3.5" />
              )}
              {t.label}
            </span>
          ))}
        </div>
      </section>

      {/* Checklist */}
      <section className="mt-10 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-semibold tracking-tight">Judge in 3 minutes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Six clicks to see Canton privacy and atomic multi-party reconciliation end-to-end.
        </p>
        <ol className="mt-5 space-y-3">
          {CHECKLIST.map((c, i) => (
            <li
              key={c.to}
              className="flex items-start gap-3 rounded-lg border border-border bg-background p-3"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <Link to={c.to} className="font-medium text-primary hover:underline">
                  {c.label}
                </Link>
                <p className="text-sm text-muted-foreground">{c.note}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Scope honesty */}
      <section className="mt-10 rounded-2xl border border-dashed border-border bg-card/40 p-6">
        <h2 className="text-lg font-semibold">What's out of scope (honesty card)</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {SCOPE.map((s) => (
            <li key={s} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Canton tooling we used */}
      <section className="mt-10 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">Canton tooling we used</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Pulled from the Canton Foundation Developer Hub and the official SDK docs.
          Each link is what a judge can read to verify the choice.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            {
              label: "Daml SDK 3.4 via dpm",
              note: "dpm build / dpm test / dpm codegen-js. daml.yaml pins sdk-version: 3.4.0. Legacy daml Assistant intentionally avoided.",
              href: "https://docs.canton.network/sdks-tools/sdks/daml-sdk",
            },
            {
              label: "JSON Ledger API v2",
              note: "Direct fetch against /v2/commands/submit-and-wait and /v2/state/active-contracts. No EOL @daml/ledger v1 sidecar.",
              href: "https://docs.canton.network/",
            },
            {
              label: "Wallet SDK (planned)",
              note: "@canton-network/wallet-sdk wraps prepare-sign-submit for external parties and OAuth via ClientCredentialOAuthController. Swap-in once workerd bundling is verified.",
              href: "https://docs.canton.network/sdks-tools/sdks/wallet-sdk",
            },
            {
              label: "Canton Builder Tool",
              note: "Recommended one-command Splice LocalNet for the hackathon deploy path. canton builder start && canton builder deploy nhs-budget.dar.",
              href: "https://github.com/Jatinp26/Canton-Builder-Tool",
            },
            {
              label: "cn-quickstart",
              note: "Full reference stack (Keycloak + PQS + sample backend/frontend) for builders who want more than LocalNet.",
              href: "https://github.com/digital-asset/cn-quickstart",
            },
            {
              label: "Canton Developer Hub",
              note: "Canton Foundation DevRel catalogue of SDKs, tools, APIs and indexers — the source for the choices above.",
              href: "https://github.com/canton-network-devs/Canton-Developer-Hub",
            },
          ].map((t) => (
            <a
              key={t.label}
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-lg border border-border bg-background p-3 hover:bg-accent"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{t.label}</p>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{t.note}</p>
            </a>
          ))}
        </div>
      </section>

      {/* Links */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">References</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              label: "Encode Club · Canton hackathon",
              href: "https://www.encodeclub.com/programmes/canton-hackathon",
              external: true,
            },
            { label: "Canton Network", href: "https://www.canton.network/", external: true },
            { label: "Canton 3.4 docs", href: "https://docs.canton.network/", external: true },
            {
              label: "Canton Developer Hub",
              href: "https://github.com/canton-network-devs/Canton-Developer-Hub",
              external: true,
            },
            {
              label: "Wallet SDK",
              href: "https://docs.canton.network/sdks-tools/sdks/wallet-sdk",
              external: true,
            },
            { label: "Deploy guide (in-app)", to: "/deploy" },
            { label: "Ledger explorer (in-app)", to: "/ledger" },
          ].map((l) =>
            "to" in l && l.to ? (
              <Link
                key={l.label}
                to={l.to}
                className="rounded-lg border border-border bg-card p-3 text-sm hover:bg-accent"
              >
                {l.label}
              </Link>
            ) : (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm hover:bg-accent"
              >
                <span>{l.label}</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            ),
          )}
        </div>
      </section>
    </AppShell>
  );
}
