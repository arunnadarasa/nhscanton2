import { useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  Maximize2,
  Printer,
  ExternalLink,
  Sparkles,
  Building2,
  Coins,
  ShieldCheck,
  Cpu,
  LineChart,
  Trophy,
  Rocket,
  Layers,
} from "lucide-react";

const searchSchema = z.object({
  slide: fallback(z.number().int().min(1), 1).default(1),
  print: fallback(z.boolean(), false).default(false),
});

export const Route = createFileRoute("/deck")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Pitch deck · NHS Ledger on Canton" },
      {
        name: "description",
        content:
          "Interactive pitch deck for the Encode × Canton hackathon submission: problem, solution, demo, market, competitors, roadmap.",
      },
      { property: "og:title", content: "Pitch deck · NHS Ledger on Canton" },
      {
        property: "og:description",
        content: "Public-money RWA on Canton 3.4 — pitch deck.",
      },
    ],
  }),
  component: DeckPage,
});

// ---------- Slide primitive ----------
function Slide({
  kicker,
  title,
  children,
  accent,
}: {
  kicker?: string;
  title?: string;
  children: ReactNode;
  accent?: ReactNode;
}) {
  return (
    <div className="flex h-full w-full flex-col justify-between p-20">
      <div className="flex items-start justify-between">
        {kicker ? (
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            {kicker}
          </div>
        ) : (
          <div />
        )}
        {accent}
      </div>
      {title && (
        <h2 className="mt-6 text-6xl font-bold leading-tight tracking-tight">
          {title}
        </h2>
      )}
      <div className="mt-8 flex-1 text-2xl leading-snug text-foreground/90">
        {children}
      </div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">
        NHS Ledger · Canton Network · Encode hackathon
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-6">
      <div className="text-5xl font-bold text-primary">{value}</div>
      <div className="mt-2 text-base text-muted-foreground">{label}</div>
    </div>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-primary" />
      <span>{children}</span>
    </li>
  );
}

