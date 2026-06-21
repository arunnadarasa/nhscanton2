import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  Network,
  Users,
  Atom,
  CheckCircle2,
  Coins,
  Gauge,
  Building2,
  Scale,
  Wallet,
  AlertTriangle,
  ExternalLink,
  ArrowRight,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/canton-vs-evm")({
  head: () => ({
    meta: [
      { title: "Canton Network vs EVM — Why Canton for NHS Ledger" },
      {
        name: "description",
        content:
          "Public ledgers broadcast every transaction. NHS finance needs sub-ledger privacy, atomic multi-party settlement, and institutional controls — that's why this app is built on Canton, not Ethereum.",
      },
      { property: "og:title", content: "Canton Network vs EVM — NHS Ledger" },
      {
        property: "og:description",
        content:
          "Side-by-side: Canton's per-party privacy and atomic workflows vs EVM's public broadcast and account model. Why Canton fits NHS multi-tier allocation.",
      },
    ],
  }),
  component: CantonVsEvmPage,
});

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────

type Row = {
  dimension: string;
  canton: string;
  evm: string;
};

const ROWS: Row[] = [
  {
    dimension: "Privacy model",
    canton: "Sub-transaction privacy. Each party sees only what they're a stakeholder on.",
    evm: "Global broadcast. Every transaction is visible to every node in the mempool and chain history.",
  },
  {
    dimension: "Smart contract language",
    canton: "Daml — functional, typed, with explicit signatories, observers and choices.",
    evm: "Solidity / Vyper — imperative, account-based, no native multi-party authorization.",
  },
  {
    dimension: "Data model",
    canton: "Contracts with parties (signatories / observers). UTXO-style: archive + create.",
    evm: "Global mutable account state. Anyone can read any storage slot.",
  },
  {
    dimension: "Multi-party workflow",
    canton: "Native. One Daml choice can require N signatures and update N parties atomically.",
    evm: "Manual. Multi-sig wallets, off-chain co-signing, or L2 bridges to glue parties together.",
  },
  {
    dimension: "Identity",
    canton: "Known, permissioned parties (banks, regulators, NHS bodies) with verifiable identities.",
    evm: "Pseudonymous hex addresses. KYC/AML bolted on at the app or wallet layer.",
  },
  {
    dimension: "Compliance & audit",
    canton: "Role-based disclosure. An auditor party is added as an observer — no extra plumbing.",
    evm: "Either fully public (data leak) or behind ZK circuits / custom rollups.",
  },
  {
    dimension: "Settlement finality",
    canton: "Deterministic, all-or-nothing across all involved parties' sub-ledgers.",
    evm: "Probabilistic on L1; bridges introduce additional finality assumptions on L2.",
  },
  {
    dimension: "Fees",
    canton: "Predictable. Validator-operated; Canton Coin (CC) used for network economics.",
    evm: "Volatile gas. Pricing tied to network congestion and ETH price.",
  },
  {
    dimension: "Wallet",
    canton: "Splice Wallet ships with every validator. Web UI + APIs for CC and tokenized assets.",
    evm: "MetaMask / WalletConnect ecosystem. Self-custody of keys, public address as identity.",
  },
  {
    dimension: "Fit for NHS multi-tier allocation",
    canton: "Native: DHSC → NHSE → ICB → Trust modelled as parties, each tier only sees its slice.",
    evm: "Needs ZK rollup or off-chain workarounds to avoid leaking every Trust's balance.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

function CantonVsEvmPage() {
  return (
    <AppShell>
      <div className="space-y-12">
        <Hero />
        <ComparisonTable />
        <ConceptCards />
        <NhsMapping />
        <TradeOffs />
        <FooterCtas />
      </div>
    </AppShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-violet-950 via-slate-950 to-black p-8 text-white md:p-12">
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,#a78bfa55,transparent_40%),radial-gradient(circle_at_80%_70%,#d9f99d33,transparent_40%)]" />
      <div className="relative">
        <Badge className="border-lime-400/40 bg-lime-400/10 text-lime-300">
          Architecture explainer
        </Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
          Why <span className="text-lime-300">Canton</span>, not{" "}
          <span className="text-violet-300">EVM</span>
        </h1>
        <p className="mt-4 max-w-3xl text-base text-white/70 md:text-lg">
          Public ledgers broadcast every transaction. NHS finance needs{" "}
          <span className="text-white">sub-ledger privacy</span>,{" "}
          <span className="text-white">atomic multi-party settlement</span>, and{" "}
          <span className="text-white">institutional controls</span>. Canton is built for
          that — EVM is not.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            "Permissioned",
            "Privacy by design",
            "Atomic settlement",
            "Role-based disclosure",
            "Daml smart contracts",
          ].map((t) => (
            <Badge
              key={t}
              variant="outline"
              className="border-white/20 bg-white/5 text-white/80"
            >
              {t}
            </Badge>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparison table
// ─────────────────────────────────────────────────────────────────────────────

function ComparisonTable() {
  return (
    <section>
      <SectionHeader
        eyebrow="Side by side"
        title="Canton vs EVM, dimension by dimension"
        sub="Same problem, different primitives. Read across each row."
      />
      <div className="mt-6 hidden overflow-hidden rounded-xl border border-border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-1/5 px-4 py-3">Dimension</th>
              <th className="w-2/5 px-4 py-3">
                <span className="text-lime-600">Canton Network</span>
              </th>
              <th className="w-2/5 px-4 py-3">
                <span className="text-violet-600">EVM / Ethereum</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr
                key={r.dimension}
                className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}
              >
                <td className="px-4 py-3 align-top font-medium">{r.dimension}</td>
                <td className="px-4 py-3 align-top text-foreground/90">{r.canton}</td>
                <td className="px-4 py-3 align-top text-muted-foreground">{r.evm}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile stacked */}
      <div className="mt-6 space-y-3 md:hidden">
        {ROWS.map((r) => (
          <div key={r.dimension} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {r.dimension}
            </div>
            <div className="mt-2">
              <div className="text-xs font-semibold text-lime-600">Canton</div>
              <p className="text-sm text-foreground/90">{r.canton}</p>
            </div>
            <div className="mt-3">
              <div className="text-xs font-semibold text-violet-600">EVM</div>
              <p className="text-sm text-muted-foreground">{r.evm}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Concept cards (mirrors the Canton infographic series)
// ─────────────────────────────────────────────────────────────────────────────

function ConceptCards() {
  return (
    <section>
      <SectionHeader
        eyebrow="Canton primitives"
        title="Four things you can't easily do on EVM"
        sub="Each maps directly to an NHS Ledger requirement."
      />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <ConceptCard
          tone="violet"
          icon={<Shield className="h-5 w-5" />}
          title="Privacy-preserving transactions"
          tagline="Confidential by design. Verified without exposure."
          bullets={[
            "Sensitive data is encrypted and never broadcast",
            "Only authorized parties see what they're entitled to",
            "Outcomes proven cryptographically without revealing payloads",
            "Built for compliance — privacy that meets regulator expectations",
          ]}
          diagram={<PrivacyDiagram />}
        />
        <ConceptCard
          tone="lime"
          icon={<Atom className="h-5 w-5" />}
          title="Atomic settlement workflows"
          tagline="All or nothing. Simultaneous. Built for trust."
          bullets={[
            "Prepare → Lock → Execute → Settle → Complete",
            "Either every leg settles or none do",
            "Delivery-versus-payment is a single Daml choice, not a dance of bridges",
            "Deterministic finality across all parties",
          ]}
          diagram={<AtomicDiagram />}
        />
        <ConceptCard
          tone="violet"
          icon={<Users className="h-5 w-5" />}
          title="Multi-party workflow coordination"
          tagline="Orchestrate. Align. Settle. Together, privately."
          bullets={[
            "Originator, counterparty, custodian, agent, auditor — one shared workflow",
            "Role-based access: right party, right time, right data",
            "Each party sees only its slice — no joint database to leak",
            "Synchronized real-time status updates across all participants",
          ]}
          diagram={<CoordDiagram />}
        />
        <ConceptCard
          tone="lime"
          icon={<Coins className="h-5 w-5" />}
          title="Tokenized collateral movement"
          tagline="Moving value institutionally, securely, atomically."
          bullets={[
            "Tokenize real-world assets with institutional-grade standards",
            "Move collateral instantly without leaving your permissioned network",
            "Built-in policy enforcement reduces counterparty risk",
            "DvP ensures settlement happens all or nothing",
          ]}
          diagram={<CollateralDiagram />}
        />
      </div>
    </section>
  );
}

function ConceptCard({
  tone,
  icon,
  title,
  tagline,
  bullets,
  diagram,
}: {
  tone: "violet" | "lime";
  icon: React.ReactNode;
  title: string;
  tagline: string;
  bullets: string[];
  diagram: React.ReactNode;
}) {
  const ring =
    tone === "violet" ? "ring-violet-500/30" : "ring-lime-400/30";
  const iconBg =
    tone === "violet"
      ? "bg-violet-500/15 text-violet-300"
      : "bg-lime-400/15 text-lime-300";
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-slate-950 to-black p-6 text-white ring-1 ${ring}`}
    >
      <div className="flex items-start gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-lg ${iconBg}`}>
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <p className="text-xs uppercase tracking-wider text-white/50">{tagline}</p>
        </div>
      </div>
      <div className="mt-5 rounded-xl border border-white/10 bg-black/40 p-4">
        {diagram}
      </div>
      <ul className="mt-5 space-y-2 text-sm text-white/75">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <CheckCircle2
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                tone === "violet" ? "text-violet-300" : "text-lime-300"
              }`}
            />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Inline SVG mini-diagrams ─────────────────────────────────────────────────

function NeonBox({
  x,
  y,
  w = 56,
  h = 56,
  color,
  label,
  icon: Icon,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  color: string;
  label?: string;
  icon?: typeof Building2;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={6}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
      {Icon && (
        <foreignObject x={x + w / 2 - 10} y={y + h / 2 - 14} width={20} height={20}>
          <div style={{ color }}>
            <Icon size={20} />
          </div>
        </foreignObject>
      )}
      {label && (
        <text
          x={x + w / 2}
          y={y + h + 12}
          fill="rgba(255,255,255,0.6)"
          fontSize={8}
          textAnchor="middle"
          fontFamily="monospace"
        >
          {label}
        </text>
      )}
    </g>
  );
}

function PrivacyDiagram() {
  const violet = "#a78bfa";
  const lime = "#bef264";
  return (
    <svg viewBox="0 0 320 120" className="w-full">
      <NeonBox x={12} y={32} color={violet} icon={Building2} label="PARTY A" />
      <NeonBox x={252} y={32} color={violet} icon={Building2} label="PARTY B" />
      <g>
        <circle
          cx={160}
          cy={60}
          r={26}
          fill="none"
          stroke={lime}
          strokeWidth={1.5}
          style={{ filter: `drop-shadow(0 0 6px ${lime})` }}
        />
        <foreignObject x={150} y={50} width={20} height={20}>
          <div style={{ color: lime }}>
            <Lock size={20} />
          </div>
        </foreignObject>
      </g>
      <line x1={68} y1={60} x2={134} y2={60} stroke={lime} strokeDasharray="3 3" />
      <line x1={186} y1={60} x2={252} y2={60} stroke={lime} strokeDasharray="3 3" />
    </svg>
  );
}

function AtomicDiagram() {
  const lime = "#bef264";
  const steps = ["PREPARE", "LOCK", "EXECUTE", "SETTLE", "DONE"];
  return (
    <svg viewBox="0 0 320 80" className="w-full">
      {steps.map((s, i) => {
        const x = 16 + i * 64;
        return (
          <g key={s}>
            <rect
              x={x}
              y={24}
              width={40}
              height={24}
              rx={4}
              fill="none"
              stroke={lime}
              strokeWidth={1.2}
              style={{ filter: `drop-shadow(0 0 4px ${lime})` }}
            />
            <text
              x={x + 20}
              y={40}
              fill={lime}
              fontSize={7}
              textAnchor="middle"
              fontFamily="monospace"
            >
              {s}
            </text>
            {i < steps.length - 1 && (
              <line
                x1={x + 42}
                y1={36}
                x2={x + 62}
                y2={36}
                stroke="#a78bfa"
                strokeWidth={1}
                markerEnd="url(#arrowV)"
              />
            )}
          </g>
        );
      })}
      <defs>
        <marker
          id="arrowV"
          viewBox="0 0 10 10"
          refX={8}
          refY={5}
          markerWidth={5}
          markerHeight={5}
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="#a78bfa" />
        </marker>
      </defs>
    </svg>
  );
}

function CoordDiagram() {
  const violet = "#a78bfa";
  const lime = "#bef264";
  const nodes = [
    { x: 30, y: 12, label: "ORIGIN" },
    { x: 230, y: 12, label: "CPTY" },
    { x: 12, y: 70, label: "CUSTOD" },
    { x: 248, y: 70, label: "AGENT" },
  ];
  return (
    <svg viewBox="0 0 320 120" className="w-full">
      {nodes.map((n) => (
        <line
          key={n.label}
          x1={n.x + 26}
          y1={n.y + 26}
          x2={160}
          y2={60}
          stroke={lime}
          strokeDasharray="2 3"
          opacity={0.7}
        />
      ))}
      {nodes.map((n) => (
        <NeonBox
          key={n.label}
          x={n.x}
          y={n.y}
          w={52}
          h={36}
          color={violet}
          label={n.label}
        />
      ))}
      <rect
        x={130}
        y={42}
        width={60}
        height={36}
        rx={4}
        fill="none"
        stroke={lime}
        strokeWidth={1.5}
        style={{ filter: `drop-shadow(0 0 6px ${lime})` }}
      />
      <text
        x={160}
        y={64}
        fill={lime}
        fontSize={7}
        textAnchor="middle"
        fontFamily="monospace"
      >
        COORDINATE
      </text>
    </svg>
  );
}

function CollateralDiagram() {
  const violet = "#a78bfa";
  const lime = "#bef264";
  return (
    <svg viewBox="0 0 320 120" className="w-full">
      <NeonBox x={12} y={32} color={violet} icon={Building2} label="LENDER" />
      <NeonBox x={252} y={32} color={violet} icon={Building2} label="BORROWER" />
      <g>
        <rect
          x={132}
          y={36}
          width={56}
          height={48}
          rx={6}
          fill="none"
          stroke={lime}
          strokeWidth={1.5}
          style={{ filter: `drop-shadow(0 0 6px ${lime})` }}
        />
        <foreignObject x={150} y={50} width={20} height={20}>
          <div style={{ color: lime }}>
            <Coins size={20} />
          </div>
        </foreignObject>
        <text
          x={160}
          y={100}
          fill={lime}
          fontSize={7}
          textAnchor="middle"
          fontFamily="monospace"
        >
          TOKENIZED
        </text>
      </g>
      <path
        d="M 68 60 Q 100 40 132 60"
        fill="none"
        stroke={lime}
        strokeDasharray="3 3"
      />
      <path
        d="M 188 60 Q 220 80 252 60"
        fill="none"
        stroke={lime}
        strokeDasharray="3 3"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NHS mapping
// ─────────────────────────────────────────────────────────────────────────────

function NhsMapping() {
  const items = [
    {
      icon: EyeOff,
      title: "Per-tier disclosure",
      body: "DHSC → NHSE → ICB → Trust modelled as Daml parties. Each tier sees its slice; nobody sees the whole pie.",
    },
    {
      icon: Atom,
      title: "Allocation ↔ spend reconciliation",
      body: "Allocate-then-spend is one atomic workflow. No reconciliation jobs against a public ledger.",
    },
    {
      icon: Eye,
      title: "Auditor (NAO) read-only",
      body: "Add NAO as an observer party on the contracts that matter. No exposure of unrelated Trusts.",
    },
    {
      icon: Wallet,
      title: "Future tokenized deposits",
      body: "Programmable funding (e.g. ring-fenced budgets) uses the same Daml primitives. No rewrite.",
    },
  ];
  return (
    <section>
      <SectionHeader
        eyebrow="So what?"
        title="What this means for NHS Ledger"
        sub="Each Canton primitive maps to a concrete NHS requirement."
      />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {items.map((it) => (
          <div
            key={it.title}
            className="flex gap-4 rounded-xl border border-border bg-card p-5"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <it.icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">{it.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{it.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Honest trade-offs
// ─────────────────────────────────────────────────────────────────────────────

function TradeOffs() {
  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <h2 className="text-lg font-semibold">Honest trade-offs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Canton isn't a free lunch. Choosing it means accepting these deliberately:
          </p>
          <ul className="mt-3 grid gap-2 text-sm text-foreground/80 md:grid-cols-2">
            <li className="flex gap-2">
              <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                Smaller developer ecosystem than EVM — fewer Stack Overflow answers, fewer libraries.
              </span>
            </li>
            <li className="flex gap-2">
              <Scale className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                Daml learning curve. Functional + multi-party authorization is unfamiliar at first.
              </span>
            </li>
            <li className="flex gap-2">
              <Network className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                Permissioned by design — not the right tool for open public DeFi or anon users.
              </span>
            </li>
            <li className="flex gap-2">
              <Coins className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                No public DEX liquidity. Tokenized assets live on the institutional network.
              </span>
            </li>
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            For NHS public-money flows, every one of these is a feature, not a bug.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer CTAs
// ─────────────────────────────────────────────────────────────────────────────

function FooterCtas() {
  return (
    <section className="grid gap-3 md:grid-cols-3">
      <Link
        to="/hackathon"
        className="group flex items-center justify-between rounded-xl border border-border bg-card p-5 transition hover:bg-accent"
      >
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Next
          </div>
          <div className="font-semibold">Hackathon brief</div>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-1" />
      </Link>
      <Link
        to="/"
        className="group flex items-center justify-between rounded-xl border border-border bg-card p-5 transition hover:bg-accent"
      >
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Back
          </div>
          <div className="font-semibold">NHS Ledger home</div>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-1" />
      </Link>
      <a
        href="https://docs.digitalasset.com/"
        target="_blank"
        rel="noreferrer"
        className="group flex items-center justify-between rounded-xl border border-border bg-card p-5 transition hover:bg-accent"
      >
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            External
          </div>
          <div className="font-semibold">Canton & Daml docs</div>
        </div>
        <ExternalLink className="h-5 w-5 text-muted-foreground" />
      </a>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bits
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {eyebrow}
      </div>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
      {sub && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}
