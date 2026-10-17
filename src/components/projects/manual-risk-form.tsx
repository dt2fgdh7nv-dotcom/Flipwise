"use client";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addManualRisk, deleteManualRisk } from "@/app/app/projects/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";

export function ManualRiskForm({ projectId }: { projectId: string }) {
  const t = useTranslations("overview");
  const ts = useTranslations("severity");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", detail: "", severity: "medium" });
  const [pending, start] = useTransition();
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={t("addRisk")}
      trigger={
        <Button variant="ghost" size="sm">
          <Plus /> {t("addRisk")}
        </Button>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await addManualRisk(projectId, form);
            if (!res.ok) return void toast.error(res.error);
            toast.success(t("riskAdded"));
            setForm({ title: "", detail: "", severity: "medium" });
            setOpen(false);
            router.refresh();
          });
        }}
      >
        <Field label={t("riskTitle")} htmlFor="riskTitle">
          <Input id="riskTitle" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label={t("riskDetail")} htmlFor="riskDetail">
          <Textarea id="riskDetail" value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} />
        </Field>
        <Field label={t("riskSeverity")} htmlFor="riskSeverity">
          <Select id="riskSeverity" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
            {(["high", "medium", "info"] as const).map((s) => (
              <option key={s} value={s}>
                {ts(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" disabled={pending}>
          {tc("add")}
        </Button>
      </form>
    </Dialog>
  );
}

export function DeleteManualRiskButton({ projectId, riskId }: { projectId: string; riskId: string }) {
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={tc("remove")}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await deleteManualRisk(projectId, riskId);
          if (!res.ok) toast.error(res.error);
          router.refresh();
        })
      }
    >
      <Trash2 />
    </Button>
  );
}
