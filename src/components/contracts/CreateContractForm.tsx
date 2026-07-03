import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  createContract,
  listKnownParties,
} from "@/lib/canton/contracts.functions";
import { TEMPLATES, hashText, type TemplateId, type FieldKind } from "@/lib/canton/templates";

const KIND_BADGE: Record<FieldKind, { label: string; cls: string }> = {
  party: { label: "Party", cls: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
  text: { label: "Text", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  numeric: { label: "Numeric", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  hash: { label: "Commitment", cls: "bg-violet-500/15 text-violet-700 border-violet-500/30" },
};

function shortParty(id: string) {
  const [name, fp] = id.split("::");
  if (!fp) return id;
  return `${name}::${fp.slice(0, 6)}…${fp.slice(-4)}`;
}

interface Props {
  templateId: TemplateId;
}

export function CreateContractForm({ templateId }: Props) {
  const tpl = TEMPLATES[templateId];
  const qc = useQueryClient();

  const listParties = useServerFn(listKnownParties);
  const create = useServerFn(createContract);

  const partiesQ = useQuery({
    queryKey: ["known-parties"],
    queryFn: () => listParties(),
  });

  const knownParties = partiesQ.data ?? [];
  const partyOptions = useMemo(
    () => knownParties.map((p) => ({ value: p.party_id, label: p.logical_name })),
    [knownParties],
  );

  // actAs chips
  const [actAs, setActAs] = useState<string[]>(() => {
    const def = tpl.defaultActAs;
    if (!def) return [];
    return [def];
  });

  // field values keyed by field name
  const [values, setValues] = useState<Record<string, string>>({});

  const setField = (name: string, v: string) =>
    setValues((prev) => ({ ...prev, [name]: v }));

  const addParty = (p: string) => {
    if (!p || actAs.includes(p)) return;
    setActAs((prev) => [...prev, p]);
  };
  const removeParty = (p: string) =>
    setActAs((prev) => prev.filter((x) => x !== p));

  const mutation = useMutation({
    mutationFn: (input: {
      templateId: TemplateId;
      actAs: string[];
      payload: Record<string, string | null>;
    }) => create({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["contract-events"] });
      void qc.invalidateQueries({ queryKey: ["active-contracts", templateId] });
      // reset non-party fields, keep actAs
      const cleared: Record<string, string> = {};
      setValues(cleared);
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (actAs.length === 0) {
      mutation.reset();
      alert("Add at least one actAs party");
      return;
    }
    const payload: Record<string, string | null> = {};
    for (const f of tpl.fields) {
      let v: string;
      if (f.kind === "hash" && f.derivedFrom) {
        const source = values[f.derivedFrom]?.trim() ?? "";
        v = source === "" ? "" : hashText(source);
      } else {
        v = values[f.name]?.trim() ?? "";
      }
      payload[f.name] = v === "" ? null : v;
    }
    mutation.mutate({ templateId, actAs, payload });
  };

  const partySelectOptions = (current: string) => {
    // logical names + literal party IDs
    return partyOptions;
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Template
        </div>
        <div className="font-display text-lg font-bold tracking-tight text-foreground">
          {tpl.label}
        </div>
        <div className="text-xs text-muted-foreground">
          {tpl.module}:{tpl.label}
        </div>
      </div>

      {/* actAs chips */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">
            actAs <span className="text-muted-foreground">(Parties)</span>
          </Label>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-lg border border-border bg-white p-2 sm:flex sm:flex-wrap sm:items-center">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {actAs.length === 0 && (
              <span className="px-1 text-xs text-muted-foreground">No parties — add one</span>
            )}
            {actAs.map((p) => {
              const known = knownParties.find((kp) => kp.party_id === p || kp.logical_name === p);
              return (
                <span
                  key={p}
                  className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                >
                  <span className="truncate max-w-[10rem]">
                    {known ? known.logical_name : shortParty(p)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeParty(p)}
                    className="ml-0.5 grid h-4 w-4 shrink-0 place-items-center rounded bg-rose-500/15 text-rose-600 hover:bg-rose-500/25"
                    aria-label={`Remove ${p}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
          <Select onValueChange={addParty} value="">
            <SelectTrigger className="h-8 w-auto shrink-0 gap-1 border-dashed text-xs sm:ml-auto">
              <Plus className="h-3 w-3" />
              <span>Add Party</span>
            </SelectTrigger>
            <SelectContent>
              {partyOptions.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No allocated parties. Run /deploy first.
                </div>
              )}
              {partyOptions
                .filter((o) => !actAs.includes(o.value))
                .map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}{" "}
                    <span className="text-muted-foreground">({shortParty(o.value)})</span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* dynamic fields */}
      <div className="space-y-4">
        {tpl.fields.map((f) => {
          const badge = KIND_BADGE[f.kind];
          return (
            <div key={f.name} className="space-y-1.5">
              <Label className="flex items-center gap-2 text-sm">
                <span className="min-w-0 truncate font-semibold">{f.name}</span>
                {!f.required && (
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                    optional
                  </span>
                )}
                <Badge variant="outline" className={`ml-auto shrink-0 ${badge.cls}`}>
                  {badge.label}
                </Badge>
              </Label>

              {f.kind === "party" ? (
                <Select
                  value={values[f.name] ?? ""}
                  onValueChange={(v) => setField(f.name, v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a party" />
                  </SelectTrigger>
                  <SelectContent>
                    {partySelectOptions(values[f.name] ?? "").length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        No allocated parties.
                      </div>
                    )}
                    {partySelectOptions(values[f.name] ?? "").map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}{" "}
                        <span className="text-muted-foreground">({shortParty(o.value)})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : f.kind === "hash" ? (
                <div className="break-all rounded-md border border-dashed border-violet-500/40 bg-violet-500/5 px-3 py-2 font-mono text-[10px] text-violet-800 md:text-xs">
                  {(() => {
                    const source = f.derivedFrom ? values[f.derivedFrom]?.trim() : "";
                    if (!source) {
                      return (
                        <span className="text-muted-foreground">
                          Auto-derived from{" "}
                          <code className="font-semibold">{f.derivedFrom}</code>
                        </span>
                      );
                    }
                    return `hash(${f.derivedFrom}) = ${hashText(source)}`;
                  })()}
                </div>
              ) : (
                <Input
                  type={f.kind === "numeric" ? "number" : "text"}
                  step={f.kind === "numeric" ? "0.01" : undefined}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setField(f.name, e.target.value)}
                  placeholder={f.placeholder}
                />
              )}
              {f.help && (
                <p className="text-[11px] text-muted-foreground">{f.help}</p>
              )}
            </div>
          );
        })}
      </div>

      <Button type="submit" disabled={mutation.isPending} className="w-full">
        {mutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…
          </>
        ) : (
          "Create Contract"
        )}
      </Button>

      {mutation.isError && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700">
          {(mutation.error as Error).message}
        </div>
      )}
      {mutation.isSuccess && mutation.data && (
        <div className="space-y-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700">
          <div>
            Created on <span className="font-semibold">{mutation.data.network}</span>
          </div>
          <div className="break-all font-mono text-[11px]">{mutation.data.contractId}</div>
        </div>
      )}
    </form>
  );
}
