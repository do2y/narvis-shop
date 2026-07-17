import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
        className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90 disabled:pointer-events-none disabled:opacity-30"
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
            "flex size-11 items-center justify-center rounded-full text-sm transition-all active:scale-90",
            p === page
              ? "bg-primary font-bold text-primary-foreground"
              : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
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
        className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90 disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}
