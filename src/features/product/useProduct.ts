"use client";

import { useCallback, useSyncExternalStore } from "react";
import { hashKey, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SeededProductCard } from "@/shared/types/product";
import { fetchProductDetail, fetchProductReviews } from "./api";
import type { ProductDetail, ProductReviewPage, ReviewSort } from "./types";

const FIVE_MIN = 5 * 60 * 1000;

// 상품 상세 — staleTime 5분 (CLAUDE.md React Query 규칙).
// 키를 ['products', id, 'detail']로 분리한 이유: ['products', id]에는 챗봇·마이페이지 등이
// ProductCard(부분 데이터)를 시딩해두는데 상세 응답과 구조가 달라(brandName vs brand.name,
// rating: number vs rating: {average,count}) 같은 키를 쓰면 캐시가 섞여 렌더가 깨진다.
//
// initialData: 서버 컴포넌트가 SSR에서 받아온 상세를 넘긴다. 있으면 첫 렌더부터
// 완전한 화면이 나가고(검색봇·LCP), 클라이언트는 staleTime이 지난 뒤에만 재조회한다.
// 클라이언트 내비게이션으로 들어오면 undefined라 기존 동작(카드 시딩 → 조회) 그대로다.
export function useProductDetail(id: string, initialData?: ProductDetail) {
  return useQuery({
    queryKey: ["products", id, "detail"],
    queryFn: () => fetchProductDetail(id),
    // id는 문자열이다 — Number.isFinite로 판정하면 항상 false가 되어
    // 타입 에러 없이 쿼리가 영영 꺼진다(화면은 스켈레톤에서 멈춤).
    enabled: id !== "",
    staleTime: FIVE_MIN,
    initialData,
  });
}

// 상품 후기 — 상세와 함께 갱신되면 되므로 staleTime 5분.
// page/sort가 키에 들어가 페이지 전환 시 각각 캐시된다.
export function useProductReviews(
  id: string,
  params: { page?: number; size?: number; sort?: ReviewSort } = {},
) {
  const { page = 0, size = 10, sort = "latest" } = params;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["products", id, "reviews", { page, size, sort }],
    queryFn: () => fetchProductReviews(id, { page, size, sort }),
    enabled: id !== "",
    staleTime: FIVE_MIN,
  });

  // distribution은 page=0 응답에만 온다(명세). 2페이지 이상에서는 0페이지 캐시 값을 재사용해
  // 분포 막대가 빈 채로 렌더되지 않게 한다. sort는 분포에 영향이 없어 latest 키로 통일한다.
  const page0 = queryClient.getQueryData<ProductReviewPage>([
    "products",
    id,
    "reviews",
    { page: 0, size, sort: "latest" },
  ]);
  const distribution = query.data?.distribution ?? page0?.distribution;

  return { ...query, distribution };
}

// 카드 시딩 데이터 — 상세 도착 전 즉시 렌더용(캐시 승계).
// 시딩은 useGoToProduct(shared/hooks)가 setQueryData로 심으므로, 여기서는 그 값을 읽기만 한다.
// 캐시에 시딩값이 있으면 그대로 읽고, 없으면 undefined → 상세 API가 정본을 채운다.
//
// useQuery가 아니라 useQueryClient + 구독을 쓰는 이유:
// 이 쿼리는 네트워크 요청이 없어 queryFn을 줄 수 없는데, useQuery는 enabled:false여도
// queryFn 부재를 에러로 본다(시딩 없이 URL 직접 진입 시 콘솔 에러).
// "캐시를 읽고 변화를 구독한다"는 실제 의도를 그대로 표현하면 그 문제가 사라진다.
export function useSeededProductCard(id: string): {
  data: SeededProductCard | undefined;
} {
  const queryClient = useQueryClient();
  // id가 같으면 같은 참조를 유지해야 한다 — useSyncExternalStore는 subscribe가 바뀌면
  // 구독을 해제하고 다시 건다. 매 렌더 새 함수를 주면 그 일이 반복된다.
  const hash = hashKey(["products", id]);

  const subscribe = useCallback(
    (onChange: () => void) =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.query.queryHash === hash) onChange();
      }),
    [queryClient, hash],
  );

  const getSnapshot = useCallback(
    () => queryClient.getQueryData<SeededProductCard>(["products", id]),
    [queryClient, id],
  );

  return {
    // 서버 스냅샷은 undefined — 시딩은 클라이언트 내비게이션에서만 생긴다.
    data: useSyncExternalStore(subscribe, getSnapshot, () => undefined),
  };
}
