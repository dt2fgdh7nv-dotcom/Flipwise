"use client";
import { Popover as P } from "radix-ui";
import * as React from "react";

/** Tap-friendly alternative to tooltips (works on touch devices). */
export function Popover({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) {
  return (
    <P.Root>
      <P.Trigger asChild>{trigger}</P.Trigger>
      <P.Portal>
        <P.Content
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-w-xs rounded-lg border border-border bg-surface p-3 text-sm leading-relaxed shadow-lg"
        >
          {children}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
