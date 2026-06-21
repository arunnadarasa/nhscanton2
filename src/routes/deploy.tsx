import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Copy, Check, Rocket, Container, Server, KeyRound, Beaker, Loader2, AlertTriangle, Anchor } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { walletSdkSmokeTest, type WalletSdkSmokeResult } from "@/lib/canton/wallet-sdk.functions";
import { Rocket as RocketIcon } from "lucide-react";


export const Route = createFileRoute("/deploy")({
  head: () => ({
    meta: [
      { title: "Deploy Canton · NHS Ledger" },
      {
        name: "description",
        content:
          "Point the NHS Ledger at a real Canton 3.4 participant — Seaport Devnet (recommended), LocalNet, Docker, or self-hosted Fly.io.",
      },
      { property: "og:title", content: "Deploy Canton · NHS Ledger" },
      {
        property: "og:description",
        content: "Seaport Devnet, LocalNet, Docker and Fly.io install guides + the official Canton Network resource list.",
      },
    ],
  }),
  component: DeployPage,
});

type LinkItem = { title: string; href: string; desc: string };

const LINK_GROUPS: { heading: string; items: LinkItem[] }[] = [
  {
    heading: "Canton Network",
    items: [
      { title: "canton.network", href: "https://www.canton.network/", desc: "Network overview, vision, architecture." },
      { title: "Developer resources hub", href: "https://www.canton.network/developer-resources", desc: "Central index of docs, SDKs and examples." },
      { title: "5 developer pathways", href: "https://www.canton.network/blog/5-developer-pathways-for-canton-builders", desc: "Pick a builder pathway by role: infra, app dev, integrations." },
      { title: "Unity Hub · Canton devs", href: "https://unityhub.dev/canton/developers", desc: "Community hub for Canton builders." },
    ],
  },
  {
    heading: "Docs & SDK (Canton 3.4)",
    items: [
      { title: "docs.digitalasset.com", href: "https://docs.digitalasset.com/", desc: "Root of the official Canton + Daml documentation." },
      { title: "TL;DR for new Canton devs", href: "https://docs.digitalasset.com/build/3.3/overview/tldr.html", desc: "Concise technical intro and core concepts." },
      { title: "Daml language docs", href: "https://docs.daml.com/", desc: "Smart-contract language used by Canton." },
      { title: "JWT auth howto", href: "https://docs.digitalasset.com/operate/3.4/howtos/secure/apis/jwt.html", desc: "Audience-based tokens for the JSON Ledger API v2." },
      { title: "dpm toolchain", href: "https://docs.digitalasset.com/build/3.4/dpm/dpm.html", desc: "Replaces `daml assistant` in Canton 3.x — build/upload DARs." },
      { title: "Download Canton (Docker)", href: "https://docs.digitalasset.com/operate/3.4/howtos/download/docker.html", desc: "GAR image coordinates for participant + JSON API." },
    ],
  },
  {
    heading: "NHS data sources",
    items: [
      { title: "King's Fund — NHS budget", href: "https://www.kingsfund.org.uk/insight-and-analysis/data-and-charts/key-facts-figures-nhs", desc: "Headline NHS spend & workforce facts." },
      { title: "Nuffield Trust", href: "https://www.nuffieldtrust.org.uk/", desc: "Independent health think tank, finance trackers." },
      { title: "IFS — Health spending", href: "https://ifs.org.uk/", desc: "Fiscal context for DHSC settlements." },
      { title: "House of Commons Library", href: "https://commonslibrary.parliament.uk/research-briefings/cbp-7930/", desc: "NHS funding briefing for MPs." },
      { title: "NHS England", href: "https://www.england.nhs.uk/", desc: "Allocations to ICBs, contracting framework." },
      { title: "One NHS Finance", href: "https://onenhsfinance.nhs.uk/", desc: "Finance community of practice." },
    ],
  },
];

type Step = { label: string; code?: string; note?: string };
type Guide = {
  id: "localnet" | "docker" | "seaport" | "fly";
  title: string;
  icon: typeof Rocket;
  oneLiner: string;
  effort: string;
  prereqs: string[];
  steps: Step[];
  thenLinks: { label: string; href: string }[];
  repoDoc: string;
  banner?: { type: "info" | "warning"; text: string };
};

