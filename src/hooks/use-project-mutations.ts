"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { EnvVarClientRow } from "@/lib/project-env";
import {
  replaceProjectEnvVarsAction,
  updateEnvironmentBranchAction
} from "@/app/dashboard/projects/project-infra-actions";

export function useReplaceEnvVarsMutation(projectId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (envVars: EnvVarClientRow[]) => {
      const res = await replaceProjectEnvVarsAction({ projectId, envVars });
      if (!res.ok) throw new Error(res.message);
      return envVars;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["project-env", projectId] });
    },
    onSuccess: () => {
      toast.success("Environment variables saved.");
      void queryClient.invalidateQueries({ queryKey: ["project-env", projectId] });
      router.refresh();
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  });
}

export function useUpdateBranchMutation(input: {
  projectId: string;
  environmentId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (branch: string) => {
      const res = await updateEnvironmentBranchAction({
        projectId: input.projectId,
        environmentId: input.environmentId,
        branch: branch.trim()
      });
      if (!res.ok) throw new Error(res.message);
      return branch.trim();
    },
    onSuccess: (branch) => {
      toast.success(`Deployment branch set to ${branch}`);
      void queryClient.invalidateQueries({
        queryKey: ["github-branches"]
      });
      router.refresh();
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Could not update branch");
    }
  });
}
