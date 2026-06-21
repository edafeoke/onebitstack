"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  currentProvider?: string;
};

export function DatabaseSetupPanel({ currentProvider }: Props) {
  const [provider, setProvider] = useState<"postgresql" | "sqlite">(
    currentProvider === "sqlite" ? "sqlite" : "postgresql"
  );
  const [delivery, setDelivery] = useState<"docker" | "external" | "skip">("docker");
  const [postgresUrl, setPostgresUrl] = useState("");
  const [sqlitePath, setSqlitePath] = useState("./data/central.db");
  const [envBlock, setEnvBlock] = useState("");
  const [instructions, setInstructions] = useState("");
  const [warning, setWarning] = useState("");
  const [pending, setPending] = useState(false);

  const generateSnippet = async () => {
    setPending(true);
    try {
      const res = await fetch("/api/setup/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          delivery: provider === "postgresql" ? delivery : undefined,
          databaseUrl: provider === "postgresql" ? postgresUrl || undefined : undefined,
          sqlitePath: provider === "sqlite" ? sqlitePath : undefined
        })
      });
      const data = (await res.json()) as {
        envBlock?: string;
        instructions?: string;
        trialWarning?: string;
        error?: string;
      };
      if (!res.ok) {
        setInstructions(data.error ?? "Failed to generate snippet");
        return;
      }
      setEnvBlock(data.envBlock ?? "");
      setInstructions(data.instructions ?? "");
      setWarning(data.trialWarning ?? "");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        Choose a database engine. Paste the generated block into your server{" "}
        <code className="text-foreground">.env</code> and restart — the wizard does not write
        files automatically.
      </p>

      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="db-provider"
            checked={provider === "postgresql"}
            onChange={() => setProvider("postgresql")}
          />
          PostgreSQL (production)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="db-provider"
            checked={provider === "sqlite"}
            onChange={() => setProvider("sqlite")}
          />
          SQLite (local trial)
        </label>
        <span className="text-muted-foreground text-xs">MySQL — coming soon</span>
      </div>

      {provider === "postgresql" ? (
        <div className="space-y-2">
          <Label>PostgreSQL delivery</Label>
          <select
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            value={delivery}
            onChange={(e) => setDelivery(e.target.value as typeof delivery)}
          >
            <option value="docker">Docker bundled (docker-compose.install.yml)</option>
            <option value="external">External DATABASE_URL</option>
            <option value="skip">Use existing .env</option>
          </select>
          {delivery === "external" ? (
            <Input
              placeholder="postgresql://user:pass@host:5432/db?schema=central"
              value={postgresUrl}
              onChange={(e) => setPostgresUrl(e.target.value)}
            />
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="sqlite-path">SQLite file path</Label>
          <Input
            id="sqlite-path"
            value={sqlitePath}
            onChange={(e) => setSqlitePath(e.target.value)}
          />
          <p className="text-amber-300 text-xs">
            Trial only — not for production multi-tenant workloads.
          </p>
        </div>
      )}

      <Button type="button" disabled={pending} onClick={generateSnippet}>
        Generate .env snippet
      </Button>

      {warning ? <p className="text-amber-300 text-xs">{warning}</p> : null}
      {instructions ? <p className="text-muted-foreground text-xs">{instructions}</p> : null}
      {envBlock ? (
        <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">{envBlock}</pre>
      ) : null}
    </div>
  );
}
