"use client";
import { Copy, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { createShare, revokeShare } from "@/server/actions/sharing";

export interface ShareView {
  id: string;
  email: string;
  role: "viewer" | "commenter";
  status: "pending" | "active" | "revoked";
  expiresAt: Date;
  acceptedAt: Date | null;
}

export function ShareInviteForm({ projectId }: { projectId: string }) {
  const t = useTranslations("sharing");
  const tr = useTranslations("roles");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ email: "", role: "viewer", expiresInDays: "90" });
  const [link, setLink] = useState<{ link: string; email: string } | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <form
        className="grid gap-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await createShare(projectId, { email: form.email, role: form.role, expiresInDays: Number(form.expiresInDays) });
            if (!res.ok) return void toast.error(res.fieldErrors?.email?.[0] ?? res.error);
            toast.success(t("invited", { email: form.email }));
            setLink({ link: res.data!.link, email: form.email });
            setForm({ ...form, email: "" });
            router.refresh();
          });
        }}
      >
        <Field label={t("email")} htmlFor="share-email">
          <Input id="share-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label={t("role")} htmlFor="share-role">
          <Select id="share-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="viewer">{tr("viewer")}</option>
            <option value="commenter">{tr("commenter")}</option>
          </Select>
        </Field>
        <Field label={t("expires")} htmlFor="share-exp">
          <Select id="share-exp" value={form.expiresInDays} onChange={(e) => setForm({ ...form, expiresInDays: e.target.value })}>
            {[30, 90, 180, 365].map((d) => (
              <option key={d} value={d}>
                {t("days", { count: d })}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" disabled={pending}>
          <Send /> {t("invite")}
        </Button>
      </form>
      {link ? (
        <Alert tone="success" title={t("inviteLink")}>
          <p>{t("inviteLinkHint", { email: link.email })}</p>
          <div className="mt-2 flex gap-2">
            <Input readOnly value={link.link} className="text-xs" onFocus={(e) => e.target.select()} />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-10"
              onClick={async () => {
                await navigator.clipboard.writeText(link.link);
                toast.success(t("copied"));
              }}
            >
              <Copy /> {t("copy")}
            </Button>
          </div>
        </Alert>
      ) : null}
    </div>
  );
}

export function ShareList({ projectId, shares }: { projectId: string; shares: ShareView[] }) {
  const t = useTranslations("sharing");
  const tr = useTranslations("roles");
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!shares.length) return <p className="text-sm text-muted">{t("none")}</p>;
  return (
    <ul className="divide-y divide-border">
      {shares.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{s.email}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
              <Badge tone={s.status === "active" ? "success" : s.status === "pending" ? "warning" : "neutral"}>{t(`status.${s.status}`)}</Badge>
              {tr(s.role)} · {t("expiresOn", { date: formatDate(s.expiresAt) })}
            </p>
          </div>
          {s.status !== "revoked" ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await revokeShare(projectId, s.id);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success(t("revoked"));
                  router.refresh();
                })
              }
            >
              {t("revoke")}
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
