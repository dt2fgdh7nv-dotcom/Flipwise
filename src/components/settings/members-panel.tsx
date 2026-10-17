"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelInvite, changeMemberRole, inviteMember, removeMember } from "@/app/app/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { formatDate } from "@/lib/format";

type Role = "owner" | "admin" | "member";

export function MembersPanel({
  members,
  invites,
  currentUserId,
  canManage,
  isOwner,
}: {
  members: { id: string; userId: string; name: string; email: string; role: Role }[];
  invites: { id: string; email: string; role: string | null; expiresAt: Date }[];
  currentUserId: string;
  canManage: boolean;
  isOwner: boolean;
}) {
  const t = useTranslations("settings");
  const tr = useTranslations("roles");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ email: "", role: "member" });
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      if (success) toast.success(success);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-6">
      <ul className="divide-y divide-border">
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {m.name} {m.userId === currentUserId ? <span className="text-muted">({t("you")})</span> : null}
              </p>
              <p className="truncate text-xs text-muted">{m.email}</p>
            </div>
            <div className="flex items-center gap-2">
              {canManage && m.userId !== currentUserId ? (
                <>
                  <Select className="h-9 w-32" value={m.role} disabled={pending || (m.role === "owner" && !isOwner)} onChange={(e) => run(() => changeMemberRole(m.id, e.target.value))}>
                    {(isOwner ? ["owner", "admin", "member"] : ["admin", "member"]).map((r) => (
                      <option key={r} value={r}>
                        {tr(r as Role)}
                      </option>
                    ))}
                    {!isOwner && m.role === "owner" ? <option value="owner">{tr("owner")}</option> : null}
                  </Select>
                  {m.role !== "owner" ? (
                    <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => removeMember(m.id))}>
                      {t("removeMember")}
                    </Button>
                  ) : null}
                </>
              ) : (
                <Badge>{tr(m.role)}</Badge>
              )}
            </div>
          </li>
        ))}
      </ul>

      {canManage ? (
        <form
          className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const res = await inviteMember(form);
              if (res.ok) setForm({ ...form, email: "" });
              return res;
            }, t("inviteSent"));
          }}
        >
          <Field label={t("inviteEmail")} htmlFor="inv-email">
            <Input id="inv-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label={t("inviteRole")} htmlFor="inv-role">
            <Select id="inv-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="member">{tr("member")}</option>
              <option value="admin">{tr("admin")}</option>
            </Select>
          </Field>
          <Button type="submit" disabled={pending}>
            {t("inviteMember")}
          </Button>
        </form>
      ) : null}

      {invites.length ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{t("pendingInvites")}</p>
          <ul className="divide-y divide-border">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>
                  {i.email} <span className="text-muted">· {tr((i.role ?? "member") as Role)} · {formatDate(i.expiresAt)}</span>
                </span>
                {canManage ? (
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => cancelInvite(i.id))}>
                    {t("cancelInvite")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-xs text-muted">{t("roleHelp")}</p>
    </div>
  );
}
