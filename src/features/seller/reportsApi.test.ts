import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api/client";

const ensureSession = vi.fn();
const refreshTicket = vi.fn();

vi.mock("@/shared/chat/sessionCoordinator", () => ({
  ensureSession: (...a: unknown[]) => ensureSession(...a),
  refreshTicket: (...a: unknown[]) => refreshTicket(...a),
}));

const { fetchSellerReport, fetchSellerReports } = await import("./reportsApi");

/**
 * R-1·R-2 API 레이어. 회귀 방지 대상은 계약이 FE 에 위임한 규약이다:
 *  1. page(1-base) → offset(0-base) 변환
 *  2. 매 호출 티켓 재확보 (TTL 30~60초 < 화면 수명)
 *  3. 401 TOKEN_EXPIRED 만 재발급 후 1회 재시도
 *  4. UTC → KST 변환 (안 하면 화면이 9시간 어긋난다)
 */

const session = (ticket: string) => ({
  sessionId: "s-1",
  ttlSeconds: 600,
  streamTicket: ticket,
  ticketTtlSeconds: 60,
  llmSseUrl: "https://ai.example.com/chat/stream",
});

const listBody = {
  total: 1,
  unreadCount: 1,
  noReportReason: null,
  items: [
    {
      reportId: "a0ee2fd7-3b63-47ca-994d-376d3c7e041d",
      triggerType: "scheduled_daily",
      periodFrom: "2026-08-04",
      periodTo: "2026-08-10",
      title: "8월 10일 일간 분석",
      summary: "매출이 12.5% 감소했습니다.",
      recommendationCount: 2,
      hasHolds: true,
      createdAt: "2026-08-11T06:00:00Z",
      readAt: null,
    },
  ],
};

function jsonRes(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  ensureSession.mockResolvedValue(session("t-1"));
  refreshTicket.mockResolvedValue(session("t-2"));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("fetchSellerReports (R-1)", () => {
  it("page(1-base)를 offset(0-base)으로 옮긴다", async () => {
    fetchMock.mockResolvedValue(jsonRes(listBody));
    await fetchSellerReports({ page: 3, limit: 20 });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("offset")).toBe("40");
    expect(url.searchParams.get("limit")).toBe("20");
  });

  it("첫 페이지의 offset 은 0 이다", async () => {
    fetchMock.mockResolvedValue(jsonRes(listBody));
    await fetchSellerReports({ page: 1 });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("offset")).toBe("0");
  });

  it("AI 서버 origin 으로 나간다 — Spring 이 아니다", async () => {
    fetchMock.mockResolvedValue(jsonRes(listBody));
    await fetchSellerReports({ page: 1 });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin).toBe("https://ai.example.com");
    expect(url.pathname).toBe("/seller/reports");
  });

  it("티켓을 Bearer 로 싣고 쿠키는 싣지 않는다", async () => {
    fetchMock.mockResolvedValue(jsonRes(listBody));
    await fetchSellerReports({ page: 1 });

    const init = fetchMock.mock.calls[0][1];
    expect(init.headers.Authorization).toBe("Bearer t-1");
    expect(init.credentials).toBe("omit");
  });

  it("unreadOnly 는 켤 때만 싣는다", async () => {
    fetchMock.mockResolvedValue(jsonRes(listBody));
    await fetchSellerReports({ page: 1 });
    expect(fetchMock.mock.calls[0][0]).not.toContain("unreadOnly");

    await fetchSellerReports({ page: 1, unreadOnly: true });
    expect(fetchMock.mock.calls[1][0]).toContain("unreadOnly=true");
  });

  it("createdAt 을 KST 로 옮긴다", async () => {
    fetchMock.mockResolvedValue(jsonRes(listBody));
    const res = await fetchSellerReports({ page: 1 });

    expect(res.items[0].createdAt).toBe("2026-08-11T15:00:00+09:00");
    // 날짜(YYYY-MM-DD)는 타임존이 없어 변환 대상이 아니다
    expect(res.items[0].periodFrom).toBe("2026-08-04");
  });

  it("미읽음(readAt: null)은 null 로 남는다", async () => {
    fetchMock.mockResolvedValue(jsonRes(listBody));
    const res = await fetchSellerReports({ page: 1 });
    expect(res.items[0].readAt).toBeNull();
  });
});

