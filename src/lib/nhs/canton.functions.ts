import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  FISCAL_YEAR,
  partyAuditor,
  partyDhsc,
  partyIcb,
  partyNhsE,
  partyTrust,
} from "@/lib/nhs/data";

// client.server.ts is server-only; import lazily inside handlers so this
// .functions.ts file stays safe to reach from client-bundled route chunks.
// The `import type` is erased at build time and only carries type info.
import type * as CantonClient from "@/lib/canton/client.server";
const canton = (): Promise<typeof CantonClient> => import("@/lib/canton/client.server");

export const getLedgerMode = createServerFn({ method: "GET" }).handler(async () => {
  const { ledgerMode } = await canton();
  return ledgerMode();
});

export const getAllContracts = createServerFn({ method: "GET" }).handler(async () => {
  const { allContractsForExplorer } = await canton();
  return allContractsForExplorer();
});

export const getAllocationsForParty = createServerFn({ method: "GET" })
  .inputValidator(z.object({ party: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    const { queryAllocations } = await canton();
    return queryAllocations(data.party);
  });

export const getCommitmentsForParty = createServerFn({ method: "GET" })
  .inputValidator(z.object({ party: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    const { querySpendCommitments } = await canton();
    return querySpendCommitments(data.party);
  });

export const getReconciledForParty = createServerFn({ method: "GET" })
  .inputValidator(z.object({ party: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    const { queryReconciledSpend } = await canton();
    return queryReconciledSpend(data.party);
  });

export const allocateFromDhsc = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      amountGbp: z.string().min(1),
      purpose: z.string().min(1).max(200),
    }),
  )
  .handler(async ({ data }) => {
    const { createAllocation } = await canton();
    return createAllocation({
      allocator: partyDhsc(),
      recipient: partyNhsE(),
      fiscalYear: FISCAL_YEAR,
      amountGbp: data.amountGbp,
      purpose: data.purpose,
    });
  });

export const allocateToIcb = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      icbCode: z.string().min(1).max(10),
      amountGbp: z.string().min(1),
      purpose: z.string().min(1).max(200),
    }),
  )
  .handler(async ({ data }) => {
    const { createAllocation } = await canton();
    return createAllocation({
      allocator: partyNhsE(),
      recipient: partyIcb(data.icbCode),
      fiscalYear: FISCAL_YEAR,
      amountGbp: data.amountGbp,
      purpose: data.purpose,
    });
  });

export const allocateToTrust = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      icbCode: z.string().min(1).max(10),
      trustCode: z.string().min(1).max(10),
      amountGbp: z.string().min(1),
      purpose: z.string().min(1).max(200),
    }),
  )
  .handler(async ({ data }) => {
    const { createAllocation } = await canton();
    return createAllocation({
      allocator: partyIcb(data.icbCode),
      recipient: partyTrust(data.trustCode),
      fiscalYear: FISCAL_YEAR,
      amountGbp: data.amountGbp,
      purpose: data.purpose,
    });
  });

export const submitSpendCommitment = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      trustCode: z.string().min(1).max(10),
      icbCode: z.string().min(1).max(10),
      category: z.string().min(1).max(60),
      amountGbp: z.string().min(1),
      period: z.string().min(1).max(20),
      supplierName: z.string().min(1).max(120).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { createSpendCommitment } = await canton();
    return createSpendCommitment({
      trust: partyTrust(data.trustCode),
      commissioner: partyIcb(data.icbCode),
      auditor: partyAuditor(),
      category: data.category,
      amountGbp: data.amountGbp,
      period: data.period,
      supplierName: data.supplierName ?? null,
      paymentAmount: data.supplierName ? data.amountGbp : null,
    });
  });

export const countersignCommitment = createServerFn({ method: "POST" })
  .inputValidator(z.object({ contractId: z.string().min(1), icbCode: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { querySpendCommitments, countersign } = await canton();
    const all = await querySpendCommitments(partyIcb(data.icbCode));
    const c = all.find((x) => x.contractId === data.contractId);
    if (!c) throw new Error("Commitment not visible to this commissioner");
    return countersign(c);
  });

// --- USDCx settlement (DevNet) --------------------------------------------

export const getUsdcxBalance = createServerFn({ method: "GET" })
  .inputValidator(z.object({ party: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    const { usdcxBalance } = await canton();
    const amount = await usdcxBalance(data.party);
    return { party: data.party, amount };
  });

export const settleSupplierPayment = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      contractId: z.string().min(1),
      trustCode: z.string().min(1).max(10),
      supplierParty: z.string().min(1).max(200),
      holdingCid: z.string().min(1).max(200).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { querySpendCommitments, settleWithUsdcx } = await canton();
    const trust = partyTrust(data.trustCode);
    const visible = await querySpendCommitments(trust);
    const c = visible.find((x) => x.contractId === data.contractId);
    if (!c) throw new Error("Commitment not visible to this trust");
    return settleWithUsdcx(c, {
      supplierParty: data.supplierParty,
      holdingCid: data.holdingCid,
    });
  });


// --- Invoice ---------------------------------------------------------------

export const getInvoicesForParty = createServerFn({ method: "GET" })
  .inputValidator(z.object({ party: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    const { queryInvoices } = await canton();
    return queryInvoices(data.party);
  });

export const submitInvoice = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      trustCode: z.string().min(1).max(10),
      icbCode: z.string().min(1).max(10),
      invoiceRef: z.string().min(1).max(60),
      category: z.string().min(1).max(60),
      amountGbp: z.string().min(1),
      period: z.string().min(1).max(20),
      supplierName: z.string().min(1).max(120).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { createInvoice } = await canton();
    return createInvoice({
      trust: partyTrust(data.trustCode),
      commissioner: partyIcb(data.icbCode),
      auditor: partyAuditor(),
      invoiceRef: data.invoiceRef,
      category: data.category,
      amountGbp: data.amountGbp,
      period: data.period,
      supplierName: data.supplierName ?? null,
    });
  });

export const countersignInvoiceFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ contractId: z.string().min(1), icbCode: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { queryInvoices, countersignInvoice } = await canton();
    const all = await queryInvoices(partyIcb(data.icbCode));
    const inv = all.find((x) => x.contractId === data.contractId);
    if (!inv) throw new Error("Invoice not visible to this commissioner");
    return countersignInvoice(inv);
  });
