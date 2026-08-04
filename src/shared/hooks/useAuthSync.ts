"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchMe } from "@/shared/api/auth";
import { useAuthStore } from "@/shared/stores/authStore";

/**
 * 다른 탭의 로그인·로그아웃을 이 탭에도 반영한다.
 *
 * zustand persist 는 마운트 시 localStorage 를 한 번 읽고 그 뒤로는 메모리로만
 * 동작한다 — 다른 탭이 값을 바꿔도 다시 읽지 않는다. 그래서 한 탭에서 로그인해도
 * 다른 탭 헤더는 "로그인" 버튼으로 남고, 장바구니 뱃지도 게스트 상태로 굳는다.
 *
 * AT·RT 가 httpOnly 쿠키라 이 탭도 이미 인증된 요청을 보낼 수 있다(쿠키는 탭 전체
 * 공유). 즉 실제 권한은 이미 옮겨 왔고 화면 표시만 어긋난 상태이므로, 여기서는
 * 표시를 맞추기만 하면 된다 — 토큰을 복원할 일이 없다.
 *
 * 새로고침을 강제하지 않는 이유: 입력 중이던 텍스트·스크롤 위치가 날아간다.
 * 사용자가 실패한 것도 아닌데 흐름을 끊을 이유가 없다.
 */

/** persist 가 쓰는 저장소 키 — authStore 의 `name` 과 반드시 같아야 한다. */
const AUTH_STORAGE_KEY = "jarvis-auth";

/**
 * 저장된 값에서 user 유무만 본다. role 등 내용은 신뢰하지 않는다 —
 * localStorage 는 사용자가 편집 가능하므로 "로그인 상태가 바뀌었다"는 신호로만 쓰고,
 * 실제 신원은 서버(me)에 다시 묻는다.
 */
function hasUser(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { state?: { user?: unknown } };
    return parsed.state?.user != null;
  } catch {
    return false;
  }
}

export function useAuthSync(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      // 다른 탭의 변경만 온다(같은 탭의 setItem 은 이벤트를 발생시키지 않는다).
      if (e.key !== AUTH_STORAGE_KEY) return;

      const loggedIn = hasUser(e.newValue);
      const store = useAuthStore.getState();

      // 로그아웃 — 서버에 물을 것도 없이 즉시 정리한다. 늦게 반영하면 이미 무효인
      // 세션으로 화면이 열려 있는 구간이 생긴다.
      // 캐시도 함께 비운다(useLogout 과 같은 이유) — 안 그러면 이전 사용자의
      // 장바구니·주문·찜이 이 탭에 그대로 남는다.
      if (!loggedIn) {
        if (store.user) {
          store.clearAuth();
          queryClient.clear();
        }
        return;
      }

      // 로그인 — 이미 이 탭도 같은 사용자로 보고 있으면 할 일이 없다.
      // (다른 탭의 me 갱신 등으로 같은 값이 다시 써질 수 있다.)
      if (store.user) return;

      // 신원은 서버 응답으로 확정한다. 쿠키가 이미 있으므로 그냥 통과한다.
      // 실패하면 아직 인증이 안 선 것이므로 게스트로 둔다 — 여기서 실패해도
      // 사용자가 하던 일은 그대로이고, 다음 새로고침에 복원 경로가 다시 판정한다.
      fetchMe()
        .then((me) => {
          useAuthStore.getState().setUser(me);
          // 게스트로 채운 캐시(장바구니 등)를 회원 것으로 다시 받게 한다.
          // 로그인 시 서버가 게스트 장바구니를 병합하므로 내용이 달라진다.
          queryClient.invalidateQueries();
        })
        .catch(() => {});
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // queryClient 는 Providers 에서 useState 로 1회 생성돼 바뀌지 않는다 —
    // deps 에 있어도 리스너가 다시 등록되지 않는다.
  }, [queryClient]);
}
