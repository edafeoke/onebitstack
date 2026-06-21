"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { EnvScope } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatEnvFileFromRows, type EnvVarClientRow } from "@/lib/project-env";
import { useReplaceEnvVarsMutation } from "@/hooks/use-project-mutations";

const SCOPES: EnvScope[] = ["production", "preview", "development"];

function emptyRow(scope: EnvScope): EnvVarClientRow {
  return { key: "", value: "", scope, isSecret: false, hasSecret: false };
}

export function EnvVarsTable({
  projectId,
  initialRows
}: {
  projectId: string;
  initialRows: EnvVarClientRow[];
}) {
  const [rows, setRows] = useState<EnvVarClientRow[]>(initialRows);
  const [scopeFilter, setScopeFilter] = useState<EnvScope | "all">("all");
  const [search, setSearch] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const saveMutation = useReplaceEnvVarsMutation(projectId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (scopeFilter !== "all" && r.scope !== scopeFilter) return false;
      if (!q) return true;
      return r.key.toLowerCase().includes(q);
    });
  }, [rows, scopeFilter, search]);

  function rowKey(r: EnvVarClientRow, index: number) {
    return `${r.scope}:${r.key}:${index}`;
  }

  function updateRow(index: number, patch: Partial<EnvVarClientRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function parseEnvText(text: string, defaultScope: EnvScope): EnvVarClientRow[] {
    const parsed: EnvVarClientRow[] = [];
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx < 1) continue;
      const key = line.slice(0, eqIdx).trim();
      if (!key) continue;
      let val = line.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      parsed.push({ key, value: val, scope: defaultScope, isSecret: false, hasSecret: false });
    }
    return parsed;
  }

  function save() {
    const cleaned = rows
      .map((r) => ({
        ...r,
        key: r.key.trim(),
        value: r.value
      }))
      .filter((r) => r.key.length > 0);
    const keys = cleaned.map((r) => `${r.scope}:${r.key}`);
    if (new Set(keys).size !== keys.length) {
      toast.error("Duplicate keys in the same scope are not allowed.");
      return;
    }
    const snapshot = rows;
    saveMutation.mutate(cleaned, {
      onError: () => setRows(snapshot)
    });
  }

  function exportEnv() {
    const blob = new Blob([formatEnvFileFromRows(rows.filter((r) => r.key.trim()))], {
      type: "text/plain"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "env.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyValue(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  }

  const pasteScope: EnvScope = scopeFilter === "all" ? "production" : scopeFilter;

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Variables are injected at deploy time for the matching environment scope. Secrets are
        encrypted at rest.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={scopeFilter}
          onValueChange={(v) => setScopeFilter(v as EnvScope | "all")}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            {SCOPES.map((s) => (
              <TabsTrigger key={s} value={s} className="capitalize">
                {s}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Input
          placeholder="Search keys…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Scope</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="w-[100px]">Secret</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-6 text-center text-sm">
                  No variables in this scope.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const index = rows.indexOf(r);
                const id = rowKey(r, index);
                const masked = r.isSecret && !revealed[id];
                return (
                  <TableRow key={id}>
                    <TableCell>
                      <select
                        className="border-input bg-background h-8 w-full rounded-md border px-2 text-xs capitalize"
                        value={r.scope}
                        onChange={(e) =>
                          updateRow(index, { scope: e.target.value as EnvScope })
                        }
                      >
                        {SCOPES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={r.key}
                        onChange={(e) => updateRow(index, { key: e.target.value })}
                        className="font-mono text-xs"
                        placeholder="KEY"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type={masked ? "password" : "text"}
                        value={masked && r.hasSecret ? "••••••••" : r.value}
                        placeholder={r.hasSecret && masked ? "unchanged if empty" : "value"}
                        onChange={(e) =>
                          updateRow(index, {
                            value: e.target.value,
                            hasSecret: r.isSecret ? true : r.hasSecret
                          })
                        }
                        className="font-mono text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={r.isSecret}
                          onChange={(e) =>
                            updateRow(index, { isSecret: e.target.checked })
                          }
                        />
                        Mask
                      </label>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {r.isSecret ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setRevealed((prev) => ({ ...prev, [id]: !prev[id] }))
                            }
                          >
                            {revealed[id] ? "Hide" : "Show"}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!r.value}
                          onClick={() => void copyValue(r.value)}
                        >
                          Copy
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                        >
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setRows((prev) => [...prev, emptyRow(pasteScope)])
          }
        >
          Add variable
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowPaste((v) => !v)}>
          {showPaste ? "Hide import" : "Import .env"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={exportEnv}>
          Export .env
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={saveMutation.isPending}
          onClick={save}
        >
          {saveMutation.isPending ? "Saving…" : "Save variables"}
        </Button>
      </div>
      {showPaste ? (
        <div className="space-y-2 rounded-md border p-3">
          <Label className="text-xs">Paste .env (applies to {pasteScope} scope)</Label>
          <textarea
            className="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-sm"
            rows={6}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const parsed = parseEnvText(pasteText, pasteScope);
              if (parsed.length === 0) return;
              setRows((prev) => {
                const merged = [...prev];
                for (const row of parsed) {
                  const idx = merged.findIndex(
                    (m) => m.key === row.key && m.scope === row.scope
                  );
                  if (idx >= 0) merged[idx] = row;
                  else merged.push(row);
                }
                return merged;
              });
              setPasteText("");
              setShowPaste(false);
              toast.success(`Imported ${parsed.length} variables`);
            }}
          >
            Apply import
          </Button>
        </div>
      ) : null}
    </div>
  );
}
