import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

export const PROJECT_STATUSES = ["lead", "analyzing", "offer_made", "purchased", "renovating", "listed", "sold"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

const tone: Record<ProjectStatus, "neutral" | "info" | "warning" | "success" | "primary"> = {
  lead: "neutral",
  analyzing: "info",
  offer_made: "warning",
  purchased: "primary",
  renovating: "warning",
  listed: "info",
  sold: "success",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const t = useTranslations("status");
  return <Badge tone={tone[status]}>{t(status)}</Badge>;
}
