"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setRole } from "@/lib/actions/team";
import { USER_ROLES, roleLabel } from "@/lib/constants";
import type { ITeamMember, TUserRole } from "@/types";

interface ITeamRoleManagerProps {
  members: ITeamMember[];
  currentUserId: string;
}

export function TeamRoleManager({
  members,
  currentUserId,
}: ITeamRoleManagerProps) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {members.map((member) => (
        <TeamRow
          key={member.id}
          member={member}
          isSelf={member.id === currentUserId}
        />
      ))}
    </ul>
  );
}

interface ITeamRowProps {
  member: ITeamMember;
  isSelf: boolean;
}

function TeamRow({ member, isSelf }: ITeamRowProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function changeRole(role: TUserRole): void {
    if (role === member.role) return;
    const ok = window.confirm(
      `¿Cambiar a ${member.display_name} de ${roleLabel(
        member.role,
      )} a ${roleLabel(role)}?`,
    );
    if (!ok) return;

    setError(null);
    startTransition(async () => {
      const result = await setRole(member.id, role);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="font-medium">
          {member.display_name}
          {isSelf && (
            <span className="ml-2 text-xs text-muted">(tú)</span>
          )}
        </p>
        <p className="text-xs text-muted truncate">
          {member.email ?? "sin email"} · {roleLabel(member.role)}
        </p>
        {error && <p className="text-xs text-distrust mt-1">{error}</p>}
      </div>

      {isSelf ? (
        <span className="text-xs text-muted">Tu propia cuenta</span>
      ) : (
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Rol de {member.display_name}</span>
          <select
            value={member.role}
            disabled={isPending}
            onChange={(e) => changeRole(e.target.value as TUserRole)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            {USER_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </li>
  );
}
