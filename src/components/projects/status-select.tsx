"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { updateStatus } from "@/app/app/projects/actions";
import { PROJECT_STATUSES, type ProjectStatus } from "@/components/shared/status-badge";
import { Select } from "@/components/ui/input";

export function StatusSelect({ projectId, status }: { projectId: string; status: ProjectStatus }) {
  const t = useTranslations("status");
  const tp = useTranslations("projects");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">{tp("changeStatus")}</span>
      <Select
        className="w-44"
        value={status}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            const res = await updateStatus(projectId, e.target.value);
            if (res.ok) {
              toast.success(tp("statusUpdated"));
              router.refresh();
            } else toast.error(res.error);
          })
        }
      >
        {PROJECT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(s)}
          </option>
        ))}
      </Select>
    </label>
  );
}
