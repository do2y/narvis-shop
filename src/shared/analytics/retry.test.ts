import { afterEach, describe, expect, it, vi } from "vitest";
import { sendWithAuthRetry, shouldRetryBatch } from "./retry";

/**
 * E-1 401 재전송 — 「API 명세와의 정합 요구사항」 2026-08-10 항목의 선택지 ①.
 *
 * 회귀 방지 대상은 **재전송 범위가 401 하나로 묶여 있다는 것**이다.
 * 5xx 로 넓어지면 track.ts 가 원래 경고하던 중복·부하가 실제로 생기고,
 * 401 이 빠지면 AT 만료 구간(수명 30분)의 배치가 다시 통째로 사라진다.
 * 어느 쪽이든 화면에는 아무 증상이 없어 눈으로는 못 잡는다.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

/** refresh 엔드포인트 응답을 고정한다 — 재전송 경로는 이 결과에 달려 있다 */
function stubRefresh(ok: boolean) {
  const fetchMock = vi.fn().mockResolvedValue({ ok });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("shouldRetryBatch — 401 하나만", () => {
  it("401 은 재전송 대상이다", () => {
    expect(shouldRetryBatch(401)).toBe(true);
  });

  it.each([202, 400, 403, 429, 500, 502, 503])(
    "%i 는 재전송하지 않는다",
    (status) => {
      expect(shouldRetryBatch(status)).toBe(false);
    },
  );
});

describe("sendWithAuthRetry", () => {
  it("성공(202)이면 한 번만 보낸다", async () => {
    const send = vi.fn().mockResolvedValue(202);
    await sendWithAuthRetry(send);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("401 이면 재발급 후 한 번 더 보낸다", async () => {
    stubRefresh(true);
    const send = vi.fn().mockResolvedValueOnce(401).mockResolvedValueOnce(202);
    await sendWithAuthRetry(send);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("동시 401 배치도 재발급은 한 번만 보낸다", async () => {
    let resolveRefresh!: (value: { ok: boolean }) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<{ ok: boolean }>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const sendA = vi.fn().mockResolvedValueOnce(401).mockResolvedValueOnce(202);
    const sendB = vi.fn().mockResolvedValueOnce(401).mockResolvedValueOnce(202);

    const first = sendWithAuthRetry(sendA);
    const second = sendWithAuthRetry(sendB);
    try {
      await Promise.resolve();
      await Promise.resolve();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      resolveRefresh({ ok: true });
      await Promise.all([first, second]);
    }

    expect(sendA).toHaveBeenCalledTimes(2);
    expect(sendB).toHaveBeenCalledTimes(2);
  });

  it("재발급이 실패하면 다시 보내지 않는다 — 로그인이 정말 끝난 상태다", async () => {
    stubRefresh(false);
    const send = vi.fn().mockResolvedValue(401);
    await sendWithAuthRetry(send);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("재전송도 401 이면 거기서 멈춘다 — 무한 루프가 되지 않는다", async () => {
    stubRefresh(true);
    const send = vi.fn().mockResolvedValue(401);
    await sendWithAuthRetry(send);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("네트워크 오류(null)는 재전송하지 않는다 — 서버가 받았는지 알 수 없다", async () => {
    const fetchMock = stubRefresh(true);
    const send = vi.fn().mockResolvedValue(null);
    await sendWithAuthRetry(send);
    expect(send).toHaveBeenCalledTimes(1);
    // 재발급 시도조차 하지 않는다
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("5xx 는 재전송하지 않는다 — 중복·부하만 는다는 기존 판단이 여기서 유효하다", async () => {
    const fetchMock = stubRefresh(true);
    const send = vi.fn().mockResolvedValue(500);
    await sendWithAuthRetry(send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("재발급 요청이 던져도 삼킨다 — 수집 실패가 앱을 막지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const send = vi.fn().mockResolvedValue(401);
    await expect(sendWithAuthRetry(send)).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(1);
  });
});