const GUIDES: Guide[] = [
  {
    id: "localnet",
    title: "LocalNet",
    icon: Rocket,
    oneLiner: "One-command Splice LocalNet via Canton Builder Tool — 3 validators, global synchronizer, wallet & Scan UIs, Canton Coin.",
    effort: "~10 min · free",
    prereqs: [
      "Docker 24+ & docker compose v2 (8 GB RAM free)",
      "Node 20+ (for the `canton` CLI)",
      "dpm (Daml Package Manager) to build the NHS Ledger DAR",
    ],
    banner: { type: "info", text: "Powered by Canton-Builder-Tool — spins up the full Splice LocalNet (3 validators + global synchronizer + Canton Coin + wallet/Scan UIs) with a single command. Use this when Seaport access isn't ready." },
    steps: [
      { label: "Install the Canton Builder CLI", code: "npm i -g @canton-network-devs/canton-builder-tool\ncanton --version" },
      { label: "Start the Splice LocalNet stack", code: "canton builder start\n# Brings up: 3 validators, global synchronizer,\n# Canton Coin, wallet UIs, Scan UI" },
      { label: "Open the bundled UIs (add to /etc/hosts if needed)", code: "# Wallet (app-user):     http://wallet.localhost:2000\n# Wallet (app-provider): http://wallet.localhost:3000\n# Scan UI:               http://scan.localhost:4000" },
      { label: "Build & deploy the NHS Ledger DAR", code: "dpm build\ncanton builder deploy ./.dpm/dist/nhs.dar" },
      { label: "Point the app at LocalNet (Lovable secrets)", code: "CANTON_JSON_API_URL=http://localhost:2975\nCANTON_JWT=<dev token from JWT guide>\nCANTON_USER_ID=nhs-ledger-app" },
      { label: "Sanity-check the JSON Ledger API", code: "curl -s http://localhost:2975/v2/state/ledger-end | jq" },
      { label: "Stop the stack when done", code: "canton builder stop" },
    ],
    thenLinks: [
      { label: "Canton-Builder-Tool repo", href: "https://github.com/canton-network-devs/Canton-Builder-Tool" },
      { label: "Mint a dev JWT", href: "https://docs.digitalasset.com/operate/3.4/howtos/secure/apis/jwt.html" },
      { label: "Allocate DHSC / NHSE / Auditor parties", href: "https://github.com/canton-network-devs/Canton-Builder-Tool" },
    ],
    repoDoc: "docs/canton-deploy/01-localnet.md",
  },
  {
    id: "docker",
    title: "Docker",
    icon: Container,
    oneLiner: "Single-host docker compose — participant node with HTTP Ledger API exposed on :7575.",
    effort: "~20 min · ~$5/mo VPS",
    prereqs: ["Docker 24+ & docker compose v2", "A host with 4 GB RAM", "Open TCP 7575 (and 4001 for admin if needed)"],
    steps: [
      { label: "Copy the compose file from the repo", code: "curl -L -o docker-compose.yml \\\n  https://raw.githubusercontent.com/your-org/nhs-ledger/main/docs/canton-deploy/assets/docker-compose.yml" },
      { label: "Pull the Canton 3.4 participant image (GAR)", code: "docker pull europe-docker.pkg.dev/da-images/public/docker/canton-participant:3.4.8" },
      { label: "Bring it up", code: "docker compose up -d\ndocker compose logs -f participant" },
      { label: "Verify the JSON Ledger API", code: "curl -s http://<host>:7575/v2/state/ledger-end | jq" },
      { label: "Upload Nhs.dar (built locally with dpm)", code: "dpm build\ncurl -X POST http://<host>:7575/v2/dars \\\n  -H \"Authorization: Bearer $CANTON_JWT\" \\\n  --data-binary @.dpm/dist/nhs.dar" },
    ],
    thenLinks: [
      { label: "Put Caddy/TLS in front", href: "https://github.com/" },
      { label: "Allocate DHSC / NHSE / Auditor parties", href: "https://github.com/" },
    ],
    repoDoc: "docs/canton-deploy/02-docker.md",
  },
  {
    id: "seaport",
    title: "Seaport (Devnet)",
    icon: Anchor,
    oneLiner: "Managed 5N Sandbox validator on Canton Devnet — zero infra. Provisioned via Encode Hackathon.",
    effort: "~5 min · free (hackathon access)",
    prereqs: [
      "Loop DevNet wallet from devnet.cantonloop.com (copy your Party ID)",
      "Added to your Encode Hackathon org in Seaport (organizer invites by Party ID)",
      "Runtime + bootstrap OIDC client credentials issued by Seaport for the 5N Sandbox",
    ],
    banner: { type: "info", text: "Recommended path. Real Canton Devnet via Seaport's shared 5N Sandbox validator — no node, no IP allow-list, no validator setup." },
    steps: [
      { label: "Get your DevNet wallet & Party ID", code: "# 1. Open https://devnet.cantonloop.com → create Loop wallet\n# 2. Copy Party ID (looks like abc123::122...34a)\n# 3. Send it to your hackathon organizer so they add you to the org" },
      { label: "Log into Seaport & switch to your hackathon org", code: "# https://app.devnet.seaport.to\n# Top-left org switcher → pick the hackathon org (NOT Personal)\n# The shared validator '5n sandbox' will appear automatically" },
      { label: "Build the NHS Ledger DAR in Seaport", code: "# New Project → connect this GitHub repo (or upload daml/)\n# Click 'Build Project' → DAR appears under Builds/\n# Click 'Deploy' → pick the 5n sandbox validator" },
      { label: "Set the Devnet secrets in Lovable", code: "CANTON_DEVNET_JSON_API_URL=https://<validator>.seaport.to\nCANTON_DEVNET_OIDC_TOKEN_URL=https://<authentik>/application/o/token/\nCANTON_DEVNET_OIDC_AUDIENCE=<aud-the-validator-expects>\nCANTON_DEVNET_OIDC_RUNTIME_CLIENT_ID=<...>\nCANTON_DEVNET_OIDC_RUNTIME_CLIENT_SECRET=<...>\nCANTON_DEVNET_OIDC_BOOTSTRAP_CLIENT_ID=<...>\nCANTON_DEVNET_OIDC_BOOTSTRAP_CLIENT_SECRET=<...>" },
      { label: "Flip the header pill to Seaport", code: "# Sets the canton_network=seaport cookie\n# Every server fn now resolves CANTON_DEVNET_* envs" },
      { label: "Bootstrap parties & seed contracts", code: "curl -X POST \"$APP_URL/api/public/admin/deploy\" \\\n  -H \"x-deploy-token: $DEPLOY_ADMIN_TOKEN\" \\\n  -H \"cookie: canton_network=seaport\"" },
      { label: "Verify", code: "# /ledger shows real on-Devnet contracts\n# /allocations submits through Canton's global synchronizer" },
    ],
    thenLinks: [
      { label: "Seaport app (Devnet)", href: "https://app.devnet.seaport.to" },
      { label: "Canton Builders Seaport Guide", href: "https://github.com/Jatinp26/Seaport-Guide" },
      { label: "Loop DevNet wallet", href: "https://devnet.cantonloop.com" },
    ],
    repoDoc: "docs/canton-deploy/08-network-toggle.md",

  },
  {
    id: "fly",
    title: "Fly.io",
    icon: Server,
    oneLiner: "Self-hosted Canton participant + built-in HTTP Ledger API behind Fly's TLS edge.",
    effort: "~30 min · ~$20/mo",
    prereqs: ["flyctl installed and logged in", "A Postgres for the participant (Fly Postgres works)", "The Dockerfile in docs/canton-deploy/assets/fly/"],
    banner: { type: "warning", text: "Paused. The shared NHS Ledger Fly.io instance has been removed — Seaport Devnet is now the default. This path still works if you want to self-host." },
    steps: [
      { label: "Create the app", code: "fly apps create nhs-canton-participant\nfly postgres create --name nhs-canton-pg --region lhr" },
      { label: "Attach Postgres and set secrets", code: "fly postgres attach nhs-canton-pg -a nhs-canton-participant\nfly secrets set CANTON_ADMIN_PASSWORD=$(openssl rand -hex 24) \\\n  JWT_HMAC_SECRET=$(openssl rand -hex 32) -a nhs-canton-participant" },
      { label: "Deploy with the bundled Dockerfile", code: "cd docs/canton-deploy/assets/fly\nfly deploy -c participant.fly.toml" },
      { label: "Smoke test through Fly's edge", code: "curl -s https://nhs-canton-participant.fly.dev/v2/state/ledger-end | jq" },
      { label: "Wire Lovable secrets (CANTON_FLY_* namespace)", code: "CANTON_FLY_JSON_API_URL=https://nhs-canton-participant.fly.dev\nCANTON_FLY_JWT_PRIVATE_KEY=<RS256 PEM, base64-encoded>\nCANTON_USER_ID=nhs-ledger-app" },
    ],
    thenLinks: [
      { label: "JWT issuance (audience-based)", href: "https://github.com/" },
      { label: "DAR upload & party allocation", href: "https://github.com/" },
    ],
    repoDoc: "docs/canton-deploy/03-fly-io.md",
  },
];

