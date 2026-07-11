import { useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Heart, Star } from "lucide-react";
import { AppHeader } from "@/shared/ui/AppHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/shared/stores/authStore";
import type { ProductCard } from "@/shared/types/chat";
import type { CheckoutState } from "@/pages/checkout/types";
import { ImageGallery } from "./components/ImageGallery";
import { OptionSelector, type OptionSelection } from "./components/OptionSelector";
import { SpecTable } from "./components/SpecTable";
import { ReviewSummary } from "./components/ReviewSummary";
import { RecommendRow } from "./components/RecommendRow";
import { PLACEHOLDER_DETAIL } from "./placeholder";

function formatPrice(v: number): string {
  return `${v.toLocaleString("ko-KR")}원`;
}

export default function ProductPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const id = Number(productId);

  // OptionSelector의 최신 선택값을 담아두는 ref. 렌더 유발이 필요 없어 state 대신 ref 사용.
  const selectionRef = useRef<OptionSelection>({ options: {}, quantity: 1 });

  // 캐시 승계: 챗봇/홈 카드에서 setQueryData(['products', id])로 시딩한 데이터를 즉시 사용.
  // 상세 API가 붙기 전까지는 시딩 데이터(부분)만 렌더. queryFn 미지정이라 재조회는 하지 않음.
  const { data: product } = useQuery<ProductCard>({
    queryKey: ["products", id],
    enabled: Number.isFinite(id),
    staleTime: 5 * 60 * 1000,
  });

  // 시딩 데이터가 없으면(직접 URL 진입 등) 상세 API 붙기 전까지는 스켈레톤
  if (!product) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader />
        <main className="mx-auto w-full max-w-5xl p-4 sm:p-6">
          <div className="flex flex-col gap-8 lg:flex-row">
            <Skeleton className="aspect-square w-full rounded-xl lg:w-1/2" />
            <div className="flex flex-1 flex-col gap-3">
              <Skeleton className="h-4 w-1/4 rounded-full" />
              <Skeleton className="h-7 w-3/4 rounded-full" />
              <Skeleton className="h-6 w-1/3 rounded-full" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  const hasDiscount = product.originalPrice > product.price;
  const discountRate = hasDiscount
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;

  // 계약 전 플레이스홀더 — 갤러리/옵션/스펙/리뷰/추천은 상세 API 확정 후 실데이터로 교체.
  // 시딩 카드에 있는 값(가격·평점·리뷰수 등)은 product를 그대로 사용.
  const d = PLACEHOLDER_DETAIL;
  const images = [product.imageUrl, ...d.images];

  const user = useAuthStore.getState().user;

  const buyNow = () => {
    // 구매는 로그인 필요(CLAUDE.md). 게스트면 현재 상세로 복귀하도록 returnUrl 걸어 로그인 유도.
    // (state는 리다이렉트로 유실되므로 로그인 후 상세에서 다시 "바로 구매"하게 한다.)
    if (!user) {
      const returnUrl = encodeURIComponent(`/products/${id}`);
      navigate(`/login?returnUrl=${returnUrl}`);
      return;
    }
    const { options, quantity } = selectionRef.current;
    const state: CheckoutState = {
      items: [
        {
          product: {
            productId: product.productId,
            name: product.name,
            brandName: product.brandName,
            price: product.price,
            originalPrice: product.originalPrice,
            imageUrl: product.imageUrl,
          },
          options,
          quantity,
        },
      ],
    };
    navigate("/checkout", { state });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-14 p-4 pb-20 sm:p-6">
        {/* 상단: 갤러리 | 정보·옵션 */}
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="lg:w-1/2">
            <ImageGallery images={images} alt={product.name} />
          </div>

          <div className="flex flex-1 flex-col gap-6">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-muted-foreground">
                {product.brandName}
              </p>
              <h1 className="text-xl font-bold leading-snug sm:text-2xl">
                {product.name}
              </h1>
              <div className="flex items-center gap-1.5 text-sm">
                <Star className="size-4 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">{product.rating.toFixed(1)}</span>
                <span className="text-muted-foreground">
                  ({product.reviewCount.toLocaleString("ko-KR")}개 리뷰)
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-2.5">
              <span className="text-2xl font-bold">
                {formatPrice(product.price)}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-base text-muted-foreground line-through">
                    {formatPrice(product.originalPrice)}
                  </span>
                  <span className="text-base font-bold text-red-500">
                    {discountRate}%
                  </span>
                </>
              )}
            </div>

            <OptionSelector
              options={d.options}
              onChange={(sel) => {
                selectionRef.current = sel;
              }}
            />

            {/* 액션 — 찜/장바구니/바로구매. TODO: 찜·장바구니 API·훅 연결 */}
            <div className="mt-2 flex items-center gap-3">
              <Button variant="outline" size="icon" aria-label="찜하기" className="size-11 shrink-0">
                <Heart className="size-5" />
              </Button>
              <Button variant="outline" className="h-11 flex-1">
                장바구니
              </Button>
              <Button className="h-11 flex-1" onClick={buyNow}>
                바로 구매
              </Button>
            </div>
          </div>
        </div>

        <SpecTable rows={d.specs} />

        <ReviewSummary
          average={product.rating}
          total={product.reviewCount}
          distribution={d.reviewDistribution}
          reviews={d.reviews}
        />

        <RecommendRow
          title="함께 구매하면 좋아요"
          description="이 상품을 구매한 분들이 함께 구매한 아이템이에요."
          items={d.frequentlyBought}
        />

        <RecommendRow
          title="Jarvis 추천 대체 상품"
          description="비슷한 조건에서 다른 선택지를 찾고 계신다면요."
          items={d.alternatives}
          variant="reason"
        />

        {/* 브랜드 배너 */}
        <section className="flex items-center justify-between rounded-xl border bg-muted/30 p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {product.brandName.slice(0, 1)}
            </span>
            <div className="flex flex-col">
              <p className="text-sm font-bold">{product.brandName}</p>
              <p className="text-xs text-muted-foreground">
                컨템포러리 패션 브랜드
              </p>
            </div>
          </div>
          <Button variant="ghost" className="h-9">
            브랜드 홈
          </Button>
        </section>
      </main>
    </div>
  );
}
