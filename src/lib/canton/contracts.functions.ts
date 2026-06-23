// Server functions for the generic Create Contract UI.
// Stays in *.functions.ts so route files can import safely; the
// server-only canton/* modules are loaded lazily inside handlers.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { TEMPLATES, type TemplateId } from "./templates";
import type { Json } from "@/integrations/supabase/types";
import type { BudgetAllocation, Invoice, ReconciledSpend, SpendCommitment } from "./types";


const templateIdSchema = z.enum([
  "Nhs:BudgetAllocation",
  "Nhs:SpendCommitment",
  "Nhs:ReconciledSpend",
  "Nhs:Invoice",
]) satisfies z.ZodType<TemplateId>;

const createSchema = z.object({
  templateId: templateIdSchema,
  actAs: z.array(z.string().min(1)).min(1).max(8),
  payload: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
});

export const listKnownParties = createServerFn({ method: "GET" }).handler(async () => {
  const { listParties } = await import("@/lib/canton/parties.server");
  try {
    return await listParties();
  } catch {
    return [];
  }
});

export const listContractEvents = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("contract_events")
    .select("id, template_id, contract_id, act_as, payload, status, error, network, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listActiveContracts = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      templateId: templateIdSchema,
      party: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const { ledgerMode } = await import("@/lib/canton/client.server");
    const mode = ledgerMode();
    type Row = {
      contractId: string;
      templateId: string;
      payload: Json;
      signatories: string[];
      observers: string[];
      createdAt: string;
    };
    const toRows = (
      list: ReadonlyArray<{
        contractId: string;
        templateId: string;
        payload: unknown;
        signatories: string[];
        observers: string[];
        createdAt: string;
      }>,
    ): Row[] =>
      list.map((c) => ({
        contractId: c.contractId,
        templateId: c.templateId,
        payload: (c.payload as Json) ?? ({} as Json),
        signatories: c.signatories,
        observers: c.observers,
        createdAt: c.createdAt,
      }));
    if (mode.mode !== "live") {
      const { memQuery } = await import("@/lib/canton/memory.server");
      return toRows(memQuery(data.templateId, data.party));
    }
    const { liveQuery } = await import("@/lib/canton/live.server");
    try {
      return toRows(await liveQuery(data.templateId, data.party));
    } catch (e) {
      console.warn("[contracts] listActiveContracts failed", e);
      return [] as Row[];
    }

  });


export const createContract = createServerFn({ method: "POST" })
  .inputValidator(createSchema)
  .handler(async ({ data }) => {
    const tpl = TEMPLATES[data.templateId];
    if (!tpl) throw new Error(`Unknown template ${data.templateId}`);

    // Normalize payload values to the strings Daml expects (Decimal is a string).
    // For Optional Daml fields, OMIT empty keys entirely — Canton v2 decodes
    // a bare `null` for `Optional Party` as Party "" and rejects with
    // "Daml-LF Party is empty".
    const normalized: Record<string, unknown> = {};
    for (const f of tpl.fields) {
      const raw = data.payload[f.name];
      const isEmpty = raw === undefined || raw === null || raw === "";
      if (isEmpty) {
        if (f.required) throw new Error(`Missing required field: ${f.name}`);
        continue; // omit optional empties
      }
      normalized[f.name] = String(raw);
    }

    const { ledgerMode } = await import("@/lib/canton/client.server");
    const mode = ledgerMode();

    // Resolve actAs and party fields via canton_parties map (logical → full).
    const { resolveParty, resolvePayloadParties } = await import("@/lib/canton/parties.server");

    let resolvedActAs: string[] = data.actAs;
    let resolvedPayload: Record<string, unknown> = normalized;
    try {
      resolvedActAs = await Promise.all(data.actAs.map((p) => resolveParty(p)));
      resolvedPayload = await resolvePayloadParties(normalized);
    } catch {
      // Memory mode often has no canton_parties rows; pass through.
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const baseEvent = {
      template_id: data.templateId,
      act_as: resolvedActAs,
      payload: resolvedPayload as unknown as Json,
      network: mode.network ?? mode.mode,
    };

    // Record "submitted" event first so the log shows the attempt even if create throws.
    await supabaseAdmin
      .from("contract_events")
      .insert({ ...baseEvent, status: "submitted" });

    try {
      let contractId: string;
      if (mode.mode === "live") {
        const { liveCreate } = await import("@/lib/canton/live.server");
        const c = await liveCreate(
          data.templateId,
          resolvedPayload,
          resolvedActAs[0] ?? data.actAs[0],
        );
        contractId = c.contractId;
      } else {
        const { memCreate } = await import("@/lib/canton/memory.server");
        const sig = [resolvedActAs[0] ?? data.actAs[0]];
        const obs: string[] = [];
        for (const f of tpl.fields) {
          if (f.kind === "party") {
            const v = resolvedPayload[f.name];
            if (typeof v === "string" && v && !sig.includes(v) && !obs.includes(v)) obs.push(v);
          }
        }
        const c = memCreate(
          data.templateId,
          resolvedPayload as unknown as BudgetAllocation | SpendCommitment | ReconciledSpend,
          sig,
          obs,
        );
        contractId = c.contractId;
      }

      await supabaseAdmin
        .from("contract_events")
        .insert({ ...baseEvent, status: "created", contract_id: contractId });

      return { ok: true as const, contractId, network: mode.network ?? mode.mode };
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const hint =
        /Daml-LF|invalid arguments|Party is empty/i.test(raw)
          ? ` (sent keys: ${Object.keys(resolvedPayload).join(", ")}; actAs: ${resolvedActAs.join(", ")})`
          : "";
      const message = raw + hint;
      await supabaseAdmin
        .from("contract_events")
        .insert({ ...baseEvent, status: "failed", error: message });
      throw new Error(message);
    }
  });

