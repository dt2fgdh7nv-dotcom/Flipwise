"use client";
import { Tooltip as T } from "radix-ui";
import * as React from "react";

export function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactNode }) {
  return (
    <T.Provider delayDuration={150}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content
            sideOffset={6}
            className="z-50 max-w-xs rounded-lg bg-foreground px-3 py-2 text-xs leading-relaxed text-white shadow-lg"
          >
            {content}
            <T.Arrow className="fill-foreground" />
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}
