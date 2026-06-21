"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeOrganizationMemberAction } from "@/app/dashboard/settings/members/actions";

export function RemoveWorkspaceMemberButton({
  organizationSlug,
  userId,
  label
}: {
  organizationSlug: string;
  userId: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm("Remove this member from the workspace?")) return;
    startTransition(async () => {
      const res = await removeOrganizationMemberAction({ organizationSlug, userId });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Member removed");
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-destructive hover:text-destructive"
      disabled={pending}
      onClick={remove}
    >
      {label ?? "Remove"}
    </Button>
  );
}
