"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRestoreSession } from "@/shared/hooks/useRestoreSession";

// AT는 메모리에만 두므로 새로고침 시 RT 쿠키로 세션을 복원한다(원본 App.tsx와 동일 역할).
function SessionRestorer() {
  useRestoreSession();
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
      {children}
    </QueryClientProvider>
  );
}
