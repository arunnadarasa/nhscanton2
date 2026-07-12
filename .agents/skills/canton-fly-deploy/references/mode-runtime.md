# Runtime mode switcher (memory · localnet · devnet)

Every Canton front-end should be able to answer three questions at request time: **which ledger am I talking to right now?**, **can I fall back to a fake if that ledger is unreachable?**, and **can I replay a demo without a network?** A per-request mode switch answers all three.

## The three modes

| Mode | Ledger | When to use |
| --- | --- | --- |
| `memory` | In-process JS Map of "contracts" | Local dev, offline demos, when Devnet is out, when a customer's laptop can't reach the internet |
| `localnet` (`fly`) | Self-hosted Canton on Fly.io | Sovereign / air-gapped deployments; full control of participant |
| `devnet` (`seaport`) | Managed Seaport / Canton Network Devnet | Default. Hackathons, shared demos, anything you want auditable by a third party |

Precedence at request time: `canton_network` cookie > `CANTON_MODE` env var > `memory`.

## The server function

```ts
// src/lib/canton/mode.server.ts
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

type NetworkAlias = "memory" | "fly" | "seaport";

function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.get("cookie") ?? "";
  const found = raw.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${name}=`));
  return found?.slice(name.length + 1);
}

export const getLedgerMode = createServerFn({ method: "GET" }).handler(async () => {
  const req = getRequest();
  const cookie = readCookie(req, "canton_network") as NetworkAlias | undefined;
  const envMode = (process.env.CANTON_MODE ?? "memory") as NetworkAlias;
  const network = cookie ?? envMode;

  const available = {
    memory: true,
    fly: Boolean(process.env.CANTON_FLY_JSON_API_URL && process.env.CANTON_FLY_ADMIN_JWT_PRIVATE_KEY),
    seaport: Boolean(process.env.CANTON_DEVNET_JSON_API_URL && process.env.CANTON_DEVNET_OIDC_CLIENT_ID),
  };

  return {
    network,
    mode: network === "memory" ? "memory" : "live",
    endpoint: network === "seaport" ? process.env.CANTON_DEVNET_JSON_API_URL : process.env.CANTON_FLY_JSON_API_URL,
    available,
  };
});

export const setCantonNetwork = createServerFn({ method: "POST" })
  .inputValidator((d) => d as NetworkAlias)
  .handler(async ({ data }) => {
    // Set a Secure, HttpOnly=false cookie so the client can inspect it too.
    // Path=/, Max-Age=31536000. Return the new mode.
    return { network: data };
  });
```

## Client wiring

- On app load, read `getLedgerMode()` via TanStack Query with a short `staleTime` (30s is fine).
- Render a segmented `Memo / Devnet / (Fly)` toggle in the header. Only enable options where `available[alias]` is true.
- On toggle, POST `setCantonNetwork` then `queryClient.invalidateQueries()` + `router.invalidate()` so every loader re-runs against the new mode.
- Never gate feature access behind `mode === "live"` alone — always check `available[alias]` too, so a dev without Devnet secrets doesn't see broken buttons.

## Memory mode

Memory mode is not a mock. It's a first-class code path — the same server functions the live path uses, backed by an in-process store keyed by `templateId + contractId`. Rules:

- Assign contract ids as `local-${crypto.randomUUID()}` so demo output is visually distinguishable from real ledger ids.
- Persist the store in module scope so it survives across requests within a single worker (per-request is useless; per-process is the sweet spot).
- Seed it on startup with a small set of contracts that cover every template, so `/allocations`, `/audit`, `/trust/X`, `/icb/X` all render non-empty on first load.

## Execution log

Every submission — memory or ledger — writes one row to a persisted execution log:

```
timestamp | network | templateId | actAs | commandId | contractIdOrError
```

Store it in the same durable place your app already uses (Supabase/Postgres via `insert`). The log is what makes:

- **Demos reproducible.** Screenshots of "I just created this contract" match a row you can point at.
- **Debugging tractable.** When a call fails, the row's error body is already captured — you don't need to re-run with logging on.
- **Mode switches obvious.** A single query grouped by `network` shows exactly where each contract lives.

## Don't

- **Don't flip `CANTON_MODE` globally** when one endpoint needs a different network for one request. That's what the cookie is for.
- **Don't make `memory` a build-time flag.** It must be togglable at runtime, or your live demo has no escape hatch when Devnet blinks.
- **Don't log the raw runtime JWT** in the execution log. Log its `sub` claim if you need attribution.
- **Don't seed memory mode with data that only makes one route look good.** Cover every route the demo will visit.
