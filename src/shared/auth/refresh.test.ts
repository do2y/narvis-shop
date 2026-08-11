import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function loadRefreshModule() {
  return import("./refresh");
}

describe("refreshAccessToken", () => {
  it("동시 호출이 와도 refresh 요청은 한 번만 나간다", async () => {
    let resolveFetch!: (value: { ok: boolean; status: number }) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<{ ok: boolean; status: number }>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );

    const { refreshAccessToken } = await loadRefreshModule();

    const first = refreshAccessToken();
    const second = refreshAccessToken({ keepalive: true });
    try {
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      resolveFetch({ ok: true, status: 200 });
      await Promise.all([first, second]);
    }
  });

  it("실패 뒤에는 in-flight 슬롯을 비워 다음 호출이 다시 시도된다", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 401 })
        .mockResolvedValueOnce({ ok: true, status: 200 }),
    );

    const { refreshAccessToken } = await loadRefreshModule();

    await expect(refreshAccessToken()).rejects.toThrow("AUTH_REFRESH_FAILED:401");
    await expect(refreshAccessToken()).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
