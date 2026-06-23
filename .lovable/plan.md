# Make USDCx real for our app

The scaffolding is already in place — env-driven `CANTON_USDCX_PACKAGE_ID`, `liveUsdcxBalance`, `liveSettle`, the `Settle with USDCx` button, the status pill, and `docs/canton-deploy/06-usdcx.md`. What's missing is the actual on-chain wiring. Three blockers, in order.

## 1. Blocker — we're on Seaport Devnet, not Canton DevNet

USDCx (xReserve) lives on **Canton Network DevNet**, not Seaport's hackathon validator. Seaport is its own isolated synchronizer; the xReserve mint/burn operator and reserve party aren't connected to it. So step zero is: which network does the live demo run against?

- **Option A — stay on Seaport.** Ask the Seaport / Encode team whether xReserve has been or can be deployed to their domain. If no: we cannot make USDCx real on Seaport. The best we can ship is a **Mock-USDCx** DAR that we publish ourselves (same shape — `Holding` template with `issuer`, `owner`, `amount`) and treat as live in every code path. Honest framing: "atomic DvP against a self-issued token, identical wire format to xReserve".
- **Option B — provision a participant on Canton DevNet** (Fly.io single machine, per `skill/canton-fly-deploy`). xReserve is reachable from there. More work, but it's the only way to transfer *real* USDCx.

This is the only decision that needs the user — everything else follows.

## 2. Daml-side work (same for both options)

1. Uncomment the `SettleAndCountersign` choice on `Nhs:SpendCommitment` in `daml/Nhs.daml`. It needs to:
  - take `holdingCid : ContractId Usdcx.Holding` and `supplierParty : Party`
  - `exercise` the xReserve / mock `Transfer` choice on the holding, transferring `paymentAmount` (defaulting to `amountGbp`) to `supplierParty`
  - `create` a `ReconciledSpend` carrying `supplierName` and `settlementTxId = Some <transferResult>`
  - both legs commit-or-revert atomically (this is just one Daml transaction — no extra work)
2. Drop the DAR into `daml/deps/` and uncomment the `data-dependencies` block in `daml/daml.yaml`:
  - Option A: build a tiny `mock-usdcx` DAR (one template, `Holding`, with `Transfer` choice) and ship it in `daml/mock-usdcx/`.
  - Option B: download the published xReserve `usdcx-*.dar` from [https://github.com/digital-asset/xreserve-deposits/releases](https://github.com/digital-asset/xreserve-deposits/releases).
3. `dpm build` → bump `nhs-budget-app-v2` to `1.0.2` (additive change, version bump is fine — no need to rename the package).
4. Re-run codegen if we're using generated TS bindings, otherwise template-id strings are enough.

## 3. Ops + app config

1. Upload both DARs to the participant (`POST /v2/dars`): the new NHS DAR and the USDCx (or mock) DAR.
2. **Acquire balance for each Trust party:**
  - Option A (mock): add a one-shot admin route `/api/public/admin/mint-mock-usdcx` (token-gated) that submits a `MintHolding` for each Trust at app deploy time.
  - Option B (real): hit the xReserve faucet/deposit flow for each Trust party. Manual, per their docs.
3. Set secrets on the app (already wired through `cantonEnv`):
  - `CANTON_USDCX_PACKAGE_ID=<package id from the uploaded DAR>`
  - `CANTON_USDCX_TEMPLATE=Usdcx:Holding` (or `MockUsdcx:Holding`)
4. The UI pill will flip to **USDCx live on DevNet** automatically once `isUsdcxConfigured()` returns true and the balance query succeeds.

## What I will not touch unless asked

- The TS adapters (`live.server.ts`, `memory.server.ts`, `canton.functions.ts`) — they already speak the right shape.
- The `/trust/:code` UI — already has the button, gating, balance card, and toast.
- `docs/canton-deploy/06-usdcx.md` — already documents the live-mode env vars; I'll only update it after we know whether we're going Option A or Option B.

## Question for you before I write any code

Which path do you want to take? Option A as proof of concept

- **A — Mock-USDCx on Seaport** (fastest; ~1 hour of work; demonstrably atomic DvP; the token is self-issued so "real money" framing is dishonest). 
- **B — Real USDCx on Canton DevNet via a Fly.io participant** (~half a day; requires us to stand up a participant and complete the xReserve faucet flow; this is the only path to real wrapped-USDC moving on chain).
- **C — Both** (ship A now as a fallback; B as the headline demo once the participant is up).