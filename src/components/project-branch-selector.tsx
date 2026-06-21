"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGithubBranches } from "@/hooks/use-github-branches";
import { useUpdateBranchMutation } from "@/hooks/use-project-mutations";

export function ProjectBranchSelector({
  projectId,
  environmentId,
  repository,
  installationId,
  currentBranch
}: {
  projectId: string;
  environmentId: string;
  repository: string;
  installationId: string | null;
  currentBranch: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(currentBranch);
  const [optimisticBranch, setOptimisticBranch] = useState<string | null>(null);

  const { data: branches = [], isLoading, error, refetch } = useGithubBranches(
    repository,
    installationId
  );

  const updateBranch = useUpdateBranchMutation({ projectId, environmentId });

  useEffect(() => {
    setSelected(currentBranch);
    setOptimisticBranch(null);
  }, [currentBranch]);

  const displayBranch = optimisticBranch ?? currentBranch;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter((b) => b.name.toLowerCase().includes(q));
  }, [branches, query]);

  function save() {
    if (!selected.trim() || selected === displayBranch) return;
    const next = selected.trim();
    setOptimisticBranch(next);
    updateBranch.mutate(next, {
      onError: () => setOptimisticBranch(null)
    });
  }

  if (!installationId) {
    return (
      <p className="text-muted-foreground text-sm">
        Link a GitHub App installation to this project to change branches from the dashboard.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1 space-y-1">
          <Label htmlFor="branch-search">Deployment branch</Label>
          <Input
            id="branch-search"
            placeholder="Search branches…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLoading}
          onClick={() => void refetch()}
        >
          {isLoading ? "Loading…" : "Refresh"}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={updateBranch.isPending || selected === displayBranch}
          onClick={save}
        >
          {updateBranch.isPending ? "Saving…" : "Save branch"}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Current: <span className="text-foreground font-mono">{displayBranch}</span>
        {optimisticBranch && optimisticBranch !== currentBranch ? (
          <span className="text-muted-foreground ml-1">(updating…)</span>
        ) : null}
      </p>
      {error ? (
        <p className="text-destructive text-sm">
          {error instanceof Error ? error.message : "Failed to load branches"}
        </p>
      ) : null}
      <ScrollArea className="h-48 rounded-md border">
        <div className="flex flex-col p-1">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground p-3 text-sm">
              {isLoading ? "Loading branches…" : "No branches match your search."}
            </p>
          ) : (
            filtered.map((b) => (
              <button
                key={b.name}
                type="button"
                className={`hover:bg-muted rounded-md px-3 py-2 text-left text-sm ${selected === b.name ? "bg-primary/10 font-medium" : ""}`}
                onClick={() => setSelected(b.name)}
              >
                <span className="font-mono">{b.name}</span>
                {b.protected ? (
                  <span className="text-muted-foreground ml-2 text-xs">protected</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
