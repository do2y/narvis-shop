"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ChatScreenContext } from "@/shared/types/chat";
import type {
  SellerOrderTab,
  SellerProductSort,
  SellerProductTab,
  SellerWorkspaceTab,
} from "./types";

/**
 * 판매자 챗의 screen 컨텍스트 (계약 S-4 §screen).
 *
 * pageType 은 라우트가 아니라 **우측 워크스페이스 탭**을 가리킨다 — 판매자 채팅은
 * /seller/chat 한 곳뿐이라 라우트를 실으면 항상 seller_chat 이라 정보가 0이다.
 * 그래서 실제로 보내는 값은 seller_orders·seller_products 2종이다.
 *
 * filters 값은 enum 코드가 아니라 **화면에 보이는 한글 표시값**이다(CH-2 정본).
 * 프롬프트에 그대로 들어가므로 ORDERED 같은 코드값은 뜻이 전달되지 않는다.
 */

// 목록 상단 탭의 표시 문구 — OrderList·ProductList 의 TABS 라벨과 같아야 한다.
// 사용자가 화면에서 읽은 말이 그대로 프롬프트에 실려야 "이 목록"이 통한다.
const ORDER_TAB_LABEL: Record<SellerOrderTab, string> = {
  ALL: "전체",
  ORDERED: "신규주문",
  SHIPPING: "배송중",
  DELIVERED: "배송완료",
  CLAIM: "취소·반품",
};

const PRODUCT_TAB_LABEL: Record<SellerProductTab, string> = {
  ALL: "전체",
  ON_SALE: "판매중",
  SOLD_OUT: "품절",
  HIDDEN: "숨김",
};

const PRODUCT_SORT_LABEL: Record<SellerProductSort, string> = {
  latest: "최신순",
  sales: "판매량순",
  stock: "재고순",
  price: "가격순",
};

export interface SellerScreenState {
  tab: SellerWorkspaceTab;
  orderTab: SellerOrderTab;
  orderPage: number;
  productTab: SellerProductTab;
  productSort: SellerProductSort;
  productPage: number;
  /**
   * 상품 목록에 실제로 그려진 줄 — "1번 상품 가격 내려줘"의 "1번"이 화면 순번이라
   * 이게 없으면 draft 대상 productId 를 확정할 근거가 없다(S-4).
   * 소유권은 Spring 하드게이트(brandId)가 막으므로 여기서 거르지 않는다.
   */
  products: { productId: string; name: string }[];
}

// page 는 0-base 로 관리하지만 화면에는 1부터 보인다 — 표시값을 보내는 계약이라
// 그대로 보내면 AI 가 사용자가 보는 페이지와 한 칸 어긋나게 읽는다.
function toDisplayPage(page: number): string {
  return String(page + 1);
}

// 계약 상한 20건. 서버 페이지 크기가 그보다 크면 화면 순서대로 자른다 —
// 순번("1번 상품")이 근거라 앞에서부터 남겨야 뜻이 맞는다.
const MAX_PRODUCTS = 20;

export function buildSellerScreenContext(
  state: SellerScreenState,
): ChatScreenContext {
  if (state.tab === "orders") {
    return {
      pageType: "seller_orders",
      filters: {
        status: ORDER_TAB_LABEL[state.orderTab],
        page: toDisplayPage(state.orderPage),
      },
    };
  }

  return {
    pageType: "seller_products",
    filters: {
      status: PRODUCT_TAB_LABEL[state.productTab],
      sort: PRODUCT_SORT_LABEL[state.productSort],
      page: toDisplayPage(state.productPage),
    },
    // 주문 탭에는 싣지 않는다 — 판매자 products 는 "수정 대상 확정용"이라
    // 상품 목록을 보고 있을 때만 의미가 있다(구매자는 담기 대상).
    ...(state.products.length
      ? { products: state.products.slice(0, MAX_PRODUCTS) }
      : {}),
  };
}

/**
 * 전송 시점의 화면 상태를 읽는 콜백을 만든다.
 *
 * ref 로 최신값을 들고 useCallback 을 고정하는 이유: useChat 이 이 콜백을 ref 에
 * 담아두므로, 매 렌더 새 함수를 주면 그때마다 갱신 이펙트가 돈다.
 * 구매자 useScreenContext 와 같은 구조다.
 */
export function useSellerScreenContext(state: SellerScreenState) {
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  return useCallback((): ChatScreenContext => {
    return buildSellerScreenContext(stateRef.current);
  }, []);
}
