"use client";
import { useTranslations } from "next-intl";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type GlossaryKey =
  | "taloyhtio" | "asuntoOsake" | "kiinteisto" | "hoitovastike" | "rahoitusvastike" | "velkaosuus"
  | "velatonHinta" | "myyntihinta" | "varainsiirtovero" | "isannoitsija" | "isannoitsijantodistus"
  | "pts" | "muutostyoilmoitus" | "putkiremontti" | "asbestikartoitus" | "hankintamenoOlettama"
  | "kerrostalo" | "rivitalo";

/** Finnish term with a tap-to-explain popover. */
export function Term({ k, children, className }: { k: GlossaryKey; children?: React.ReactNode; className?: string }) {
  const t = useTranslations("glossary");
  return (
    <Popover
      trigger={
        <button type="button" className={cn("cursor-help border-b border-dotted border-muted/60 text-left", !children && "italic", className)}>
          {children ?? t(`${k}.term`)}
        </button>
      }
    >
      <p className="font-medium italic">{t(`${k}.term`)}</p>
      <p className="mt-1 text-muted">{t(`${k}.explanation`)}</p>
    </Popover>
  );
}
