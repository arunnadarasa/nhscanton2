## Goal
Allocate the new DARs (`mock-usdcx-1.0.0`, `nhs-budget-app-v2-1.0.2`) on the Seaport-managed devnet validator and mint demo USDCx balances for every Trust party.

## Approach
Devnet is already fully wired (`CANTON_DEVNET_*` secrets exist). The mode selector resolves the active network from the `canton_network` cookie before falling back to `CANTON_MODE`, so we can target devnet by sending `Cookie: canton_network=seaport` on the admin curls — no new secrets, no redeploy.

## Steps (executed from the sandbox)

1. `POST https://nhscanton2.lovable.app/api/public/admin/self-deploy`
   - Headers: `x-deploy-token: $DEPLOY_ADMIN_TOKEN`, `Cookie: canton_network=seaport`, `content-type: application/json`
   - Body: `{}`
   - Expected: DARs uploaded (409 treated as success), parties allocated, runtime user + rights created. Capture the response body verbatim.

2. If step 1 succeeds, `POST https://nhscanton2.lovable.app/api/public/admin/mint-mock-usdcx`
   - Same headers.
   - Body: `{}` (defaults to 200,000,000.00 USDCx per Trust)
   - Expected: one `MockUsdcx:Holding` contract minted per Trust party, returned with `contractId` and `issuer`.

3. Report the per-step JSON results back, including any per-Trust failures.

## Failure handling
- If `self-deploy` returns `missing-config`, the devnet secrets aren't being picked up — surface the raw error and stop.
- If `mint-mock-usdcx` returns `CANTON_USDCX_PACKAGE_ID not set`, request adding that secret with the package id printed by `self-deploy` (or by `/v2/packages`) before retrying.
- All non-2xx responses are returned verbatim; no swallowing.

## Out of scope
- Setting `CANTON_MODE=devnet` globally (not needed; cookie override is sufficient and reversible).
- Any DAML/code changes — the DARs are already live at `/dars/`.
