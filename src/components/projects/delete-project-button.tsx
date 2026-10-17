"use client";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteProject } from "@/app/app/projects/actions";
import { Button } from "@/components/ui/button";

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const t = useTranslations("projects");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="danger"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm(t("deleteConfirm"))) return;
        start(async () => {
          const res = await deleteProject(projectId);
          if (!res.ok) return void toast.error(res.error);
          toast.success(t("deleted"));
          router.push("/app/projects");
        });
      }}
    >
      <Trash2 /> {t("deleteProject")}
    </Button>
  );
}
