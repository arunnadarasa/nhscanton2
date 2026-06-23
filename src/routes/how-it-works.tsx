import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

const MEGA_PROMPT = `Build me a "Canton Live App" — a full-stack web app that reads and writes to a REAL Canton 3.4 ledger (not a mock). Use Lovable Cloud where helpful, but the source of truth for business data must be Canton, accessed via the JSON Ledger API v2.

## What the app does
Pick a simple multi-party workflow (default: NHS budget allocation between DHSC, NHSEngland, and an Auditor party). Model it in Daml with three templates:
- BudgetAllocation (issuer -> recipient, amount, purpose)
- SpendCommitment (recipient commits a planned spend, observed by auditor)
- ReconciledSpend (auditor confirms — final, immutable)

If I ask for a different domain (supply chain, carbon credits, settlement, etc.), swap the templates but keep the same 3-party pattern.

## Stack
- TanStack Start (file-based routes in src/routes/, server functions via createServerFn, server routes under src/routes/api/public/ for webhooks).
- Tailwind + shadcn/ui. Dark, minimal, "fintech-grade" aesthetic. NOT a generic SaaS look.
- Daml SDK 3.4 model in /daml, built to a .dar file.
- **Default Canton target: Seaport-managed Devnet** (a 5N Sandbox validator on Canton Network Devnet). Access is via OIDC client_credentials — no infra to run. This is what Encode Hackathon participants get out of the box.
- **Optional self-hosted target (paused, but supported): Canton 3.4 on Fly.io** — one stateful machine, pinned to count=1, plus Fly Postgres. RS256 JWTs minted in-Worker. Code paths still exist behind the header pill's "Fly" option.
- 3-way header toggle: Memory (in-process demo) / Fly (self-hosted) / Seaport (Devnet). Writes a canton_network cookie; each server function reads the cookie and resolves env vars from the matching namespace (CANTON_FLY_* or CANTON_DEVNET_*).

## Required Lovable secrets (prompt me to set these, do NOT hardcode)

For **Seaport Devnet** (recommended):
- CANTON_DEVNET_JSON_API_URL — Seaport validator URL
- CANTON_DEVNET_OIDC_TOKEN_URL — Authentik token endpoint
- CANTON_DEVNET_OIDC_AUDIENCE — aud claim the validator expects
- CANTON_DEVNET_OIDC_RUNTIME_CLIENT_ID / _SECRET — runtime user (reads + commands)
- CANTON_DEVNET_OIDC_BOOTSTRAP_CLIENT_ID / _SECRET — admin (party alloc, DAR upload)

For **Fly.io self-hosted** (optional, paused):
- CANTON_FLY_JSON_API_URL — e.g. https://my-canton-participant.fly.dev
- CANTON_FLY_JWT_PRIVATE_KEY — RS256 PEM (or base64 PEM)
- CANTON_USER_ID — runtime user id, default "lovable-app-user"
- DEPLOY_ADMIN_TOKEN — random hex, gates the bootstrap route

## Mode flip (real vs simulated)
Create a server util currentCantonNetwork() that returns "devnet" / "localnet" / "memory" based on (1) the canton_network cookie, (2) CANTON_MODE env, (3) which secrets are present. Render a 3-way pill in the header showing only the networks that are wired up. Drive the live badge from GET /api/public/health which returns { mode, network, liveCheck: { ok, offset } }.

## Pages
- / — landing page explaining the app, with the network pill.
- /ledger — live list of contracts, grouped by template, refreshing every few seconds. Real data from /v2/state/active-contracts.
- /deploy — one-click "Bootstrap ledger" button that POSTs to /api/public/admin/deploy. Shows step-by-step results: DAR uploaded, parties allocated, user created, rights granted, verify probe, rights diff.
- /audit — read-only timeline of all contract events for the Auditor party.
- /how-it-works — non-technical explanation of the stack.

## Bootstrap route (idempotent, token-gated, network-aware)
POST /api/public/admin/deploy with header x-deploy-token:
1. Fetch the bootstrap token (OIDC client_credentials on Devnet, or mint admin RS256 JWT on Fly)
2. POST /v2/dars (upload the baked-in DAR; treat 409 as success)
3. POST /v2/parties for each logical party name; persist { logical_name -> party_id::fingerprint } in the canton_parties table. Reuse existing rows on re-run so you don't hit Canton's truncated "Party already exists" error.
4. POST /v2/users to create the runtime user (include isDeactivated, metadata, identityProviderId; 409 ok). On Devnet, **derive the user id from the runtime token's sub claim** — don't hardcode it.
5. POST /v2/users/{id}/rights with top-level userId + identityProviderId:"", rights array using { kind: { CanActAs: { value: { party } } } } shape (note the nested value)
6. Verify by minting a runtime token and calling /v2/state/active-contracts; return the raw response body on any non-2xx so I can debug.

## Command submission (don't get this wrong)
Two endpoints, two different shapes:
- POST /v2/commands/submit-and-wait — flat body { commands, userId, commandId, actAs, readAs }. Returns ONLY { updateId, completionOffset }.
- POST /v2/commands/submit-and-wait-for-transaction — body MUST be wrapped: { commands: { commands, userId, commandId, actAs, readAs } }. Returns events[] with CreatedEvent.contractId. Use this whenever the app needs the new contract id back.
A flat body on the for-transaction endpoint returns 400 "Missing required field at 'commands.commands'". The wrap is non-negotiable.

## Daml field types
Anything the user types into a free-text field MUST be modelled as Optional Text, never Optional Party. A Party is a real ledger participant; submitting an unknown party returns UNKNOWN_INFORMEES at command submission. If a field needs both a human label and an on-chain identity (e.g. a supplier that might later be paid in USDCx), model them as two fields: supplierName : Optional Text + supplierParty : Optional Party. The text label is the audit-trail record; the party is added only when an on-chain settlement is being prepared.

## Schema migrations on a live ledger
If you rename or retype a field on an installed template, re-uploading the DAR at a bumped patch (1.0.0 -> 1.0.1) under the same package name fails with KNOWN_PACKAGE_VERSION — Canton's upgrade check treats a field rename as a remove + add, which isn't backward-compatible. Workaround for a hackathon: bump the package name in daml.yaml (nhs-budget-app -> nhs-budget-app-v2), rebuild, and update every #nhs-budget reference in TS (template-id helpers in live.server.ts, DAR_ASSET_PATH in deploy-core.server.ts). Canton treats it as a fresh package; the new templates are immediately usable.

## Devnet-specific gotcha: userId MUST match the runtime token's sub claim
On Devnet, the validator enforces that the userId field in every command submission matches the sub (or applicationId) claim of the bearer token. Hardcoding userId: "lovable-nhs-app" returns a 403 "security-sensitive" error with no detail. Decode the OIDC runtime token server-side, pull sub, and use that as both the command userId and the user you grant party rights to. The same id must flow through the bootstrap and the runtime — getRuntimeLedgerUserId() in tokens.server.ts is the canonical helper.


## Client-side gotcha: fully-qualified party ids in payloads
Contract payloads carry "NHSEngland::1220abc…", not the logical name. Filtering with payload.allocator === "NHSEngland" silently returns empty. Match by prefix or via the bootstrap-persisted map:

  const sameParty = (p: string, logical: string) => p === logical || p.startsWith(\`\${logical}::\`);

## Deployment docs
Generate /docs/canton-deploy/ with copy-paste instructions for both paths:
- 08-network-toggle.md — Seaport Devnet via OIDC (primary)
- 03-fly-io.md + 07-sandbox-bootstrap.md — Fly self-hosted (paused, still functional)
- 04-jwt.md, 05-upload-dar.md, LEARNINGS.md — shared

## Non-negotiables
- Devnet is the default; Fly is opt-in. Both must keep working behind the header toggle.
- On Fly: one machine for the participant, never scale > 1.
- Never use the admin/bootstrap token for ledger reads — use the runtime token.
- Bootstrap must be safe to re-run; reuse persisted party rows.
- Never log or return private keys / JWTs / OIDC secrets.
- The "Live" badge must reflect a real /v2/state/ledger-end probe, not just secret presence.
- Use /v2/commands/submit-and-wait-for-transaction (wrapped body) whenever the app needs the created contract id back.
- Never filter contract payloads with payload.party === "LogicalName" — match by prefix.
- On Devnet, always derive the command userId from the runtime token sub claim.
- Never model a free-text field as Optional Party. Use Optional Text for human labels; add a separate Optional Party field only when an on-chain identity is required.


When you're done, give me: (a) the secrets I still need to set for whichever network I want, (b) the exact deploy steps (paste secrets → flip header pill → click Deploy), (c) confirmation that /ledger shows real on-ledger contracts. Then publish.`;

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it's built — Lovable + Canton on Seaport Devnet" },
      {
        name: "description",
        content:
          "A non-technical tour of how this app runs on a real Canton 3.4 ledger — built in Lovable, deployed on Seaport's managed Devnet validator via Encode Hackathon access.",
      },
      { property: "og:title", content: "How it's built — Lovable + Canton on Seaport Devnet" },
      {
        property: "og:description",
        content:
          "Real Canton ledger, no simulation. Lovable for the app, Seaport-managed Devnet for the validator. Fly.io self-host still supported but paused.",
      },
    ],
  }),
  component: HowItWorksPage,
});

function HowItWorksPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-12">
        {/* Hero */}
        <section className="space-y-6 text-center">
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            Canton Hackathon blueprint
          </Badge>
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
            Built end-to-end on Lovable,
            <br />
            running on a <span className="text-primary">real Canton ledger</span>.
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Every contract on this site is created by a Daml template running on a Canton 3.4
            participant on Fly.io. No mock data, no fake API. This page shows you exactly how
            it's wired — and how a non-technical builder can ship the same thing in an
            afternoon.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link to="/ledger">See the live ledger</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/deploy">Deploy your own</Link>
            </Button>
          </div>
        </section>

        {/* Stack */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold">The stack at a glance</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Lovable</CardTitle>
                <CardDescription>App layer</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>Frontend, TanStack Start server functions, auth, secrets, one-click publish.</p>
                <p>You describe what you want; Lovable writes the code and ships it.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Seaport Devnet</CardTitle>
                <CardDescription>The ledger (default)</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  A real Canton 3.4 participant on Canton Network Devnet — Seaport's
                  managed 5N Sandbox validator. Provisioned for us by <strong>Encode Hackathon</strong>.
                </p>
                <p>OIDC <code>client_credentials</code> auth, real global synchronizer, zero infra cost.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Daml model</CardTitle>
                <CardDescription><code>nhs-budget</code> package</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  Three templates — <code>BudgetAllocation</code>,{" "}
                  <code>SpendCommitment</code>, <code>ReconciledSpend</code> — model
                  multi-party budget flow with cryptographic finality.
                </p>
              </CardContent>
            </Card>
          </div>
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="text-base">Fly.io self-host — paused</CardTitle>
              <CardDescription>Still functional, just no longer the default</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Before Encode Hackathon gave us Devnet access, this app ran its own Canton
                participant on Fly.io — one stateful machine + Fly Postgres, RS256 JWTs minted
                in-Worker, ~$20/month. That code path still works: flip the header pill to{" "}
                <strong>Fly</strong>, set the <code>CANTON_FLY_*</code> secrets, and run{" "}
                <code>/deploy</code>. We just don't recommend it as the default any more —
                Devnet is free, multi-party, and already running.
              </p>
            </CardContent>
          </Card>

        </section>

        {/* Linux sandbox */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold">No laptop setup — write Daml inside Lovable</h2>
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-5 text-sm text-muted-foreground space-y-3">
              <p>
                Lovable isn't just a frontend builder. Every project gets a <strong>real Linux sandbox</strong>{" "}
                with <code>curl</code>, <code>nix</code>, <code>bun</code>, <code>openssl</code>, and persistent{" "}
                <code>/mnt/documents/</code> storage. That means you can author, compile, and bundle a
                bespoke Daml model without installing anything on your machine.
              </p>
              <p>In this project the sandbox is used to:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Install the Daml SDK 3.4 toolchain via <code>nix</code> — no global install.</li>
                <li>Edit <code>daml/Nhs.daml</code> and run <code>daml build</code> to produce the <code>.dar</code>.</li>
                <li>Shell out to <code>flyctl</code> from <code>scripts/deploy-canton-fly.sh</code> to provision the Canton participant + Postgres and mint JWT secrets.</li>
                <li>Write secrets and helper scripts to <code>/mnt/documents/</code> so they survive across chat turns.</li>
              </ul>
              <p>
                For hackathon teams this is the real unlock: swap the NHS templates for{" "}
                <strong>any domain</strong> — supply chain, carbon credits, settlement, identity — and ship
                a fully custom Canton app end-to-end from a single chat window.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Also powered by Lovable */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold">Also powered by Lovable</h2>
          <p className="text-sm text-muted-foreground">
            Beyond the Linux sandbox, Lovable ships three more platform pieces that quietly do
            the heavy lifting for this app — and any Canton app you build on top of it.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Cloudflare Workers</CardTitle>
                <CardDescription>Global edge runtime</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  Every Lovable app's server functions and API routes run on Cloudflare's
                  workerd runtime — close to the user, autoscaled, no cold-start ops.
                </p>
                <p>
                  In this app it's what executes <code>/api/public/health</code>,{" "}
                  <code>/api/public/admin/deploy</code>, and the JWT-minting{" "}
                  <code>createServerFn</code> calls that talk to Canton.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Lovable Cloud</CardTitle>
                <CardDescription>Managed app database, auth, storage</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  One-click backend for the app-side data that doesn't belong on the ledger:
                  user accounts, sessions, saved deploy state, cached views, uploaded files.
                </p>
                <p>
                  Canton stays the source of truth for contracts and settlement; Lovable Cloud
                  handles everything around it so the participant node stays focused.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Lovable AI</CardTitle>
                <CardDescription>Gemini + GPT, no API keys</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  Built-in access to leading AI models, billed from workspace credits — no keys
                  to provision, no separate provider account.
                </p>
                <p>
                  Natural fit for hackathon ideas: explain a contract in plain English, suggest
                  a Daml template from a prompt, or summarize an audit trail on demand.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Real vs simulated */}
        <section>
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                Real, not simulated
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>
                The badge at the top of every page reads <strong>Live</strong> when the app
                is talking to a real Canton participant, and <strong>Simulated</strong>{" "}
                when it's using the in-memory fallback for local development.
              </p>
              <p>
                The switch happens automatically: as soon as the four Canton secrets are set
                in Lovable, <code>ledgerMode()</code> flips from <code>memory</code> to{" "}
                <code>live</code> and every read/write goes through the JSON Ledger API v2.
                You can verify by hitting <code>/api/public/health</code> — it returns{" "}
                <code>{`{ mode: "live", liveCheck: { ok: true, offset: "..." } }`}</code>.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* End-to-end flow */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold">End-to-end in 5 steps</h2>
          <ol className="space-y-4">
            {[
              {
                t: "Remix this app in Lovable",
                d: "Fork the project. Lovable gives you a live preview URL and a published .lovable.app domain. No build pipeline to wire up.",
              },
              {
                t: "Get Seaport Devnet credentials",
                d: "Encode Hackathon participants receive OIDC client_credentials for a Seaport-managed 5N Sandbox validator on Canton Devnet. Token URL, audience, runtime + bootstrap client IDs and secrets — that's it. No node to run.",
              },
              {
                t: "Set 5 secrets in Lovable",
                d: "CANTON_DEVNET_JSON_API_URL, CANTON_DEVNET_OIDC_TOKEN_URL, CANTON_DEVNET_OIDC_AUDIENCE, CANTON_DEVNET_OIDC_RUNTIME_CLIENT_ID/_SECRET, CANTON_DEVNET_OIDC_BOOTSTRAP_CLIENT_ID/_SECRET. Tokens are minted on demand and cached.",
              },
              {
                t: "Toggle to Seaport and click Deploy",
                d: "Flip the header pill to Seaport, open /deploy, hit Bootstrap. One POST uploads the DAR, allocates every party on Devnet, creates the runtime user, grants rights, and verifies — idempotent, safe to re-run.",
              },
              {
                t: "Publish",
                d: "Hit Publish in Lovable. The /ledger page now shows real on-ledger contracts settled through Canton's global synchronizer. Share the URL.",
              },
            ].map((s, i) => (
              <li key={i} className="flex gap-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary font-display text-sm font-bold text-primary-foreground">
                  {i + 1}
                </div>
                <div>
                  <div className="font-semibold">{s.t}</div>
                  <div className="text-sm text-muted-foreground">{s.d}</div>
                </div>
              </li>
            ))}
          </ol>

          <Card className="bg-muted/40">
            <CardContent className="p-4">
              <pre className="overflow-x-auto text-[11px] leading-relaxed text-muted-foreground">{`Browser
  │  (HTTPS)
  ▼
Lovable Worker  ──  createServerFn  ──▶  Canton JSON API v2  ──▶  Daml ledger
                    (mints JWT)            (port 7575, TLS)         (Postgres)`}</pre>
            </CardContent>
          </Card>
        </section>

        {/* Why it matters */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold">Why this matters for the hackathon</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• No Kubernetes, no Java toolchain on your laptop, no custom auth server.</li>
            <li>• ~$20/month infra — one Fly machine + one tiny Postgres.</li>
            <li>• Bootstrap is one HTTP call and idempotent — re-run after every redeploy.</li>
            <li>• Every step is documented under <code>docs/canton-deploy/</code> in the repo.</li>
            <li>• Non-technical builders can ship a real Canton app without writing the plumbing.</li>
          </ul>
        </section>

        {/* Going to MainNet */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold">Taking it to MainNet</h2>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-5 text-sm text-muted-foreground space-y-3">
              <p>
                Canton Network runs a <strong>DevNet</strong>, <strong>TestNet</strong>{" "}
                and <strong>MainNet</strong>. This app currently lives on{" "}
                <strong>Seaport-managed DevNet</strong> — the same JSON Ledger API v2, the
                same Daml model, the same global synchronizer. That's the staging ground
                for anything you want to take to TestNet or MainNet.
              </p>
              <p>
                Because Canton is a public network that preserves privacy, MainNet apps
                need a <strong>validator node</strong> to host their private data. You can
                either run your own validator, or partner with one of the existing
                validators in the Canton Foundation directory.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <a
                  href="https://canton.foundation/apply-to-set-up-a-validator-node/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Apply to run a validator →
                </a>
                <a
                  href="https://canton.foundation/validators/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-secondary"
                >
                  Browse current validators →
                </a>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Mega prompt */}
        <MegaPromptSection />

        {/* Links */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold">Where to next</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Button asChild variant="outline" className="justify-start">
              <Link to="/deploy">→ Deploy console</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/ledger">→ Live ledger view</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/audit">→ Audit trail</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/canton-vs-evm">→ Why Canton vs EVM</Link>
            </Button>
            <a
              href="https://canton.foundation/apply-to-set-up-a-validator-node/"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
            >
              → Apply to run a Canton validator
            </a>
            <a
              href="https://canton.foundation/validators/"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
            >
              → Canton validators directory
            </a>
            <a
              href="https://github.com/canton-network-devs/Canton-Developer-Hub"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
            >
              → Canton Developer Hub
            </a>
            <a
              href="https://docs.lovable.dev"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
            >
              → Lovable docs
            </a>
          </div>
        </section>

      </div>
    </AppShell>
  );
}

function MegaPromptSection() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(MEGA_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl font-bold">Build your own in one prompt</h2>
      <p className="text-sm text-muted-foreground">
        Paste this entire prompt into a fresh Lovable project. It tells Lovable exactly how to
        scaffold the frontend, server functions, Daml model, Fly.io deployment docs, and the
        idempotent bootstrap route — so you end up with a real Canton Live App, not a demo.
      </p>
      <Card className="border-primary/30 bg-zinc-950 text-zinc-100">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-sm font-mono text-zinc-300">
            mega-prompt.txt
          </CardTitle>
          <Button
            size="sm"
            variant="secondary"
            onClick={copy}
            className="gap-1.5"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copy prompt
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words text-[12px] leading-relaxed text-zinc-200">
            {MEGA_PROMPT}
          </pre>
        </CardContent>
      </Card>
    </section>
  );
}
