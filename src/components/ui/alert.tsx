import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const tones = {
  info: { cls: "bg-info-soft text-info border-info/20", Icon: Info },
  warning: { cls: "bg-warning-soft text-warning border-warning/20", Icon: AlertTriangle },
  danger: { cls: "bg-danger-soft text-danger border-danger/20", Icon: OctagonAlert },
  success: { cls: "bg-success-soft text-success border-success/20", Icon: CheckCircle2 },
};

export function Alert({ tone = "info", title, children, className }: { tone?: keyof typeof tones; title?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  const { cls, Icon } = tones[tone];
  return (
    <div className={cn("flex gap-3 rounded-xl border p-3.5 text-sm", cls, className)} role={tone === "danger" ? "alert" : "status"}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="text-foreground/80">{children}</div> : null}
      </div>
    </div>
  );
}