// ---------- Slides ----------
const SLIDES: { id: string; render: () => ReactNode }[] = [
  {
    id: "title",
    render: () => (
      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-primary/15 via-background to-accent/10 p-20 text-center">
        <div className="mb-6 grid h-20 w-20 place-items-center rounded-2xl bg-primary text-4xl font-bold text-primary-foreground">
          ₵
        </div>
        <div className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
          Encode × Canton Network Hackathon
        </div>
        <h1 className="mt-6 text-7xl font-bold tracking-tight">NHS Ledger</h1>
        <p className="mt-4 text-3xl text-muted-foreground">
          The £192bn NHS budget, reconciled on a privacy-enabled Canton ledger.
        </p>
        <div className="mt-10 flex gap-4 text-sm text-muted-foreground">
          <span className="rounded-full border border-border px-4 py-1.5">
            Track 2 · TradeFi / RWA
          </span>
          <span className="rounded-full border border-border px-4 py-1.5">
            Daml 3.4 · 8 packages
          </span>
          <span className="rounded-full border border-border px-4 py-1.5">
            Seaport Devnet · live
          </span>

        </div>

      </div>
    ),
  },
  {
    id: "problem",
    render: () => (
      <Slide
        kicker="The problem"
        title="£192B/yr moves through spreadsheets and email"
        accent={<Building2 className="h-10 w-10 text-primary/70" />}
      >
        <ul className="space-y-5">
          <Bullet>
            NHS England allocates to 42 ICBs, which sub-allocate to 200+ Trusts —
            today this happens in disconnected Excel workbooks and PDF letters.
          </Bullet>
          <Bullet>
            No shared source of truth between payer, commissioner, and provider.
            Reconciliation lags weeks; in-year revisions are painful and lossy.
          </Bullet>
          <Bullet>
            Auditors and the NAO see snapshots, not a live trail. Leakage and
            miscoding go undetected until year-end.
          </Bullet>
        </ul>
      </Slide>
    ),
  },
  {
    id: "solution",
    render: () => (
      <Slide
        kicker="The solution"
        title="Budget envelopes as Daml contracts on Canton"
        accent={<Sparkles className="h-10 w-10 text-primary/70" />}
      >
        <ul className="space-y-5">
          <Bullet>
            <strong>Atomic</strong> NHSE → ICB → Trust allocation and
            sub-allocation, signed by the right parties, with no double-spend.
          </Bullet>
          <Bullet>
            <strong>Privacy by counterparty</strong> — each Trust sees only its
            own envelope; the regulator gets a read-only observer view.
          </Bullet>
          <Bullet>
            <strong>Immutable audit trail</strong> available in real time, not
            at year-end. One ledger, one truth.
          </Bullet>
        </ul>
      </Slide>
    ),
  },
  {
    id: "how",
    render: () => (
      <Slide
        kicker="How it works"
        title="Daml contracts, Canton ledger, web app"
        accent={<Cpu className="h-10 w-10 text-primary/70" />}
      >
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-2xl border border-border bg-card/40 p-6">
            <div className="text-sm font-semibold uppercase tracking-widest text-primary">
              On-ledger · Daml 3.4 · 8 packages
            </div>
            <ul className="mt-4 space-y-1.5 text-lg">
              <li>· <code>Nhs</code> · <code>NhsTokenisedBudgetAllocation</code></li>
              <li>· <code>BudgetAllocationReview</code> · <code>CommitmentInspector</code></li>
              <li>· <code>SettlementReview</code> · <code>ReconciledSpendSummary</code></li>
              <li>· <code>InvoiceAnalytics</code> · <code>InvoiceRisk</code></li>
              <li className="pt-2 text-sm text-muted-foreground">
                27 templates grouped: Budget Allocation · Spend Commitment ·
                Reconciled Spend · Settlement · Invoice.
              </li>
              <li className="text-sm text-muted-foreground">
                SHA-256 commitments (<code>hashText = sha256</code>) computed
                identically in Daml and the frontend.
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card/40 p-6">
            <div className="text-sm font-semibold uppercase tracking-widest text-primary">
              Off-ledger
            </div>
            <ul className="mt-4 space-y-1.5 text-lg">
              <li>· TanStack Start (SSR React)</li>
              <li>· JSON Ledger API v2 via fetch</li>
              <li>· OIDC client_credentials → JWT</li>
              <li>· Generic Create-Contract UI from template registry (<code>/contracts/new</code>)</li>
              <li>· Server functions with memory-mode fallback + persisted execution log</li>
              <li className="pt-2 text-sm text-muted-foreground">
                Seaport Devnet (primary) · in-memory demo fallback
              </li>
            </ul>
          </div>

        </div>

      </Slide>
    ),
  },
  {
    id: "demo",
    render: () => (
      <Slide
        kicker="Demo"
        title="Walk the money: NHSE → ICB → Trust → Audit"
        accent={<Layers className="h-10 w-10 text-primary/70" />}
      >
        <div className="grid h-full grid-cols-5 gap-6">
          <div className="col-span-3 grid place-items-center rounded-2xl border-2 border-dashed border-border bg-muted/20 text-center text-muted-foreground">
            <div>
              <div className="text-lg uppercase tracking-widest">
                Screen recording
              </div>
              <div className="mt-2 text-sm">
                Drop a <code>&lt;video&gt;</code> here for submission
              </div>
            </div>
          </div>
          <div className="col-span-2 flex flex-col gap-3 text-lg">
            <div className="text-sm uppercase tracking-widest text-primary">
              Live deep links
            </div>
            {[
              { to: "/allocations", label: "1. Allocations" },
              { to: "/icb/LDN", label: "2. ICB cockpit" },
              { to: "/trust/GSTT", label: "3. Trust view" },
              { to: "/contracts/new", label: "4. Create contract" },
              { to: "/audit", label: "5. Audit trail" },
            ].map((l) => (

              <Link
                key={l.to}
                to={l.to}
                className="flex items-center justify-between rounded-lg border border-border bg-card/40 px-4 py-3 hover:bg-accent"
              >
                <span>{l.label}</span>
                <ExternalLink className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </div>
      </Slide>
    ),
  },
  {
    id: "why-canton",
    render: () => (
      <Slide
        kicker="Application of technology"
        title="Why Canton, not an EVM chain"
        accent={<ShieldCheck className="h-10 w-10 text-primary/70" />}
      >
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-2xl border border-border bg-card/40 p-6">
            <div className="text-sm font-semibold uppercase tracking-widest text-primary">
              Canton
            </div>
            <ul className="mt-3 space-y-2 text-xl">
              <li>· Sub-transaction privacy</li>
              <li>· No public mempool</li>
              <li>· Daml choice model = enforceable workflows</li>
              <li>· Regulator-grade observer parties</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card/40 p-6 opacity-80">
            <div className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              EVM
            </div>
            <ul className="mt-3 space-y-2 text-xl text-muted-foreground">
              <li>· Public state by default</li>
              <li>· MEV / front-running</li>
              <li>· Solidity ≠ legal workflow</li>
              <li>· Permission via wrappers, not primitives</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 text-base text-muted-foreground">
          Full comparison →{" "}
          <Link to="/canton-vs-evm" className="text-primary underline">
            /canton-vs-evm
          </Link>
        </div>
      </Slide>
    ),
  },
  {
    id: "market",
    render: () => (
      <Slide
        kicker="Market scope"
        title="TAM · SAM · SOM"
        accent={<LineChart className="h-10 w-10 text-primary/70" />}
      >
        <div className="grid grid-cols-3 gap-6">
          <Stat value="~$9T" label="TAM — Global public health spend" />
          <Stat value="£1T+" label="SAM — Single-payer health systems (NHS-likes)" />
          <Stat value="£20M" label="SOM — NHSE allocation tooling, 5-yr beachhead" />
        </div>
        <p className="mt-8 text-xl text-muted-foreground">
          Start with NHS England (£180B/yr) — then NHS Scotland/Wales, NHSI
          Ireland, and OECD single-payer peers.
        </p>
      </Slide>
    ),
  },
  {
    id: "revenue",
    render: () => (
      <Slide
        kicker="Business value"
        title="Four revenue streams"
        accent={<Coins className="h-10 w-10 text-primary/70" />}
      >
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-2xl border border-border bg-card/40 p-6">
            <div className="text-2xl font-semibold">SaaS per ICB</div>
            <p className="mt-2 text-lg text-muted-foreground">
              42 ICBs × annual licence. Tiered by Trust count.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card/40 p-6">
            <div className="text-2xl font-semibold">Trust seat licences</div>
            <p className="mt-2 text-lg text-muted-foreground">
              Finance-team seats at 200+ Trusts.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card/40 p-6">
            <div className="text-2xl font-semibold">Daml workflow services</div>
            <p className="mt-2 text-lg text-muted-foreground">
              Bespoke template design, integration with SBS / Oracle EBS.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card/40 p-6">
            <div className="text-2xl font-semibold">Hosted validator</div>
            <p className="mt-2 text-lg text-muted-foreground">
              Optional managed Canton participant for non-IT NHS bodies.
            </p>
          </div>
        </div>
      </Slide>
    ),
  },
  {
    id: "competitors",
    render: () => (
      <Slide
        kicker="Originality"
        title="Competitors & our USP"
        accent={<Trophy className="h-10 w-10 text-primary/70" />}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <div className="text-xl font-semibold">
              Spreadsheets / Oracle EBS / SAP
            </div>
            <p className="text-lg text-muted-foreground">
              Internal ledgers — no shared state across counterparties, no
              privacy-preserving multi-party workflows.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <div className="text-xl font-semibold">NHS Shared Business Services</div>
            <p className="text-lg text-muted-foreground">
              Centralised processor — batch, not real-time, not regulator-readable
              by design.
            </p>
          </div>
          <div className="rounded-2xl border-2 border-primary bg-primary/10 p-5">
            <div className="text-xl font-semibold text-primary">
              USP — the only public-money workflow on a privacy-preserving
              Canton ledger with regulator observer parties.
            </div>
          </div>
        </div>
      </Slide>
    ),
  },
  {
    id: "roadmap",
    render: () => (
      <Slide
        kicker="Future prospects"
        title="From hackathon to NHS scale"
        accent={<Rocket className="h-10 w-10 text-primary/70" />}
      >
        <div className="grid grid-cols-4 gap-4">
          {[
            { q: "Now", t: "Live on Seaport Devnet — 8 Daml packages deployed, 27 contract templates wired to a generic Create-Contract UI, role-scoped cockpits for Trusts / ICBs / NAO auditor" },
            { q: "Q3", t: "NHSE pilot — 1 ICB, 3 Trusts, read-only NAO observer party" },
            { q: "Q4", t: "3 ICBs live; resume self-hosted Fly path for sovereign deployments" },
            { q: "2026", t: "Payment rails, NHS Scotland/Wales, research grant budgets" },

          ].map((m) => (
            <div
              key={m.q}
              className="rounded-2xl border border-border bg-card/40 p-5"
            >
              <div className="text-sm font-semibold uppercase tracking-widest text-primary">
                {m.q}
              </div>
              <p className="mt-3 text-lg">{m.t}</p>
            </div>
          ))}
        </div>
      </Slide>
    ),
  },
  {
    id: "lessons",
    render: () => (
      <Slide
        kicker="What we learned"
        title="Four things we'd tell the next builder"
        accent={<Sparkles className="h-10 w-10 text-primary/70" />}
      >
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              t: "Free text is Optional Text, never Optional Party",
              d: "A Party is a real ledger participant. Typing \"AstraZeneca\" into a supplier box throws UNKNOWN_INFORMEES at submit time. If a field needs a human label AND a future on-chain payee, model them as two fields (supplierName + supplierParty).",
            },
            {
              t: "Two JWT subjects, two purposes",
              d: "participant_admin only authorizes node ops — DAR upload, party alloc, user/rights mgmt. Ledger reads and command submission need a separate runtime user. On Devnet the validator enforces that the command userId matches the token's sub claim. Derive it; don't hardcode.",
            },
            {
              t: "Schema migrations: rename the package, not the version",
              d: "Renaming a Daml field isn't a backward-compatible upgrade. Re-uploading at a bumped patch fails with KNOWN_PACKAGE_VERSION. For a hackathon: bump the package name (nhs-budget-app → nhs-budget-app-v2), redeploy. Canton treats it as a fresh package.",
            },
            {
              t: "Grant CanActAs on EVERY allocated party — Auditor included",
              d: "Mock-USDCx mints as Auditor (the issuer). Our bootstrap originally granted Auditor only CanReadAs because it's a pure observer on the NHS templates. Every mint returned an opaque 403 \"security-sensitive error\" until we lifted the exception. Rule: if any template ever submits commands actAs a party, that party needs CanActAs.",
            },
          ].map((c) => (
            <div
              key={c.t}
              className="rounded-2xl border border-border bg-card/40 p-5"
            >
              <div className="text-lg font-semibold text-primary">{c.t}</div>
              <p className="mt-3 text-base text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
      </Slide>
    ),
  },
  {
    id: "criteria",

    render: () => (
      <Slide
        kicker="Judging criteria recap"
        title="How this deck maps to the rubric"
      >
        <div className="grid grid-cols-2 gap-5">
          {[
            {
              t: "Presentation",
              d: "Interactive in-app deck, deep links to the live product, printable handout.",
            },
            {
              t: "Business value",
              d: "£180B addressable budget, clear SaaS + services revenue model.",
            },
            {
              t: "Application of technology",
              d: "Daml 3.4 (8 packages, 27 templates) on Canton Seaport Devnet, JSON Ledger API v2, SHA-256 commitment hashing, privacy by counterparty.",
            },
            {
              t: "Originality",
              d: "First privacy-preserving public-money RWA workflow with regulator observers.",
            },
          ].map((c) => (
            <div
              key={c.t}
              className="rounded-2xl border border-border bg-card/40 p-5"
            >
              <div className="text-xl font-semibold text-primary">{c.t}</div>
              <p className="mt-2 text-lg text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex gap-4 text-base">
          <Link to="/hackathon" className="text-primary underline">
            /hackathon brief
          </Link>
          <Link to="/canton-vs-evm" className="text-primary underline">
            /canton-vs-evm
          </Link>
          <Link to="/" className="text-primary underline">
            Back to app
          </Link>
        </div>
      </Slide>
    ),
  },
];

// ---------- Page ----------
function DeckPage() {
  const { slide, print } = Route.useSearch();
  const navigate = useNavigate({ from: "/deck" });
  const total = SLIDES.length;
  const current = Math.min(Math.max(slide, 1), total);

  const goto = (n: number) => {
    const next = Math.min(Math.max(n, 1), total);
    navigate({ search: (p: { slide: number; print: boolean }) => ({ ...p, slide: next }) });
  };

  useEffect(() => {
    if (print) return;
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        goto(current + 1);
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        goto(current - 1);
      } else if (e.key === "Home") goto(1);
      else if (e.key === "End") goto(total);
      else if (e.key.toLowerCase() === "f") {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
      } else if (e.key.toLowerCase() === "p") {
        navigate({ search: (p: { slide: number; print: boolean }) => ({ ...p, print: true }) });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, total, print, navigate]);

  if (print) return <PrintView />;
  return <StageView current={current} total={total} goto={goto} />;
}

function StageView({
  current,
  total,
  goto,
}: {
  current: number;
  total: number;
  goto: (n: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const recalc = () => {
      const { width, height } = el.getBoundingClientRect();
      setScale(Math.min(width / 1280, height / 720));
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const slide = SLIDES[current - 1];

  return (
    <div className="fixed inset-0 flex flex-col bg-black text-foreground">
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2 text-xs">
        <Link
          to="/"
          className="rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-white/80 backdrop-blur hover:bg-white/10"
        >
          ← Back to app
        </Link>
      </div>
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 text-xs">
        <button
          onClick={() => {
            if (document.fullscreenElement) document.exitFullscreen();
            else document.documentElement.requestFullscreen();
          }}
          className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-white/80 backdrop-blur hover:bg-white/10"
          title="Fullscreen (F)"
        >
          <Maximize2 className="h-3.5 w-3.5" /> Fullscreen
        </button>
        <Link
          to="/deck"
          search={{ slide: current, print: true }}
          className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-white/80 backdrop-blur hover:bg-white/10"
          title="Print (P)"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </Link>
      </div>

      <div ref={wrapRef} className="relative flex-1">
        <div
          className="absolute left-1/2 top-1/2 origin-center overflow-hidden rounded-xl bg-background shadow-2xl"
          style={{
            width: 1280,
            height: 720,
            marginLeft: -640,
            marginTop: -360,
            transform: `scale(${scale})`,
          }}
        >
          {slide.render()}
        </div>
      </div>

      <div className="z-10 flex items-center justify-between gap-4 bg-black/60 px-6 py-3 backdrop-blur">
        <button
          onClick={() => goto(current - 1)}
          disabled={current === 1}
          className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 disabled:opacity-30"
        >
          <ArrowLeft className="h-4 w-4" /> Prev
        </button>
        <div className="flex flex-1 items-center justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goto(i + 1)}
              className={`h-2 rounded-full transition-all ${
                i + 1 === current ? "w-6 bg-primary" : "w-2 bg-white/30 hover:bg-white/50"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
        <div className="text-sm tabular-nums text-white/70">
          {current} / {total}
        </div>
        <button
          onClick={() => goto(current + 1)}
          disabled={current === total}
          className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 disabled:opacity-30"
        >
          Next <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function PrintView() {
  return (
    <div className="bg-white">
      <style>{`
        @page { size: 1280px 720px landscape; margin: 0; }
        @media print { .deck-print-controls { display: none; } }
        .deck-print-slide { page-break-after: always; break-after: page; }
      `}</style>
      <div className="deck-print-controls sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-3 text-sm">
        <span>Print view — use Cmd/Ctrl+P → Save as PDF</span>
        <Link to="/deck" search={{ slide: 1, print: false }} className="text-primary underline">
          Back to deck
        </Link>
      </div>
      {SLIDES.map((s) => (
        <div
          key={s.id}
          className="deck-print-slide relative overflow-hidden bg-background text-foreground"
          style={{ width: 1280, height: 720 }}
        >
          {s.render()}
        </div>
      ))}
    </div>
  );
}
