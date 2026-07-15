import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Inquiry } from "../types";
import { InquiryStatusBadge } from "./InquiryStatusBadge";

export function InquiryCard({ inquiry }: { inquiry: Inquiry }) {
  const [open, setOpen] = useState(false);
  // 답변완료 문의만 펼쳐서 답변 확인 (읽기 전용). 처리중은 정적 카드.
  const expandable = inquiry.status === "ANSWERED";

  const header = (
    <div className="flex items-center gap-3">
      <InquiryStatusBadge status={inquiry.status} />
      <span className="min-w-0 flex-1 truncate text-base font-medium">
        {inquiry.title}
      </span>
      <span className="shrink-0 text-sm text-muted-foreground">
        {inquiry.createdAt.replace(/-/g, ".")}
      </span>
      {expandable && (
        <ChevronRight
          className={cn(
            "size-5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90",
          )}
        />
      )}
    </div>
  );

  return (
    <article className="rounded-sm border bg-background">
      {expandable ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center px-5 py-4 text-left"
        >
          {header}
        </button>
      ) : (
        <div className="px-5 py-4">{header}</div>
      )}

      {expandable && open && (
        <div className="space-y-4 border-t px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">문의</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {inquiry.content}
            </p>
          </div>
          <div className="rounded-sm bg-muted/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">답변</p>
              {inquiry.answeredAt && (
                <span className="text-xs text-muted-foreground">
                  {inquiry.answeredAt.replace(/-/g, ".")}
                </span>
              )}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{inquiry.answer}</p>
          </div>
        </div>
      )}
    </article>
  );
}
