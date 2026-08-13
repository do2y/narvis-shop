import { ApiError } from "@/shared/api/client";
import { ensureSession, refreshTicket } from "@/shared/chat/sessionCoordinator";
import { utcToKst, utcToKstNullable } from "@/shared/utils/kstTime";
import type {
  ChatSession,
  SellerReportDetail,
  SellerReportListResponse,
} from "@/shared/types/chat";

/**
 * 판매자 저장 보고서 조회 (R-1·R-2, 2026-08-12 신설 · 이슈 #599).
 *
 * 이 모듈만 특이한 이유 세 가지 — 전부 계약이 그렇게 정한 것이다.
 *
 * 1. **Spring 이 아니라 AI 서버 직행이다.** 공통 axios(api) 인스턴스를 쓰지 않는다.
 *    그 인스턴스는 baseURL 이 Spring 이고 쿠키 AT 로 인증하는데, 여기는 둘 다 다르다.
 * 2. **인증이 쿠키 AT 가 아니라 단명 streamTicket 이다.** CH-6 티켓을 재사용하며
 *    신규 발급 경로가 없다. 조회 브랜드는 티켓 클레임(brandId)에서만 도출된다
 *    — body·쿼리에 신원이 없다(IDOR 방지).
 * 3. **시각이 UTC 로 온다.** S-4 는 KST 인데 여기는 Z 다. 화면에 넘기기 전에 옮긴다.
 */

/** 401 재발급 후 재시도는 1회뿐 — 무한 루프 방지(shared/api 의 _retry 와 같은 원칙). */
const TICKET_RETRY_LIMIT = 1;

/**
 * AI 서버 origin — llmSseUrl 에서 호스트만 취한다.
 *
 * ⚠️ 여기가 이 모듈의 유일한 URL 조립 지점이다.
 *
 * FE 가 AI 서버 주소를 아는 경로는 세션 응답의 llmSseUrl 뿐이다. BE 의 LLM_SSE_URL 은
 * Spring 쪽 환경변수라 FE 번들에 들어오지 않고, 들어와서도 안 된다 — 주소는 런타임에
 * 서버가 주는 값이지 프론트가 설정으로 갖는 값이 아니다.
 *
 * **경로가 아니라 origin 만 쓰는 이유**: 계약이 R-1/R-2 경로를 {AI_SERVER}/seller/reports
 * 로 적었다. 루트 기준 경로이므로 호스트만 있으면 조립이 끝난다. llmSseUrl 의 경로
 * (/chat/stream 등)는 SSE 전용이라 재사용할 것이 없고, 그 경로 모양을 FE 가 안다고
 * 가정하면(꼬리를 잘라내는 식) AI 팀이 SSE 경로를 바꾸는 날 조용히 깨진다 —
 * origin 만 취하면 그 가정 자체가 없다.
 *
 * 만약 AI 서버가 경로 prefix(/v1 등) 뒤에 있다면 이 함수가 그것을 알 방법이 없다.
 * 그때는 추측을 늘리는 대신 BE 가 세션 응답에 base URL 필드를 실어주는 것이 맞다 —
 * 조립을 이 함수 하나에 가둬 뒀으므로 그 경우 본문만 갈아끼우면 된다.
 * (증상은 R-1/R-2 전건 404 이고, REPORT_NOT_FOUND 가 아니라 경로 자체가 없어서 나는
 *  404 라 응답 본문의 code 로 구분된다.)
 */
function reportsBaseUrl(session: ChatSession): string {
  try {
    return new URL(session.llmSseUrl).origin;
  } catch {
    // llmSseUrl 이 절대 URL 이 아니면 조립할 수 없다. 화면이 "불러오지 못했어요"로
    // 끝나게 ApiError 로 옮긴다 — TypeError 가 그대로 올라가면 분기할 코드가 없다.
    throw new ApiError(
      {
        code: "REPORT_ENDPOINT_UNRESOLVED",
        message: "보고서 서버 주소를 확인할 수 없어요.",
      },
      undefined,
    );
  }
}

/**
 * AI 서버 공통 실패 봉투(§2.5) → ApiError.
 *
 * 형태가 Spring 과 다르다: { error: { code, message, requestId } } — success 플래그가 없고
 * fields·detail 도 없다. 그래서 client.ts 의 인터셉터를 재사용할 수 없다.
 *
 * ApiError 로 옮기는 이유는 화면 쪽 재사용이다 — toSellerErrorView 가 ApiError.code 로
 * 분기하므로, 여기서 봉투를 벗겨두면 판매자 화면 3종과 같은 에러 UI 를 그대로 쓴다.
 */
async function toApiError(res: Response): Promise<ApiError> {
  let code = "UNKNOWN";
  let message = "보고서를 불러오지 못했어요.";
  try {
    const body = await res.json();
    if (typeof body?.error?.code === "string") code = body.error.code;
    if (typeof body?.error?.message === "string") message = body.error.message;
  } catch {
    // 본문 없음·비 JSON — status 만으로 진행한다
  }
  return new ApiError({ code, message }, res.status);
}

