"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ChatScreenContext, ChatResult } from "@/shared/types/chat";

/**
 * 상품 패널 그리드의 열 수 — ProductPanel 의 GRID 클래스와 반드시 함께 바뀐다.
 * (grid-cols-1 / sm:grid-cols-2 / xl:grid-cols-3, Tailwind 기본 브레이크포인트)
 *
 * 서버는 창 크기를 알 수 없어 FE 가 전송 시점의 값을 실어야 "3번째 줄 2번째"
 * 같은 좌표 지시가 풀린다 — index = (row-1) × columns + (col-1) (계약 CH-2).
 */
function currentColumns(): number {
  if (typeof window === "undefined") return 1;
  if (window.matchMedia("(min-width: 1280px)").matches) return 3;
  if (window.matchMedia("(min-width: 640px)").matches) return 2;
  return 1;
}

/** 상한 — 초과분은 화면 순서대로 자른다(계약: screen_products_max 기본 20) */
const MAX_PRODUCTS = 20;

/**
 * 구매자 챗의 화면 맥락(CH-2 §screen)을 전송 시점에 만든다.
 *
 * 우측 패널을 보며 "이거 담아줘"라고 하는 지시어는 발화만으로 확정할 수 없다 —
 * 무엇이 어떻게 보이고 있었는지는 FE 만 아는 사실이다.
 *
 * **인기상품 패널만 products 에 싣는다.** 기준은 "화면에 보이나"가 아니라
 * "서버가 이미 아나"다 — 추천 카드(CH-5)는 서버가 listId 로 알고 있고,
 * 되돌려주면 위조 경로가 된다(FE 가 보낸 목록을 신뢰하지 않는 원칙).
 *
 * 값이 아니라 함수를 넘기는 이유: 사용자가 대화하는 동안 패널이 바뀌므로
 * 훅 초기화 시점이 아니라 매 전송 시점의 화면을 실어야 한다.
 */
export function useScreenContext(results: ChatResult[]) {
  // 최신 결과를 전송 시점에 읽는다 — 값을 deps 에 넣으면 패널이 바뀔 때마다
  // 콜백이 재생성돼 useChat 의 send 까지 흔들린다.
  const resultsRef = useRef(results);
  useEffect(() => {
    resultsRef.current = results;
  });

  return useCallback((): ChatScreenContext | undefined => {
    const groups = resultsRef.current.flatMap((r) =>
      r.kind === "products" ? r.groups : [],
    );

    // 추천 목록에서 온 묶음은 서버가 이미 안다 — 인기상품 묶음만 남긴다.
    // (recommendationContext 유무가 그 판별자다)
    const popular = groups.filter(
      (g) => !g.items.some((item) => item.recommendationContext),
    );
    const products = popular
      .flatMap((g) => g.items)
      .slice(0, MAX_PRODUCTS)
      .map((item) => ({ productId: item.productId, name: item.name }));

    // 패널이 비었거나 추천 카드뿐이면 화면 사실을 실을 게 없다.
    // pageType 만 보내도 되지만 정보가 0이라(항상 "chat") 생략한다.
    if (!products.length) return undefined;

    return {
      pageType: "chat",
      products,
      columns: currentColumns(),
    };
  }, []);
}
