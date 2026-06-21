"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { updateOrganizationMemberRoleAction } from "@/app/dashboard/settings/members/actions";
import { ORG_ROLES, type OrgRole } from "@/lib/auth/roles";

export function WorkspaceMemberRoleSelect({
  organizationSlug,
  userId,
  currentRole,
  disabled
}: {
  organizationSlug: string;
  userId: string;
  currentRole: OrgRole;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function onChange(value: string | null) {
    if (!value || value === currentRole) return;
    startTransition(async () => {
      const res = await updateOrganizationMemberRoleAction({
        organizationSlug,
        userId,
        role: value as OrgRole
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Role updated");
    });
  }

  return (
    <Select
      value={currentRole}
      onValueChange={onChange}
      disabled={disabled || pending}
    >
      <SelectTrigger className="w-[130px]" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ORG_ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {r}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
