"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { hoverMuted, numeric, pressable } from "../interaction";

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav aria-label="페이지" className="flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label="이전 페이지"
        className={cn(
          "flex size-11 items-center justify-center rounded-full text-muted-foreground",
          pressable,
          hoverMuted,
          "hover:[@media(hover:hover)]:text-foreground",
          "disabled:pointer-events-none disabled:opacity-30",
        )}
      >
        <ChevronLeft className="size-4" />
      </button>

      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          aria-current={p === page ? "page" : undefined}
          className={cn(
            "flex size-11 items-center justify-center rounded-full text-sm",
            numeric,
            pressable,
            p === page
              ? "bg-primary font-bold text-primary-foreground"
              : cn(
                  "font-medium text-muted-foreground",
                  hoverMuted,
                  "hover:[@media(hover:hover)]:text-foreground",
                ),
          )}
        >
          {p}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        aria-label="다음 페이지"
        className={cn(
          "flex size-11 items-center justify-center rounded-full text-muted-foreground",
          pressable,
          hoverMuted,
          "hover:[@media(hover:hover)]:text-foreground",
          "disabled:pointer-events-none disabled:opacity-30",
        )}
      >
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}
