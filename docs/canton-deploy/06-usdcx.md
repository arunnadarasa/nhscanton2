# USDCx Supplier Settlement (DevNet)

USDCx is wrapped USDC issued natively on Canton by Digital Asset's xReserve
programme. It only exists on **DevNet** today — never use it for production
value transfer.

- Programme docs: https://docs.digitalasset.com/integrate/devnet/usdcx-support/index.html
- Token + deposit contracts: https://github.com/digital-asset/xreserve-deposits
- Browsable types: https://digital-asset.github.io/xreserve-deposits/

## What this app does with USDCx

A `Nhs:SpendCommitment` with a `supplier` field set becomes settleable. The
new `SettleAndCountersign` choice atomically:

1. Transfers a USDCx `Holding` from the Trust to the supplier.
2. Archives the commitment and creates a `Nhs:ReconciledSpend`.

If the transfer fails (wrong owner, insufficient balance, archived contract)
the countersignature reverts too — true DvP, no HTLC, no bridge, no oracle.

## Memory mode (default)

Out of the box the app simulates USDCx: every Trust party starts with £200m
of demo USDCx, and `Settle with USDCx` runs against the in-process ledger.
Status pill reads **USDCx simulated**.

## Live mode on DevNet

1. Stand up a participant connected to Canton DevNet (see `03-fly-io.md`).
2. Install the xReserve `Usdcx` DAR on the participant.
3. Acquire test USDCx for your Trust party via the xReserve faucet / deposit flow.
4. Build the NHS DAR — `daml/daml.yaml` includes the USDCx data-dependency block
   (commented; uncomment after dropping the DAR into `daml/deps/`).
5. Set these env vars on the app:

   ```bash
   CANTON_JSON_API_URL=https://your-participant.example.com
   CANTON_JWT=<participant JWT for the Trust user>
   CANTON_USDCX_PACKAGE_ID=<package id of the deployed Usdcx DAR>
   CANTON_USDCX_TEMPLATE=Usdcx:Holding   # default; override if you fork the package
   ```

Status pill flips to **USDCx live on DevNet** and the balance card pulls
real holdings via the wallet SDK's `acsReader`.

## Caveats

- DevNet-only. MainNet xReserve is not live as of this writing.
- The Trust party must be the `owner` of the USDCx Holding being transferred.
  For multi-holding settlement (splitting one holding across two suppliers)
  you'll need to extend the choice to take a list of CIDs.
- The reserve custody + mint/burn operator is a trust point — USDCx is wrapped,
  not bearer.
