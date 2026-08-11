import { refreshAccessToken } from "@/shared/auth/refresh";

/**
 * 401 배치 1회 재전송 (E-1).
 *
 * 훅·전송부에서 떼어낸 이유는 "언제 다시 보내는가"를 테스트로 고정하기 위해서다.
 * 이 판정이 느슨해지면 수집이 조용히 재시도 루프가 되는데, 화면으로는 아무것도
 * 보이지 않는다(수집은 실패해도 앱이 멀쩡히 돈다).
 */

/**
 * 이 응답을 재전송 대상으로 볼지.
 *
 * **401만이다.** 401 은 서버가 요청을 받고 명시적으로 거부한 것이라 적재가 일어나지
 * 않았음이 확실하고, AT 재발급이라는 고칠 방법도 있다.
 *
 * 5xx·네트워크 오류는 대상이 아니다 — 서버가 받았는지 알 수 없어 재전송이 곧
 * 중복 위험이고(서버 UNIQUE 가 막긴 하지만 부하는 는다), 다시 보낸다고 나아질
 * 이유도 없다. 기존 "재시도하면 중복·부하만 는다"는 판단은 그쪽에서 여전히 유효하다.
 */
export function shouldRetryBatch(status: number): boolean {
  return status === 401;
}

/**
 * AT 재발급 — 성공 여부만 돌려준다.
 *
 * 재발급 호출 자체는 client.ts 와 **공용 single-flight helper**를 쓴다.
 * 다만 실패 후처리는 공유하지 않는다 — 화면 쪽은 로그인 화면으로 이동하지만,
 * 수집은 배경 작업이라 여기서는 조용히 포기해야 한다.
 *
 * 재발급에 실패하면 그냥 포기한다(그 배치는 잃는다) — 로그인 상태가 정말 끝난
 * 것이므로, 다시 보내도 또 401 이다.
 */
async function refreshToken(): Promise<boolean> {
  try {
    // keepalive 배치도 이 helper를 타게 두되, 탭 종료 구간 편향은 별도 과제로 남긴다.
    await refreshAccessToken({ keepalive: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * 401 이면 재발급 후 배치를 **한 번만** 다시 보낸다.
 *
 * 한 번인 이유: 두 번째 401 은 재발급이 됐는데도 거부됐다는 뜻이라 더 보내도 같다.
 * 재전송 자체는 안전하다 — `id` 가 UNIQUE 라 서버가 중복을 막는다(계약 E-1).
 *
 * `sendOnce` 는 상태 코드를 돌려주거나, 네트워크 오류면 null 을 돌려준다.
 */
export async function sendWithAuthRetry(
  sendOnce: () => Promise<number | null>,
): Promise<void> {
  const status = await sendOnce();
  if (status === null || !shouldRetryBatch(status)) return;

  if (await refreshToken()) {
    // 결과는 보지 않는다 — 여기서 또 실패하면 그 배치는 잃는 것으로 끝낸다.
    // 수집 실패가 앱 동작을 막지 않는다는 원칙(track.ts)은 그대로다.
    await sendOnce();
  }
}
