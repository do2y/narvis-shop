"use client";

import type { ReactNode } from "react";

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
}

export function SectionHeading({ eyebrow, title, aside }: SectionHeadingProps) {
  return (
    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">{title}</h2>
      </div>

      {aside && (
        <div className="max-w-[18rem] text-sm leading-6 text-muted-foreground sm:max-w-none sm:shrink-0 sm:text-right">
          {aside}
        </div>
      )}
    </div>
  );
}
