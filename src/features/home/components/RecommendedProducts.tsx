"use client";

import { Skeleton } from "@/shared/ui/skeleton";
import { useAuthStore } from "@/shared/stores/authStore";
import { track } from "@/shared/analytics/track";
import { useVisibleOnce } from "@/shared/analytics/useVisibleOnce";
import type { EventRecommendation } from "@/shared/analytics/types";
import { useRecommendedProducts } from "../useHomeData";
import type { RecommendationResult } from "../types";
import { ProductCard } from "./ProductCard";
import { SectionHeading } from "./SectionHeading";

/**
 * 개인화 추천 섹션 — 로그인 사용자에게만, 그리고 `source=PERSONALIZED`일 때만 노출.
 *
 * NOT_PERSONALIZED(신규 회원·후보 부족·AI 장애로 서버가 인기상품으로 대체한 응답)면
 * 섹션 자체를 그리지 않는다(2026-08-07 개정). 구 규정은 "제목과 reason만 숨김"이었지만
 * 그건 홈에 추천 슬롯이 하나뿐이라는 전제였다 — 이 화면엔 PopularProducts가 따로 있고
 * 그건 P-4를 직접 부르므로, 대체분을 여기 그리면 같은 상품이 화면에 두 번 나온다.
 */
export function RecommendedProducts() {
  const nickname = useAuthStore((s) => s.user?.nickname);
  const { data, isError, fetchStatus, isPending } = useRecommendedProducts();

  // 게스트는 섹션 자체가 없음(훅도 enabled:false로 호출되지 않음)
  if (!nickname) return null;

  // enabled:false 면 isPending 이 true 로 남는다 — isLoading 만 보면 스켈레톤이
  // 영원히 걸린다. 실제로 요청이 도는 중일 때만 로딩으로 친다.
  const isLoading = isPending && fetchStatus === "fetching";

  // 요청이 아직 꺼져 있으면(세션 복원 중 — isAuthReady 대기) 섹션을 렌더하지 않는다.
  // 여기서 스켈레톤을 띄우면 비로그인 확정 시 사라져 레이아웃이 흔들린다.
  if (isPending && fetchStatus === "idle") return null;

  if (isLoading) return <RecommendedSkeleton nickname={nickname} />;

  // 추천 실패 화면은 만들지 않는다 — P-5가 5xx를 내는 건 Spring 자체 장애뿐이고,
  // 그 경우 사용자는 아래 인기상품을 그대로 볼 수 있다. 빈 자리를 남기지 않는다.
  if (isError || !data) return null;

  // 개인화가 아니면(=인기상품 대체분) 그리지 않는다 — 아래 PopularProducts와 중복된다
  if (data.source !== "PERSONALIZED" || !data.items.length) return null;

  return <RecommendedSection nickname={nickname} data={data} />;
}

/**
 * 별도 컴포넌트로 뺀 이유: 위 함수는 데이터가 없는 경로에서 일찍 return 하므로
 * 노출 관찰 훅을 그 자리에서 호출할 수 없다(훅 순서가 깨진다).
 */
function RecommendedSection({
  nickname,
  data,
}: {
  nickname: string;
  data: RecommendationResult;
}) {
  // 상관키 2종. E-1이 지면·순위를 이 listId로 역조회하므로 FE는 그대로 실어 보내기만 한다.
  const rec: EventRecommendation = {
    recommendationRequestId: data.recommendationRequestId,
    listId: data.listId,
  };

  // 추천 퍼널 2단 — "생성됐는데 노출은 안 됐다"(스크롤 아래 위치 문제)를 잡는다.
  const sectionRef = useVisibleOnce<HTMLElement>(
    () => track("recommendation_impression", { recommendation: rec }),
    data.listId,
  );

  return (
    <section ref={sectionRef} className="px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="AI 추천" title={`${nickname}님을 위한 추천`} />

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {data.items.map((product) => (
            <ProductCard
              key={product.productId}
              product={product}
              recommendation={rec}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// 로딩 중에는 source를 모른다 — 개인화가 아니면 섹션이 통째로 사라지므로
// 제목까지 스켈레톤으로 두면 레이아웃이 덜 흔들린다.
function RecommendedSkeleton({ nickname }: { nickname: string }) {
  return (
    <section className="px-6 py-16" aria-busy="true">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="AI 추천" title={`${nickname}님을 위한 추천`} />

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="aspect-[4/3] rounded-sm" />
              <Skeleton className="h-4 w-3/4 rounded-full" />
              <Skeleton className="h-4 w-1/2 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
