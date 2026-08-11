const REFRESH_ENDPOINT = `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}/api/auth/refresh`;

export interface RefreshAccessTokenOptions {
  keepalive?: boolean;
}

let refreshing: Promise<void> | null = null;

async function postRefresh({
  keepalive = false,
}: RefreshAccessTokenOptions = {}): Promise<void> {
  const res = await fetch(REFRESH_ENDPOINT, {
    method: "POST",
    credentials: "include",
    keepalive,
  });

  // fetch는 4xx/5xx도 resolve하므로, 호출부가 기존과 같이 catch로 분기하게 명시적으로 reject한다.
  if (!res.ok) {
    throw new Error(`AUTH_REFRESH_FAILED:${res.status}`);
  }
}

/**
 * AT 재발급 single-flight.
 *
 * refresh 자체는 앱 전역에서 동시에 1번만 나가야 한다. RT가 1회용 회전이라
 * 화면 API와 배경 수집이 동시에 401을 맞아도, 둘이 각자 /refresh를 치면 진 쪽은
 * AUTH_REQUIRED를 받아 불필요한 로그아웃/손실을 만든다.
 *
 * 성공/실패 후처리는 호출부가 맡는다:
 * - 화면 API: 실패 시 로그인 유도
 * - 수집: 실패 시 조용히 포기
 * - 부팅 복원: 실패 시 캐시된 user 정리
 */
export function refreshAccessToken(
  options: RefreshAccessTokenOptions = {},
): Promise<void> {
  refreshing ??= postRefresh(options).finally(() => {
    refreshing = null;
  });
  return refreshing;
}