/**
 * 티켓을 실어 AI 서버로 GET 하고, 401 이면 티켓을 재발급해 1회 재시도한다.
 *
 * **매 호출마다 ensureSession 으로 티켓을 새로 확보하는 것이 핵심이다.**
 * 티켓 TTL 은 30~60초인데 목록 화면은 그보다 훨씬 오래 열려 있다. 티켓을 컴포넌트
 * state 나 React Query 캐시에 담아 두면 반드시 만료된 값을 쓰게 된다.
 * (useChat 이 매 전송 직전 acquireTicket() 을 부르는 것과 같은 이유다.)
 * 발급 자체는 sessionCoordinator 가 localStorage 캐시 25초 + Web Locks 로 단일화하므로
 * 화면이 몇 번을 부르든 CH-6 이 그만큼 나가지는 않는다.
 *
 * 401 재시도가 안전한 이유: GET 이라 부수효과가 없다. (R-2 는 읽음 각인이라는 부수효과가
 * 있지만 명세가 "각인은 멱등"이라고 못박았다.)
 */
async function ticketedGet<T>(path: string): Promise<T> {
  let session = await ensureSession("SELLER");

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${reportsBaseUrl(session)}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.streamTicket}`,
      },
      // 티켓으로 인증하므로 쿠키를 실을 이유가 없다. 오히려 실으면 AI 서버가
      // 크로스 오리진 자격증명을 허용하도록 CORS 를 넓혀야 한다.
      credentials: "omit",
    });

    if (res.ok) return (await res.json()) as T;

    const err = await toApiError(res);

    // 티켓 만료·무효만 재발급 대상이다. INVALID_SELLER_IDENTITY 는 티켓 자체는
    // 유효하나 신원 조립이 실패한 것이라 재발급해도 같은 결과다(계약 R-1 실패표).
    const expired =
      res.status === 401 &&
      (err.code === "TOKEN_EXPIRED" || err.code === "TOKEN_INVALID");

    if (!expired || attempt >= TICKET_RETRY_LIMIT) throw err;

    session = await refreshTicket("SELLER", session.sessionId);
  }
}

export interface FetchReportsParams {
  /** 1-base. 화면(Pagination)의 규약이며 offset 변환은 이 모듈이 한다. */
  page: number;
  /** 계약 허용 1~100. 범위 밖은 서버가 400(RequestValidationError→400, 422 아님). */
  limit?: number;
  unreadOnly?: boolean;
}

/** 목록 기본 크기 — 계약 기본값(20)과 맞춘다. */
export const REPORTS_PAGE_SIZE = 20;

/**
 * R-1 보고서 목록 — GET {AI_SERVER}/seller/reports
 *
 * 정렬은 서버가 최신순(createdAt DESC)으로 고정한다. FE 재정렬 금지.
 */
export async function fetchSellerReports({
  page,
  limit = REPORTS_PAGE_SIZE,
  unreadOnly = false,
}: FetchReportsParams): Promise<SellerReportListResponse> {
  // 계약은 offset(0-base) 이고 화면은 page(1-base) 다. 변환을 여기 가둬
  // 화면이 offset 을 몰라도 되게 한다(판매자 목록 3종과 같은 방식).
  const offset = Math.max(0, page - 1) * limit;

  const qs = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  // 기본값이 false 라 굳이 싣지 않는다 — 쿼리스트링이 짧을수록 캐시 키도 단순하다.
  if (unreadOnly) qs.set("unreadOnly", "true");

  const raw = await ticketedGet<SellerReportListResponse>(
    `/seller/reports?${qs}`,
  );

  return {
    ...raw,
    items: raw.items.map((item) => ({
      ...item,
      // periodFrom/To 는 날짜(YYYY-MM-DD)라 타임존이 없다 — 변환 대상이 아니다.
      createdAt: utcToKst(item.createdAt),
      readAt: utcToKstNullable(item.readAt),
    })),
  };
}

/**
 * R-2 보고서 상세 — GET {AI_SERVER}/seller/reports/{reportId}
 *
 * **조회가 곧 읽음 각인이다.** 성공 응답의 readAt 은 이번 조회로 바뀌기 직전 값이라
 * 첫 조회는 null 이고, 직후 R-1 의 unreadCount 가 줄어든다. 호출부는 성공 후
 * 목록 쿼리를 무효화해야 배지가 맞는다.
 *
 * 404 REPORT_NOT_FOUND 는 "없는 보고서"와 "남의 브랜드 보고서"가 **같은 응답**이다 —
 * 존재 여부를 구분해 알려주면 id 열거가 되므로 의도된 설계다(CH-5 소유권 404 와 같은 원칙).
 */
export async function fetchSellerReport(
  reportId: string,
): Promise<SellerReportDetail> {
  const raw = await ticketedGet<SellerReportDetail>(
    `/seller/reports/${encodeURIComponent(reportId)}`,
  );

  return {
    ...raw,
    generatedAt: utcToKst(raw.generatedAt),
    readAt: utcToKstNullable(raw.readAt),
    // appliedAt 도 UTC 로 온다. 화면이 아직 쓰지 않더라도 여기서 옮겨 둔다 —
    // 나중에 배지를 붙이는 사람이 이 필드만 UTC 인 걸 모르고 쓰게 되기 때문이다.
    recommendations: raw.recommendations.map((r) => ({
      ...r,
      appliedAt: utcToKstNullable(r.appliedAt ?? null),
    })),
  };
}
