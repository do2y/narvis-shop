// ── SELLER 채널 전용 페이로드 ──
// 판매자 챗은 SHOPPING과 동일 엔드포인트를 channel만 바꿔 쓰지만 이벤트 집합이 다르다.
// 통계 답변은 차트 카드가 아니라 자연어 token 으로 오고, 쓰기(수정/삭제/등록)는
// draft(HITL 승인 대기) → confirm 흐름으로 온다. (계약 v2, 2026-07-22)

/** 첫 프레임 — FE가 즉시 레이아웃·로딩을 준비하는 레인 신호 */
export type SellerLane =
  | "analysis" // 통계 Q&A (progress 후 token)
  | "product" // 상품 상세 수정 제안 → draft
  | "general" // 일반 대화·되묻기
  | "confirm" // draft 승인 실행 결과
  | "apply" // "N번 적용해줘" 추천 적용 → draft
  | "refused"; // 도메인 밖 질문 거절

/** 종료 시 우측 패널 조치 — replace(교체) / keep(유지) / refresh(재조회) */
export type SellerPanel = "replace" | "keep" | "refresh";

/** 상품 수정 제안 필드(camelCase 8종) */
export type SellerDraftField =
  | "name"
  | "price"
  | "originalPrice"
  | "description"
  | "category"
  | "imageUrl"
  | "status"
  | "stockQuantity";

/**
 * 등록 초안 카드의 근거·주의 블록 (2026-08-08 신설).
 *
 * kind 를 닫힌 유니온으로 두지 않는다 — 종류가 늘어도 FE 배포 없이 서버만 바뀌면 되게.
 * 아는 값은 source(초안 근거) · warning(승인 전 확인) · note(수정 반영 내역) 3종이고,
 * **모르는 kind 는 무시한다**(렌더하지 않는다).
 */
export interface DraftSection {
  kind: string;
  title: string; // 블록 제목 — 그대로 출력
  items: string[]; // 불릿 항목 — 그대로 출력
}

/**
 * 등록 초안의 표시 사본 (op === "create" 에만 존재, 2026-08-08 신설).
 *
 * changes 가 실행 정본이고 이쪽은 사람이 읽을 형태로 서버가 옮겨 둔 것이다.
 * **화면은 preview 만 본다** — changes 로 그리면 "32,000원"에서 32000 을 역파싱하거나
 * 카테고리 변환·할인율 계산을 FE 가 떠안게 되고, 그 계산이 AI 와 어긋나는 날이 온다.
 * (preview 를 고쳐 보내도 저장 값은 안 바뀐다 — 승인은 draftId 만 보낸다.)
 *
 * 값이 없을 수 있는 필드는 null 로 오지 키가 빠지지 않는다 — undefined 분기 불필요.
 */
export interface DraftPreview {
  title: string;
  imageUrl: string | null;
  /** true 면 "이미지 미등록" 배지 — 등록 후에 알아채는 걸 막는 장치 */
  imagePlaceholder: boolean;
  /** "32,000원" — 서버가 포맷을 마쳤다. 콤마·단위를 다시 붙이지 말 것 */
  priceText: string;
  originalPriceText: string | null;
  /** 0 이면 할인 배지를 숨긴다 */
  discountRate: number;
  stockText: string; // "50개" — 포맷 완료
  /**
   * "패션의류/잡화 > 남성의류 > 셔츠".
   * changes 에는 categoryId 만 있고 이를 경로로 바꾸려면 1,221건짜리 트리가 필요한데
   * FE 에 그 트리가 없다 — AI 가 스냅샷을 갖고 있어 서버가 변환해 내려준다.
   */
  categoryPath: string;
  summary: string | null;
  description: string | null;
  sections: DraftSection[];
}

/** 상품 상세 수정/삭제/등록 제안(HITL 승인 대기) */
export interface SellerDraft {
  /**
   * confirm 이 참조(보여준 것 == 실행).
   * **캐싱 금지** — 수정 턴마다 새로 발급되고 이전 것은 서버가 무효화한다.
   * 옛 값으로 confirm 하면 실패한다(브라우저에 남은 카드로 수정 전 값이 등록되는 걸 막는 장치).
   */
  draftId: string;
  op: "update" | "create" | "delete";
  productId: string | null; // create는 null 일 수 있음
  /** 실행 정본 — 승인하면 이 값이 그대로 상품이 된다. 표시에는 쓰지 않는다 */
  changes: {
    field: SellerDraftField | string;
    before: string | number;
    after: string | number;
  }[];
  summary: string; // "가격을 27,500원으로 인하"
  /** 표시 사본 — op === "create" 에만 온다 */
  preview?: DraftPreview;
}

/** 판매자 progress 페이로드 — 자유 문자열(계약 S-4, 구매자와 쉐이프가 다르다) */
export interface SellerProgress {
  text: string;
}