describe("티켓 재시도", () => {
  it("매 호출 ensureSession 으로 티켓을 새로 확보한다", async () => {
    fetchMock.mockResolvedValue(jsonRes(listBody));
    await fetchSellerReports({ page: 1 });
    await fetchSellerReports({ page: 2 });

    // 티켓 TTL 이 화면 수명보다 짧아 캐싱하면 만료된 값을 쓰게 된다
    expect(ensureSession).toHaveBeenCalledTimes(2);
    expect(ensureSession).toHaveBeenCalledWith("SELLER");
  });

  it("401 TOKEN_EXPIRED 면 재발급 후 1회 재시도한다", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonRes({ error: { code: "TOKEN_EXPIRED", message: "만료" } }, 401),
      )
      .mockResolvedValueOnce(jsonRes(listBody));

    const res = await fetchSellerReports({ page: 1 });

    expect(refreshTicket).toHaveBeenCalledWith("SELLER", "s-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // 재시도는 새 티켓으로 나가야 한다
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer t-2");
    expect(res.total).toBe(1);
  });

  it("재시도는 1회뿐이다 — 계속 401 이면 던진다", async () => {
    fetchMock.mockResolvedValue(
      jsonRes({ error: { code: "TOKEN_EXPIRED", message: "만료" } }, 401),
    );

    await expect(fetchSellerReports({ page: 1 })).rejects.toThrow(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refreshTicket).toHaveBeenCalledTimes(1);
  });

  it("INVALID_SELLER_IDENTITY 는 재발급해도 같은 결과라 재시도하지 않는다", async () => {
    fetchMock.mockResolvedValue(
      jsonRes(
        { error: { code: "INVALID_SELLER_IDENTITY", message: "신원 실패" } },
        401,
      ),
    );

    await expect(fetchSellerReports({ page: 1 })).rejects.toMatchObject({
      code: "INVALID_SELLER_IDENTITY",
    });
    expect(refreshTicket).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("400 은 재시도 없이 ApiError 로 던진다", async () => {
    fetchMock.mockResolvedValue(
      jsonRes({ error: { code: "BAD_REQUEST", message: "범위 위반" } }, 400),
    );

    await expect(fetchSellerReports({ page: 1, limit: 999 })).rejects.toMatchObject(
      { code: "BAD_REQUEST", status: 400 },
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("본문이 JSON 이 아니어도 status 로 ApiError 를 만든다", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);

    await expect(fetchSellerReports({ page: 1 })).rejects.toMatchObject({
      status: 500,
      code: "UNKNOWN",
    });
  });
});

describe("fetchSellerReport (R-2)", () => {
  const detail = {
    title: "8월 10일 일간 분석",
    period: { from: "2026-08-04", to: "2026-08-10" },
    generatedAt: "2026-08-11T06:00:00Z",
    summary: "요약",
    body: "본문",
    findings: [],
    limitations: [],
    chartRequested: false,
    charts: [],
    recommendations: [
      {
        index: 1,
        title: "감귤청 가격 10% 인하",
        expectedEffect: "전환율 +1.2%p",
        actionType: "price_adjust",
        productId: 101,
        status: "applied",
        appliedAt: "2026-08-11T06:00:00Z",
      },
    ],
    applyGuide: "적용을 원하시면…",
    reportId: "a0ee2fd7-3b63-47ca-994d-376d3c7e041d",
    triggerType: "scheduled_daily",
    comparedPeriod: { from: "2026-07-28", to: "2026-08-03" },
    segments: [],
    holds: [{ step: "churn", reason: "표본 부족으로 판정 보류" }],
    readAt: null,
  };

  it("reportId 를 경로에 인코딩해 붙인다", async () => {
    fetchMock.mockResolvedValue(jsonRes(detail));
    await fetchSellerReport("a0ee2fd7-3b63-47ca-994d-376d3c7e041d");

    expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe(
      "/seller/reports/a0ee2fd7-3b63-47ca-994d-376d3c7e041d",
    );
  });

  it("generatedAt·appliedAt 을 KST 로 옮긴다", async () => {
    fetchMock.mockResolvedValue(jsonRes(detail));
    const res = await fetchSellerReport("a0ee2fd7");

    expect(res.generatedAt).toBe("2026-08-11T15:00:00+09:00");
    expect(res.recommendations[0].appliedAt).toBe("2026-08-11T15:00:00+09:00");
  });

  it("첫 조회의 readAt 은 null 이다 — 각인 직전 값이 온다", async () => {
    fetchMock.mockResolvedValue(jsonRes(detail));
    const res = await fetchSellerReport("a0ee2fd7");
    expect(res.readAt).toBeNull();
  });

  it("index 순서를 그대로 보존한다 — 'N번 적용해줘'의 N", async () => {
    fetchMock.mockResolvedValue(jsonRes(detail));
    const res = await fetchSellerReport("a0ee2fd7");
    expect(res.recommendations.map((r) => r.index)).toEqual([1]);
  });

  it("404 REPORT_NOT_FOUND 를 전파한다", async () => {
    fetchMock.mockResolvedValue(
      jsonRes({ error: { code: "REPORT_NOT_FOUND", message: "없음" } }, 404),
    );

    await expect(fetchSellerReport("없는id")).rejects.toMatchObject({
      code: "REPORT_NOT_FOUND",
      status: 404,
    });
  });
});

describe("base URL 도출", () => {
  /**
   * 계약이 R-1/R-2 를 {AI_SERVER}/seller/reports(루트 기준)로 적었으므로
   * llmSseUrl 에서 호스트만 있으면 조립이 끝난다. SSE 경로 모양은 가정하지 않는다.
   */
  async function requestUrlFor(llmSseUrl: string) {
    ensureSession.mockResolvedValue({ ...session("t-1"), llmSseUrl });
    fetchMock.mockResolvedValue(jsonRes(listBody));
    await fetchSellerReports({ page: 1 });
    const url = new URL(fetchMock.mock.calls.at(-1)![0]);
    return `${url.origin}${url.pathname}`;
  }

  it("SSE 경로는 버리고 호스트만 쓴다", async () => {
    expect(await requestUrlFor("https://ai.example.com/chat/stream")).toBe(
      "https://ai.example.com/seller/reports",
    );
  });

  it("SSE 경로가 무엇이든 결과가 같다 — 경로 모양을 가정하지 않는다", async () => {
    // AI 팀이 SSE 경로를 바꿔도 R-1/R-2 는 영향받지 않아야 한다
    expect(await requestUrlFor("https://ai.example.com/api/v2/sse")).toBe(
      "https://ai.example.com/seller/reports",
    );
    expect(await requestUrlFor("https://ai.example.com")).toBe(
      "https://ai.example.com/seller/reports",
    );
  });

  it("포트를 보존한다 — 로컬 AI 서버가 8000 번을 쓴다", async () => {
    expect(await requestUrlFor("http://localhost:8000/chat/stream")).toBe(
      "http://localhost:8000/seller/reports",
    );
  });

  it("절대 URL 이 아니면 TypeError 대신 ApiError 로 옮긴다", async () => {
    ensureSession.mockResolvedValue({ ...session("t-1"), llmSseUrl: "/relative" });

    await expect(fetchSellerReports({ page: 1 })).rejects.toMatchObject({
      code: "REPORT_ENDPOINT_UNRESOLVED",
    });
  });
});
