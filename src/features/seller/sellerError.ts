import { ApiError } from "@/shared/api/client";

/**
 * 판매자 화면 조회 실패를 사용자 안내로 옮긴다(S-1·S-2·S-3·CH-6).
 *
 * 종전에는 전부 "불러오지 못했어요 + 다시 시도"로 뭉뜽그려졌다. 그런데 원인에 따라
 * 사용자가 할 일이 다르다 — 파라미터 오류는 화면을 되돌려야 하고, 브랜드 미연결은
 * 재시도해봐야 소용없이 운영에 문의해야 한다.
 */
export interface SellerErrorView {
  message: string;
  /** 재시도 버튼을 줄지. 재시도해도 같은 결과가 뻔하면 false. */
  retryable: boolean;
  /** 덧붙일 안내(해결 방법). 없으면 생략한다. */
  hint?: string;
}

const FALLBACK: SellerErrorView = {
  message: "정보를 불러오지 못했어요.",
  retryable: true,
};

export function toSellerErrorView(
  error: unknown,
  fallbackMessage = FALLBACK.message,
): SellerErrorView {
  if (!(error instanceof ApiError)) {
    return { ...FALLBACK, message: fallbackMessage };
  }

  switch (error.code) {
    case "SELLER_BRAND_NOT_FOUND":
      // 계정에 연결된 브랜드가 없다. 운영이 연결해줘야 풀리므로 재시도가 무의미하다 —
      // 그냥 에러만 띄우면 판매자는 뭘 해야 할지 알 수 없다(명세 S-1).
      return {
        message: "연결된 브랜드가 없어요.",
        retryable: false,
        hint: "운영 담당자에게 브랜드 연결을 요청해주세요.",
      };

    // 파라미터가 잘못됐다 — 같은 요청을 다시 보내도 같은 400 이다.
    // 화면 상태(탭·정렬·페이지)에서 비롯되므로 되돌리도록 안내한다.
    case "SELLER_INVALID_PARAM":
    case "ORDER_INVALID_PARAM":
    case "PRODUCT_INVALID_PARAM":
      return {
        message: "조회 조건이 올바르지 않아요.",
        retryable: false,
        hint: "필터를 초기화한 뒤 다시 시도해주세요.",
      };

    case "VALIDATION_ERROR":
      // 값 자체가 형식에 안 맞는 경우(숫자여야 할 자리에 문자 등).
      // 서버가 필드 사유를 주면 그게 더 구체적이다.
      return {
        message: error.displayMessage || "조회 조건이 올바르지 않아요.",
        retryable: false,
      };

    default:
      return { ...FALLBACK, message: fallbackMessage };
  }
}
