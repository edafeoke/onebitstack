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
import { updateUserRoleAction } from "@/app/dashboard/admin/actions";
import type { UserRole } from "@/lib/auth/roles";

export function AdminUserRoleSelect({
  userId,
  currentRole,
  disabled
}: {
  userId: string;
  currentRole: UserRole;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function onChange(value: string | null) {
    if (!value || value === currentRole) return;
    startTransition(async () => {
      const res = await updateUserRoleAction({ userId, role: value as UserRole });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("User role updated");
    });
  }

  return (
    <Select
      value={currentRole}
      onValueChange={onChange}
      disabled={disabled || pending}
    >
      <SelectTrigger className="w-[120px]" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="user">user</SelectItem>
        <SelectItem value="admin">admin</SelectItem>
      </SelectContent>
    </Select>
  );
}
