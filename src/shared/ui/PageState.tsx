"use client";

import Link from "next/link";

import type { LucideIcon } from "lucide-react";
import { buttonVariants } from "@/shared/ui/button";
import { cn } from "@/lib/utils";

/**
 * 페이지 상태 표시 3종(제목·에러·빈 상태) — 도메인을 모르고 원시값만 받는다.
 *
 * 원래 features/mypage/components 에 있었다. 브랜드 홈이 같은 ErrorState 를
 * 쓰면서 features 간 직접 import 가 생겼고, "2개 이상 페이지가 쓰는 것만
 * 승격"(CLAUDE.md) 조건을 충족해 여기로 옮겼다 — 레포에 하나뿐이던
 * feature 간 결합이 이 이동으로 사라진다.
 */
export function PageTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl font-bold tracking-[-0.02em] sm:text-2xl">
      {children}
    </h2>
  );
}

function StateShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-sm bg-muted/30 px-6 py-20 text-center">
      {children}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <StateShell>
      <p className="text-sm text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "mt-1 h-11 rounded-full px-6 transition-transform active:scale-[0.98]",
        )}
      >
        다시 시도
      </button>
    </StateShell>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionTo,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  actionTo: string;
}) {
  return (
    <StateShell>
      <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-7" strokeWidth={1.5} />
      </span>
      <p className="mt-1 text-base font-semibold tracking-tight">{title}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
      <Link
        href={actionTo}
        className={cn(
          buttonVariants(),
          "mt-2 h-11 rounded-full px-6 transition-transform active:scale-[0.98]",
        )}
      >
        {actionLabel}
      </Link>
    </StateShell>
  );
}
