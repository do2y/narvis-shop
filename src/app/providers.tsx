"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRestoreSession } from "@/shared/hooks/useRestoreSession";
import { useAuthSync } from "@/shared/hooks/useAuthSync";
import { AnalyticsProvider } from "@/shared/analytics/AnalyticsProvider";
import { SellerIsolation } from "@/shared/auth/SellerIsolation";
import { Toaster } from "@/shared/ui/Toaster";
import { LoginPromptDialog } from "@/shared/ui/LoginPromptDialog";

// 새로고침 시 RT 쿠키로 세션을 복원하고(원본 App.tsx와 동일 역할),
// 다른 탭의 로그인·로그아웃도 이 탭에 반영한다.
function SessionRestorer() {
  useRestoreSession();
  useAuthSync();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // 원본은 모듈 스코프에 QueryClient를 두었지만, 서버 렌더가 있는 환경에서는
  // 모듈 인스턴스가 요청 간에 공유되어 사용자끼리 캐시가 섞인다.
  // useState로 클라이언트마다 1개씩 만든다(마운트당 1회 생성, 리렌더에도 유지).
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SessionRestorer />
      {/* 이벤트 수집 초기화 + page_view 자동 발화(E-1) */}
      <AnalyticsProvider />
      {/* 판매자 격리(원본 BlockSeller) */}
      <SellerIsolation>{children}</SellerIsolation>
      {/* 전역 토스트 자리. 카드·목록 안에 문구를 넣으면 그 카드만 높이가 늘어
          옆 카드와 어긋나므로, 레이아웃 밖에서 띄운다 */}
      <Toaster />
      {/* 게스트 로그인 유도 모달. 띄우는 곳이 여럿(바로 구매·찜 4곳)이라
          호출부마다 두지 않고 여기 하나만 건다 */}
      <LoginPromptDialog />
    </QueryClientProvider>
  );
}
