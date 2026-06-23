# USDCx Supplier Settlement

The NHS Ledger app does atomic DvP settlement (countersign + USDCx transfer
in one Daml transaction). There are **two** ways to plug in the USDCx leg:

| Mode | Package | Works on | Real value? |
| --- | --- | --- | --- |
| **Mock-USDCx (default for hackathon)** | `daml/mock-usdcx` (self-issued) | Any participant — Seaport, LocalNet, DevNet, Fly.io | No — demo token |
| **Real xReserve USDCx** | [`xreserve-deposits`](https://github.com/digital-asset/xreserve-deposits) | Canton Network **DevNet** only | Yes — wrapped USDC |

Both share the same wire shape (`{ issuer, owner, amount }` Holding template
with a `Transfer` choice), so the NHS app code is identical for either.
Picking the real one is a config swap, not a code change.

- xReserve programme docs: <https://docs.digitalasset.com/integrate/devnet/usdcx-support/index.html>
- xReserve repo + DAR releases: <https://github.com/digital-asset/xreserve-deposits>

## What the app does

`Nhs:SpendCommitment` carries `supplierName : Optional Text` (human-readable
label, e.g. "AstraZeneca"). When the commissioner settles, they pass a
*separate* `supplierParty : Party` argument — the on-chain payee. Text label
and on-chain identity are deliberately kept apart, because procurement
records normally have a supplier name long before they have a wallet.

The `SettleAndCountersign` choice atomically:

1. Exercises `Transfer` on the Trust's `Holding`, moving `paymentAmount`
   (defaults to `amountGbp` 1:1) from Trust to `supplierParty`.
2. Creates a `ReconciledSpend` carrying `supplierName` and
   `settlementTxId = Some <transferred holding cid>`.

If the transfer fails (wrong owner, insufficient balance, archived contract)
the countersignature reverts too. One Daml transaction, no HTLC, no bridge,
no oracle.

## Memory mode (no participant)

Out of the box (no `CANTON_JSON_API_URL`) the app simulates USDCx in
process: every Trust party starts with £200m of demo USDCx, and
`Settle with USDCx` runs against the in-memory ledger. The pill reads
**USDCx simulated**.

## Option A — Mock-USDCx on any participant (Seaport / LocalNet / Fly.io)

This is the path that works on the hackathon's Seaport validator (where the
real xReserve programme is **not** deployed).

1. **Build both DARs.** mock-usdcx first (NHS depends on it):

   ```bash
   cd daml/mock-usdcx && dpm build
   cd ..                 && dpm build
   ```

   Produces:
   - `daml/mock-usdcx/.daml/dist/mock-usdcx-1.0.0.dar`
   - `daml/.daml/dist/nhs-budget-app-v2-1.0.2.dar`

2. **Upload both to the participant** (`POST /v2/dars`) — mock-usdcx first,
   then NHS (which references it as a data-dependency).

3. **Configure the app secrets:**

   ```bash
   CANTON_USDCX_PACKAGE_ID=#mock-usdcx           # or the resolved package hash
   CANTON_USDCX_TEMPLATE=MockUsdcx:Holding       # default; only override if you fork
   CANTON_USDCX_ISSUER=Auditor                   # optional; defaults to the Auditor party
   ```

4. **Mint balances** by hitting the token-gated admin route once at deploy time:

   ```bash
   curl -X POST https://<your-app>/api/public/admin/mint-mock-usdcx \
     -H "x-deploy-token: $DEPLOY_ADMIN_TOKEN" \
     -H "content-type: application/json" \
     -d '{"amountPerTrust":"200000000.00"}'
   ```

   The route creates one `MockUsdcx:Holding` per Trust (`Trust-GSTT`,
   `Trust-MFT`, …) submitted as the `Auditor` party. Re-running tops every
   Trust up by another `amountPerTrust`.

5. The pill flips to **USDCx live on DevNet** automatically once
   `isUsdcxConfigured()` is true and the balance query returns.

### Honest framing for the demo

Mock-USDCx Holdings are self-issued by the Auditor party. They have zero
real-world value. What's "real" in this mode:

- the atomic on-chain settlement (one Daml transaction, both legs or neither);
- the privacy model (Trust → ICB disclosure unchanged);
- the wire shape, which is byte-compatible with the xReserve Holding.

What's **not** real: the token itself. Don't claim wrapped USDC has moved.

## Option B — Real xReserve USDCx on Canton DevNet

This is the path to wrapped-USDC actually moving on chain. Requires a
participant connected to Canton Network DevNet (see `03-fly-io.md`).

1. Stand up the participant on Canton DevNet.
2. Download the published xReserve DAR from
   <https://github.com/digital-asset/xreserve-deposits/releases> and drop it
   into `daml/deps/usdcx-<version>.dar`.
3. In `daml/daml.yaml`, replace the data-dependency line:

   ```yaml
   data-dependencies:
     - deps/usdcx-<version>.dar
   ```

4. In `daml/Nhs.daml`, change `import qualified MockUsdcx` to
   `import qualified Usdcx as MockUsdcx` (or rename the references).
5. `dpm build` and upload the new NHS DAR + the xReserve DAR.
6. Acquire test USDCx for each Trust party via the xReserve faucet / deposit flow.
7. Set the secrets:

   ```bash
   CANTON_USDCX_PACKAGE_ID=<package id of the xReserve DAR>
   CANTON_USDCX_TEMPLATE=Usdcx:Holding
   ```

   Do NOT run the `mint-mock-usdcx` admin route in this mode — balances
   come from the xReserve faucet.

## Caveats

- DevNet-only for the real token. MainNet xReserve is not live as of this writing.
- The Trust party must be the `owner` of the Holding being transferred.
  Multi-holding settlement (splitting one holding across two suppliers)
  needs the choice to take a list of CIDs — a small extension.
- xReserve is wrapped, not bearer; the reserve custody + mint/burn operator
  is a trust point. Mock-USDCx is the Auditor party's IOU.
