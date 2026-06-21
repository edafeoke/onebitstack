"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { addOrganizationMemberByEmailAction } from "@/app/dashboard/settings/members/actions";
import type { OrgRole } from "@/lib/auth/roles";

const ADD_ROLES: OrgRole[] = ["admin", "developer", "viewer"];

export function AddWorkspaceMemberForm({ organizationSlug }: { organizationSlug: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("developer");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Enter an email address");
      return;
    }
    startTransition(async () => {
      const res = await addOrganizationMemberByEmailAction({
        organizationSlug,
        email: trimmed,
        role
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Member added");
      setEmail("");
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[200px] flex-1 space-y-1">
        <Label htmlFor={`add-member-${organizationSlug}`}>Email</Label>
        <Input
          id={`add-member-${organizationSlug}`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@example.com"
          disabled={pending}
        />
      </div>
      <div className="space-y-1">
        <Label>Role</Label>
        <Select
          value={role}
          onValueChange={(v) => v && setRole(v as OrgRole)}
          disabled={pending}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ADD_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        Add member
      </Button>
    </form>
  );
}
