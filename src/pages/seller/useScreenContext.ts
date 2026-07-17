import { useLocation, useSearchParams } from "react-router-dom";
import type { ChatScreenContext } from "@/shared/types/chat";

const ORDER_STATUS_LABEL: Record<string, string> = {
  ALL: "전체",
  NEW: "신규주문",
  PREPARING: "배송준비",
  SHIPPING: "배송중",
  DELIVERED: "배송완료",
  CLAIM: "취소·반품",
};

const PRODUCT_TAB_LABEL: Record<string, string> = {
  ALL: "전체",
  ON_SALE: "판매중",
  SOLD_OUT: "품절",
  HIDDEN: "숨김·판매중지",
};

/**
 * 지금 보고 있는 판매자 화면 — 사이드 채팅이 "이거 왜 이래?" 같은 지시어를 해석하는 근거.
 * 값이 아니라 getter를 함께 돌려주는 이유: 전송 시점의 화면을 실어야 하기 때문
 * (목록을 옮겨다니며 대화하므로 훅 초기화 시점 값은 금방 낡는다).
 */
export function useScreenContext(): {
  screen: ChatScreenContext;
  getScreenContext: () => ChatScreenContext;
} {
  const location = useLocation();
  const [params] = useSearchParams();

  const build = (): ChatScreenContext => {
    const path = location.pathname;

    if (path.startsWith("/seller/orders")) {
      const status = params.get("status") ?? "ALL";
      return {
        path,
        label: "주문 목록",
        filters: {
          상태: ORDER_STATUS_LABEL[status] ?? status,
          페이지: params.get("page") ?? "1",
        },
      };
    }
    if (path.startsWith("/seller/products")) {
      const tab = params.get("tab") ?? "ALL";
      return {
        path,
        label: "상품 목록",
        filters: {
          상태: PRODUCT_TAB_LABEL[tab] ?? tab,
          페이지: params.get("page") ?? "1",
        },
      };
    }
    return { path, label: "대시보드" };
  };

  return { screen: build(), getScreenContext: build };
}
