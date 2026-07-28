"use client";

import { SellerHeader } from "./components/SellerHeader";

/**
 * 판매자 셸 — 헤더 + 본문(대시보드·목록).
 * AI 채팅은 이 셸을 쓰지 않는 별도 화면이다(/seller/chat) — 원본과 동일하게
 * App Router에서도 chat을 셸 레이아웃 밖에 둔다(라우트 그룹 `(shell)`로 분리).
 */
export function SellerShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SellerHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        {children}
      </main>
    </div>
  );
}