const SECRETS = [
  { name: "CANTON_JSON_API_URL", desc: "Base URL of the participant's HTTP Ledger API, e.g. https://nhs-canton.fly.dev" },
  { name: "CANTON_JWT", desc: "Bearer token (audience-scoped) the app uses on every JSON Ledger API v2 call." },
  { name: "CANTON_USER_ID", desc: "Ledger user the app authenticates as. Rights granted server-side via Users API." },
  { name: "CANTON_PARTY_DHSC", desc: "Party ID for the DHSC operator (allocator)." },
  { name: "CANTON_PARTY_NHSE", desc: "Party ID for NHS England (sub-allocator)." },
  { name: "CANTON_PARTY_AUDITOR", desc: "Read-only party with observer rights on all NHS contracts." },
];

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 pr-12 text-xs leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded border border-border bg-background/80 text-muted-foreground transition hover:text-foreground"
        aria-label="Copy"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function GuidePanel({ guide }: { guide: Guide }) {
  const Icon = guide.icon;
  return (
    <div className="space-y-6">
      {guide.banner && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
          <p className="text-sm leading-relaxed text-foreground">{guide.banner.text}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">{guide.title}</h3>
            <p className="text-sm text-muted-foreground">{guide.oneLiner}</p>
          </div>
        </div>
        <Badge variant="secondary" className="self-start sm:self-auto">{guide.effort}</Badge>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prerequisites</h4>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {guide.prereqs.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick start</h4>
        <ol className="space-y-4">
          {guide.steps.map((s, i) => (
            <li key={i} className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="text-sm font-medium">{s.label}</span>
              </div>
              {s.code && <CodeBlock code={s.code} />}
              {s.note && <p className="pl-7 text-xs text-muted-foreground">{s.note}</p>}
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-md border border-dashed border-border p-4 text-sm">
        <p className="mb-2 font-medium">Then:</p>
        <div className="flex flex-wrap gap-2">
          {guide.thenLinks.map((l) => (
            <Badge key={l.label} variant="outline">{l.label}</Badge>
          ))}
          <span className="text-xs text-muted-foreground">
            Full walkthrough lives at <code className="rounded bg-muted/60 px-1 py-0.5 text-[11px]">{guide.repoDoc}</code>.
          </span>
        </div>
      </div>
    </div>
  );
}

function DeployPage() {
  return (
    <AppShell>
      <div className="space-y-12">
        <header className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Operator guide
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Deploy a Canton participant</h1>
          <p className="max-w-3xl text-muted-foreground">
            Four deployment paths for running the NHS Ledger against a real Canton 3.4 participant node,
            plus the official Canton Network resources we lean on.
          </p>
        </header>

        <section>
          <h2 className="mb-4 text-lg font-semibold">Install Canton</h2>
          <Tabs defaultValue="seaport" className="w-full">
            <TabsList className="grid w-full grid-cols-2 gap-1 h-auto sm:grid-cols-4">
              {GUIDES.map((g) => (
                <TabsTrigger key={g.id} value={g.id} className="text-xs sm:text-sm">{g.title}</TabsTrigger>
              ))}
            </TabsList>

            {GUIDES.map((g) => (
              <TabsContent key={g.id} value={g.id} className="mt-6">
                <GuidePanel guide={g} />
              </TabsContent>
            ))}
          </Tabs>
        </section>

        <section className="rounded-lg border border-border bg-card/40 p-5">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Lovable secrets cheat sheet</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Paste these in <span className="font-medium text-foreground">Project Settings → Secrets</span> after
            your participant is reachable. Without them the app stays in simulated mode.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {SECRETS.map((s) => (
              <div key={s.name} className="rounded-md border border-border bg-background/60 p-3">
                <code className="text-xs font-semibold text-primary">{s.name}</code>
                <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <WalletSdkRuntimeCheck />

        <RuntimeDeployPanel />

        <section>
          <h2 className="mb-4 text-lg font-semibold">Important links</h2>
          <div className="space-y-8">
            {LINK_GROUPS.map((group) => (
              <div key={group.heading}>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.heading}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group rounded-lg border border-border bg-card/40 p-4 transition hover:border-primary/40 hover:bg-card"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-foreground">{item.title}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:text-primary" />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function WalletSdkRuntimeCheck() {
  const run = useServerFn(walletSdkSmokeTest);
  const [state, setState] = useState<
    { status: "idle" } | { status: "loading" } | { status: "done"; result: WalletSdkSmokeResult } | { status: "error"; error: string }
  >({ status: "idle" });

  return (
    <section className="rounded-lg border border-border bg-card/40 p-5">
      <details>
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <Beaker className="h-4 w-4 text-primary" />
          Wallet SDK runtime check
          <span className="text-xs font-normal text-muted-foreground">
            (verifies @canton-network/wallet-sdk bundles + runs on Cloudflare workerd)
          </span>
        </summary>
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Calls a server function that dynamically imports the SDK, constructs an offline instance,
            generates an Ed25519 key pair, and computes its fingerprint. No participant required.
          </p>
          <button
            type="button"
            onClick={async () => {
              setState({ status: "loading" });
              try {
                const result = await run();
                setState({ status: "done", result });
              } catch (e) {
                setState({ status: "error", error: e instanceof Error ? e.message : String(e) });
              }
            }}
            disabled={state.status === "loading"}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-60"
          >
            {state.status === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Run smoke test
          </button>
          {state.status === "done" && (
            <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed">
              <code>{JSON.stringify(state.result, null, 2)}</code>
            </pre>
          )}
          {state.status === "error" && (
            <pre className="overflow-x-auto rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive">
              <code>RPC failed: {state.error}</code>
            </pre>
          )}
        </div>
      </details>
    </section>
  );
}

function RuntimeDeployPanel() {
  const [token, setToken] = useState("");
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "done"; result: unknown }
    | { status: "error"; error: string }
  >({ status: "idle" });

  return (
    <section className="rounded-lg border border-border bg-card/40 p-5">
      <div className="mb-3 flex items-center gap-2">
        <RocketIcon className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold">One-click deploy</h2>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">
            Mode: <Badge variant="secondary">localnet</Badge> (Fly.io self-hosted)
          </p>
          <p>
            Run <code className="rounded bg-muted/60 px-1 py-0.5">bash scripts/deploy-canton-fly.sh</code> (needs a{" "}
            <code className="rounded bg-muted/60 px-1 py-0.5">FLY_API_TOKEN</code>). Paste the resulting{" "}
            <code className="rounded bg-muted/60 px-1 py-0.5">CANTON_JSON_API_URL</code>,{" "}
            <code className="rounded bg-muted/60 px-1 py-0.5">CANTON_JWT_PRIVATE_KEY</code>,{" "}
            <code className="rounded bg-muted/60 px-1 py-0.5">DEPLOY_ADMIN_TOKEN</code> into Project Settings → Secrets, then deploy below.
          </p>
        </div>
        <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">
            Mode: <Badge variant="secondary">devnet</Badge> (Seaport 5N Sandbox)
          </p>
          <p>
            Build + deploy the DAR via Seaport. Then set{" "}
            <code className="rounded bg-muted/60 px-1 py-0.5">CANTON_MODE=devnet</code>,{" "}
            <code className="rounded bg-muted/60 px-1 py-0.5">CANTON_JSON_API_URL</code>,{" "}
            <code className="rounded bg-muted/60 px-1 py-0.5">CANTON_OIDC_TOKEN_URL</code>,{" "}
            <code className="rounded bg-muted/60 px-1 py-0.5">CANTON_OIDC_AUDIENCE</code>, and the OIDC client_id/secret pairs. DAR upload is skipped — party allocation + rights granting happens below.
          </p>
        </div>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Allocates DHSC / NHSEngland / Auditor + every ICB and demo Trust party, persists the resulting
        party-ID mapping, then creates the{" "}
        <code className="rounded bg-muted/60 px-1 py-0.5 text-[11px]">lovable-nhs-app</code> ledger user with
        <code className="rounded bg-muted/60 px-1 py-0.5 text-[11px]">CanActAs</code> /
        <code className="rounded bg-muted/60 px-1 py-0.5 text-[11px]">CanReadAs</code> rights on every party.
        Idempotent — safe to re-run against either mode.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="DEPLOY_ADMIN_TOKEN"
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={!token || state.status === "loading"}
          onClick={async () => {
            setState({ status: "loading" });
            try {
              const res = await fetch("/api/public/admin/deploy", {
                method: "POST",
                headers: { "x-deploy-token": token, "Content-Type": "application/json" },
                body: JSON.stringify({}),
              });
              const json = await res.json();
              if (!res.ok) {
                setState({ status: "error", error: JSON.stringify(json, null, 2) });
              } else {
                setState({ status: "done", result: json });
              }
            } catch (e) {
              setState({ status: "error", error: e instanceof Error ? e.message : String(e) });
            }
          }}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {state.status === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Deploy now
        </button>
      </div>
      {state.status === "done" && (
        <pre className="mt-4 overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed">
          <code>{JSON.stringify(state.result, null, 2)}</code>
        </pre>
      )}
      {state.status === "error" && (
        <pre className="mt-4 overflow-x-auto rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive">
          <code>{state.error}</code>
        </pre>
      )}
    </section>
  );
}
