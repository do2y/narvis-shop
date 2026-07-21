import { useEffect } from "react";
import axios from "axios";
import { fetchMe } from "@/shared/api/auth";
import type { ApiEnvelope } from "@/shared/api/client";
import { useAuthStore } from "@/shared/stores/authStore";

/**
 * 부팅 시 세션 복원 — AT를 localStorage에 두지 않으므로 새로고침마다 필요하다.
 *
 * RT 쿠키로 AT를 재발급받고(/api/auth/refresh), 성공하면 /api/auth/me로 신원·역할을
 * 확인한다. me를 한 번 더 부르는 이유: persist된 user는 사용자가 편집 가능해서
 * role을 그대로 믿으면 가드가 뚫린다(백엔드가 최종 방어선이긴 하나 화면이 열리는 건 막아야 함).
 *
 * refresh는 api 인스턴스를 쓰지 않는다 — 게스트는 RT가 없어 401이 정상인데,
 * 인터셉터를 타면 /login으로 리다이렉트되어 게스트가 홈에 못 머문다.
 */
async function restore(): Promise<void> {
  const { setAccessToken, setUser, clearAuth } = useAuthStore.getState();

  let token: string;
  try {
    const res = await axios.post<ApiEnvelope<{ accessToken: string }>>(
      `${import.meta.env.VITE_API_BASE_URL}/api/auth/refresh`,
      null,
      { withCredentials: true },
    );
    const issued = res.data.data?.accessToken;
    if (!issued) throw new Error("no accessToken in refresh response");
    token = issued;
  } catch {
    // RT 없음/만료 = 비로그인 상태. 캐시된 user를 지워 가드가 통과시키지 않게 한다.
    clearAuth();
    return;
  }

  setAccessToken(token);

  try {
    setUser(await fetchMe());
  } catch {
    // AT는 받았는데 me가 실패 → 신원 불명이므로 로그인 상태로 취급하지 않는다.
    clearAuth();
  }
}

/** App 최상단에서 1회 실행. 완료 전까지 isRestoring=true라 가드는 판정을 보류한다. */
export function useRestoreSession(): void {
  useEffect(() => {
    let cancelled = false;
    restore().finally(() => {
      if (!cancelled) useAuthStore.getState().finishRestore();
    });
    return () => {
      cancelled = true;
    };
  }, []);
}
