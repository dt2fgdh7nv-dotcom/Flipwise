import { ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Every data point shown to users carries its source and date. */
export function SourceTag({ source, date, url, className }: { source: string; date?: string | Date | null; url?: string | null; className?: string }) {
  const label = (
    <>
      {source}
      {date ? ` · ${formatDate(date)}` : ""}
    </>
  );
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] text-muted", className)}>
      <span className="font-medium uppercase tracking-wide">Source</span>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline-offset-2 hover:underline">
          {label}
          <ExternalLink className="size-3" />
        </a>
      ) : (
        <span>{label}</span>
      )}
    </span>
  );
}
