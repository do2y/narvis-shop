"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Heart, Star } from "lucide-react";
import { track } from "@/shared/analytics/track";
import { useWishlistToggleWithToast } from "@/shared/hooks/useWishlist";
import { useRequireLogin } from "@/shared/hooks/useRequireLogin";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/shared/ui/AppHeader";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/ui/dialog";
import { useAuthStore } from "@/shared/stores/authStore";
import type { CheckoutState } from "@/shared/types/checkout";
import {
  isStockInsufficientError,
  useAddCartItem,
} from "@/shared/hooks/useCart";
import { isPurchasable } from "@/shared/types/product";
import { setCheckoutState } from "@/shared/utils/checkoutHandoff";
import { ImageGallery } from "./components/ImageGallery";
import { PriceRow } from "./components/PriceRow";
import { OptionSelector, type OptionSelection } from "./components/OptionSelector";
import { SpecTable } from "./components/SpecTable";
import { DetailImages } from "./components/DetailImages";
import { ReviewSummary } from "./components/ReviewSummary";
import { toSpecRows } from "./utils/attributes";
import {
  useProductDetail,
  useProductReviews,
  useSeededProductCard,
} from "./useProduct";
import type { ProductDetail, ReviewSort } from "./types";

// id·initialDetail은 서버 컴포넌트(app/products/[productId]/page.tsx)가 넘긴다.
// useParams를 쓰지 않는 이유: 서버가 이미 갖고 있는 값이라 다시 읽을 필요가 없고,
// props로 받으면 이 컴포넌트가 라우트 위치에 덜 묶인다.
export default function ProductPage({
  id,
  initialDetail,
}: {
  id: string;
  initialDetail?: ProductDetail;
}) {
  const router = useRouter();
  const requireLogin = useRequireLogin();
  const {
    wished,
    isPending: wishlistPending,
    toggle: toggleWishlist,
  } = useWishlistToggleWithToast(id);

  // OptionSelector의 최신 선택값을 담아두는 ref. 렌더 유발이 필요 없어 state 대신 ref 사용.
  const selectionRef = useRef<OptionSelection>({
    option: null,
    quantity: 1,
    soldOut: false,
  });

  // 품절 여부만 state로도 복제한다 — 버튼 비활성이 렌더에 반영돼야 해서
  // ref 로는 부족하다(ref 변경은 리렌더를 일으키지 않는다).
  const [optionSoldOut, setOptionSoldOut] = useState(false);

  // 상세 API가 정본. 도착 전에는 카드 시딩 데이터(캐시 승계)로 즉시 렌더한다.
  const { data: detail, isError } = useProductDetail(id, initialDetail);
  const { data: seeded } = useSeededProductCard(id);

  const addCart = useAddCartItem();

  // 재고 부족(CART_STOCK_INSUFFICIENT)은 인라인이 아니라 다이얼로그로 알린다.
  // 서버가 합산 후 수량으로 판정하므로 프론트 수량 제한을 통과해도 발생할 수 있다.
  const [stockDialogOpen, setStockDialogOpen] = useState(false);

  // 리뷰는 정렬만 전환(페이지네이션은 계약 확정 후). 첫 페이지 10개.
  const [reviewSort, setReviewSort] = useState<ReviewSort>("latest");
  const {
    data: reviewPage,
    isLoading: reviewsLoading,
    // page>=1에서는 응답에 분포가 없어 훅이 0페이지 캐시 값을 채워준다
    distribution: reviewDistribution,
  } = useProductReviews(id, { sort: reviewSort });

  // 상세 진입 이벤트 — 서버 적재가 없어져 FE가 보낸다(E-1, 02 D31).
  // 상세 응답 도착 후 1회. 아래 조기 반환들보다 위에 둬야 훅 순서가 깨지지 않는다.
  useEffect(() => {
    if (!detail) return;
    // properties 는 계약 표에 있는 것만 싣는다 — price 필수, 선택 없음(E-1).
    track("product_view", {
      productId: detail.id,
      properties: { price: detail.price },
    });
  }, [detail]);

  // 상세·시딩 어느 쪽이든 렌더에 필요한 값만 뽑아 정규화(구조가 달라 여기서 흡수).
  const view = detail
    ? {
        name: detail.name,
        brandName: detail.brand.name,
        imageUrl: detail.imageUrl,
        price: detail.price,
        originalPrice: detail.originalPrice,
        rating: detail.rating.average,
        reviewCount: detail.rating.count,
      }
    : seeded
      ? {
          name: seeded.name,
          brandName: seeded.brandName,
          imageUrl: seeded.imageUrl,
          price: seeded.price,
          originalPrice: seeded.originalPrice,
          rating: seeded.rating,
          reviewCount: seeded.reviewCount,
        }
      : null;

  // 없는 상품(404 PRODUCT_NOT_FOUND) — 상세가 정본이므로 시딩 데이터가 있어도 안내한다.
  // (챗봇 카드로 캐시에 남은 상품이 삭제된 경우, 구매 가능한 것처럼 보이면 안 됨)
  if (isError) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 p-4 py-24 sm:p-6">
          <p className="text-sm text-muted-foreground">
            상품을 찾을 수 없어요.
          </p>
          <Button variant="outline" onClick={() => router.push("/home")}>
            홈으로
          </Button>
        </main>
      </div>
    );
  }

  // 상세 로딩 중이고 시딩 데이터도 없으면(직접 URL 진입) 스켈레톤
  if (!view) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader />
        <main className="mx-auto w-full max-w-5xl px-5 pt-6 sm:px-6 lg:pt-10">
          {/* 실제 레이아웃과 같은 grid·간격을 쓴다 — 스켈레톤이 다른 배치면
              데이터가 도착하는 순간 화면이 재배치돼 튄다. */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <div className="flex w-full max-w-lg flex-col">
              <Skeleton className="h-3 w-20 rounded-full" />
              <Skeleton className="mt-2.5 h-7 w-3/4 rounded-full" />
              <Skeleton className="mt-3 h-4 w-28 rounded-full" />
              <Skeleton className="mt-6 h-8 w-40 rounded-full" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 갤러리는 대표 이미지 단일(02 D14)이라 상세 이미지 1장만 사용.
  const images = [view.imageUrl];

  // attributes를 스펙 표 행으로 변환. 상세 도착 전에는 빈 표.
  // 값 모양이 섞여 오므로(문자열/null/배열/메타 객체) 표시 가능한 것만 남긴다.
  const specRows = toSpecRows(detail?.attributes);

  // HIDDEN·품절 상품도 200으로 조회된다(직링크·찜 목록 대응) → purchaseState로 구매 차단.
  // 상세 도착 전(시딩 렌더)에는 아직 알 수 없으므로 구매 가능으로 둔다.
  // 재고에서 직접 파생하지 않는다 — 숨김이 품절보다 우선하는 판정은 서버가 갖는다.
  const purchasable = isPurchasable(detail?.purchaseState);
  const soldOut = detail?.purchaseState === "SOLD_OUT";

  // 장바구니 담기 — 게스트도 가능(CLAUDE.md). 옵션 있는 상품은 선택 필수라
  // 서버 400(CART_OPTION_REQUIRED) 전에 프론트에서 먼저 막는다.
  const needsOption = (detail?.options.length ?? 0) > 0;
  const addToCart = () => {
    const { option, quantity, soldOut: optionOut } = selectionRef.current;
    // 상품 purchaseState 는 전 옵션이 품절일 때만 SOLD_OUT 이라, 일부 색만 품절인
    // 경우는 여기서 막지 않으면 담기 요청이 서버까지 갔다가 거절된다.
    if (!purchasable || optionOut || (needsOption && !option)) return;
    addCart.mutate(
      {
        productId: id,
        optionId: option?.optionId,
        quantity,
      },
      {
        // add_to_cart 수집은 BE CartService 로 이관됨(A 문서, 2026-08-06).
        // 재고 부족만 다이얼로그로 알린다. 그 외 에러는 하단 인라인(errorMessage).
        onError: (error) => {
          if (isStockInsufficientError(error)) setStockDialogOpen(true);
        },
      },
    );
  };

  const buyNow = () => {
    if (!purchasable || selectionRef.current.soldOut) return;
    // 구매는 로그인 필요(CLAUDE.md). 게스트면 물어보고, 가겠다고 하면 현재 상세로
    // 복귀하도록 returnUrl 을 건다.
    // (state는 리다이렉트로 유실되므로 로그인 후 상세에서 다시 "바로 구매"하게 한다.
    //  그래서 "옵션·수량은 다시 골라야 한다"를 안내 문구에 함께 담는다 — 안 그러면
    //  로그인만 하면 결제로 이어질 줄 알고 기다리게 된다.)
    // 클릭 시점 값이면 충분해 구독 없이 getState로 읽는다(렌더 중 비구독 읽기 방지).
    const { user } = useAuthStore.getState();
    if (!user) {
      requireLogin(
        `/products/${id}`,
        "구매하려면 로그인이 필요해요.",
        "로그인하면 이 상품으로 돌아와요. 선택한 옵션과 수량은 다시 골라주세요.",
      );
      return;
    }
    const { option, quantity } = selectionRef.current;
    const state: CheckoutState = {
      items: [
        {
          product: {
            productId: id,
            name: view.name,
            brandName: view.brandName,
            // 옵션 추가금이 있으면 단가에 반영(주문 시 스냅샷되는 값과 일치시킴)
            price: view.price + (option?.extraPrice ?? 0),
            originalPrice: view.originalPrice,
            imageUrl: view.imageUrl,
          },
          // 주문 생성 시 items[]로 보낼 옵션 식별자(표시용 optionName과 별개)
          optionId: option?.optionId ?? null,
          optionName: option?.name ?? null,
          quantity,
        },
      ],
    };
    // Next의 router.push에는 state가 없어 sessionStorage를 경유한다(계획서 3장 스니펫).
    setCheckoutState(state);
    router.push("/checkout");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      {/* 모든 섹션이 같은 max-w 와 좌우 padding 을 공유한다 — 종전에는 상단 영역과
          아래 섹션의 정렬선이 미묘하게 달라 한 페이지로 안 읽혔다.
          px-5(20px): 모바일 좌우 여백 통일. */}
      <main className="mx-auto flex w-full max-w-5xl flex-col px-5 pb-24 sm:px-6">
        {/* 상단: 갤러리 | 정보·옵션.
            lg:grid-cols-2 로 정확히 반씩 나눈다(종전 w-1/2 + flex-1 은 gap 만큼
            오른쪽이 좁았다). gap-12(48px)~gap-16(64px) 범위.

            items-start: 두 열의 상단 기준선을 맞추면서, 짧은 쪽(정보)이 긴 쪽
            높이까지 늘어나지 않게 한다. stretch(기본)로 두면 정보 열이 이미지
            높이만큼 늘어나 CTA 아래로 200px 가까운 빈 공간이 생긴다. */}
        <div className="grid grid-cols-1 items-start gap-8 pt-6 lg:grid-cols-2 lg:gap-16 lg:pt-10">
          <div>
            <ImageGallery images={images} alt={view.name} />
          </div>

          {/* max-w-lg: 넓은 화면에서 구매 정보가 옆으로 벌어지면 라벨과 값이
              멀어져 한 덩어리로 안 읽힌다. 열 안에서 폭을 제한한다. */}
          <div className="flex w-full max-w-lg flex-col">
            {/* 브랜드 → 상품명 → 평점 : 가장 작은 보조 정보에서 시작해 이름으로 올라간다 */}
            {/* brand.id는 상세 응답에만 있다 — 시딩만으로 렌더 중이면 이동할 곳을 몰라 텍스트로 둔다 */}
            {detail ? (
              <Link
                href={`/brands/${detail.brand.id}`}
                className="w-fit text-xs font-medium tracking-[0.02em] text-muted-foreground uppercase underline-offset-4 transition-colors duration-150 ease-out-strong hover:text-foreground hover:underline"
              >
                {view.brandName}
              </Link>
            ) : (
              <p className="w-fit text-xs font-medium tracking-[0.02em] text-muted-foreground uppercase">
                {view.brandName}
              </p>
            )}

            {/* 상품명 — 상단에서 가장 강한 텍스트. 과하게 크지 않게 22~26px 선에서
                멈추고, 굵기는 semibold(bold 아님). leading-snug + max-w-md 로
                두 줄이 되어도 줄 길이가 안정적이다. tracking 은 음수(§15). */}
            <h1 className="mt-2.5 max-w-md text-[1.375rem] font-semibold leading-snug tracking-[-0.02em] sm:text-2xl">
              {view.name}
            </h1>

            {/* 평점 — 리뷰가 없으면 노란 별과 0.0 을 강하게 띄우지 않는다.
                "0.0점짜리 상품"으로 오해되기 때문. 중립 문구 한 줄로 낮춘다. */}
            {view.reviewCount > 0 ? (
              <div className="mt-3 flex items-center gap-1.5 text-sm">
                <Star aria-hidden className="size-3.5 fill-yellow-400 text-yellow-400" />
                <span className="font-medium tabular-nums">
                  {view.rating.toFixed(1)}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  리뷰 {view.reviewCount.toLocaleString("ko-KR")}개
                </span>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                등록된 리뷰가 없어요
              </p>
            )}

            {/* 가격 — 상품명과 충분히 띄워 별도 핵심 정보로 인식되게 한다.
                divider 로 위쪽 소개 블록과 아래 선택 블록을 가른다. */}
            <PriceRow
              price={view.price}
              originalPrice={view.originalPrice}
              className="mt-6"
            />

            <div className="mt-7 border-t pt-7">
              <OptionSelector
                // 상세 도착 전에는 옵션 목록을 알 수 없어 수량만 노출
                options={detail?.options ?? []}
                basePrice={view.price}
                // 재고 상한 — 상세 도착 전에는 undefined(제한 없음). 서버가 합산 후 최종 판정.
                maxQuantity={detail?.stockQuantity}
                onChange={(sel) => {
                  selectionRef.current = sel;
                  setOptionSoldOut(sel.soldOut);
                }}
              />
            </div>

            {/* 액션 — 찜 | 장바구니 | 바로 구매.
                셋 다 h-12 로 높이를 맞추고 간격은 gap-2.5(10px).
                너비 관계: 찜은 정사각 고정, 장바구니:바로구매 = 1:1.4 로 두어
                주 CTA 가 눈에 띄되 장바구니가 옹색해지지 않게 한다.
                radius 는 rounded-lg(10px) — 알약(rounded-full)은 이 크기에서
                과하게 둥글어 아래 정보 목록의 각진 리듬과 어긋난다. */}
            <div className="mt-7 flex items-stretch gap-2.5">
              <button
                type="button"
                aria-label={wished ? "찜 해제" : "찜하기"}
                aria-pressed={wished}
                // view 는 상세·시딩을 정규화한 값이라 seed 필드와 그대로 맞는다.
                onClick={() =>
                  toggleWishlist({
                    ...view,
                    purchaseState: detail?.purchaseState ?? "AVAILABLE",
                  })
                }
                disabled={wishlistPending}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border transition-colors duration-150 ease-out-strong hover:bg-muted disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {/* stroke 굵기를 다른 아이콘과 맞춘다(lucide 기본 2 → 1.75).
                    size-5 로 수량 스테퍼 아이콘보다 한 단계만 크게. */}
                <Heart
                  strokeWidth={1.75}
                  className={cn(
                    "size-5 transition-colors duration-150 ease-out-strong",
                    wished ? "fill-red-500 text-red-500" : "text-foreground",
                  )}
                />
              </button>
              <Button
                variant="outline"
                className="h-12 flex-1 rounded-lg text-sm"
                onClick={addToCart}
                disabled={addCart.isPending || !purchasable || optionSoldOut}
              >
                {addCart.isPending ? "담는 중…" : "장바구니"}
              </Button>
              {/* primary — 헤더 "시작하기"와 같은 dark 계열(bg-primary). */}
              <Button
                className="h-12 flex-[1.4] rounded-lg text-sm"
                onClick={buyNow}
                disabled={!purchasable || optionSoldOut}
              >
                바로 구매
              </Button>
            </div>

            {/* 구매 불가 사유 — 버튼만 비활성이면 이유를 알 수 없어 함께 안내.
                품절과 판매중지(HIDDEN 등)를 구분해 문구를 다르게 준다. */}
            {!purchasable && (
              <p className="mt-4 text-sm text-muted-foreground" role="status">
                {soldOut
                  ? "품절된 상품이에요. 재입고 시 다시 구매할 수 있어요."
                  : "현재 판매하지 않는 상품이에요."}
              </p>
            )}

            {/* 담기 성공 안내는 useAddCartItem 의 토스트가 맡는다(다른 호출부와 동일).
                여기서는 토스트에 담을 수 없는 다음 행동(장바구니로 이동)만 남긴다 —
                문구까지 함께 그리면 같은 말이 토스트와 인라인으로 두 번 나간다. */}
            {addCart.isSuccess && (
              <p className="mt-4 text-sm text-muted-foreground" role="status">
                <button
                  type="button"
                  onClick={() => router.push("/cart")}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  장바구니 보기
                </button>
              </p>
            )}
            {/* 담기 실패는 useAddCartItem 이 토스트로 알린다(재고 부족만 예외로
                아래 다이얼로그). 여기서 또 그리면 같은 말이 두 번 나간다. */}
          </div>
        </div>

        {/* 상단 영역과 아래 섹션 사이 — 옅은 divider 하나로 가른다.
            간격을 mt/pt 로 나눠 잡는다(한쪽에 몰지 않는다): divider 는 두 영역의
            중간에 있어야 어느 쪽에도 붙지 않는다.

            상단 영역은 두 열의 높이가 달라(이미지가 구매 정보보다 100px 남짓 길다)
            divider 가 긴 쪽 기준으로 내려간다 — 짧은 CTA 쪽에서 보면 그만큼 더
            떨어져 보인다. 그래서 여기 값을 크게 잡지 않는다. */}
        <div className="mt-12 border-t pt-12 sm:mt-14 sm:pt-14">
          {/* 섹션 간격 규칙: 56px(sm 이상 64px). 종전에는 gap-14 하나로 상단
              영역까지 묶여 있어 상단만 유독 붙어 보였다. */}
          <div className="flex flex-col gap-14 sm:gap-16">
            {specRows.length > 0 && <SpecTable rows={specRows} />}

            {/* 상세 설명 이미지 — 상세 응답에만 있다(시딩 카드에는 없음).
                빈 배열이면 제목만 남으므로 length로 판정한다. */}
            {detail?.detailImages && detail.detailImages.length > 0 && (
              <DetailImages images={detail.detailImages} alt={view.name} />
            )}

            <ReviewSummary
              average={view.rating}
              // 총 개수·분포는 리뷰 API 집계를 우선 사용(상세의 rating.count와 동일 소스)
              total={reviewPage?.totalElements ?? view.reviewCount}
              distribution={
                reviewDistribution ?? { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 }
              }
              reviews={reviewPage?.content ?? []}
              sort={reviewSort}
              onSortChange={setReviewSort}
              isLoading={reviewsLoading}
            />

            {/* 브랜드 — 큰 카드에서 한 줄로 낮춘다.
                브랜드 정보가 이름뿐이라(상세 응답의 brand 는 id·name·logoUrl)
                카드로 키우면 채울 것이 없어 빈 공간만 남는다. 정보량에 맞는
                그릇을 쓴다(§16). 위쪽 divider 로 리뷰와 구분만 한다. */}
            {detail ? (
              <Link
                href={`/brands/${detail.brand.id}`}
                className="group flex items-center gap-3 border-t py-5 transition-colors duration-150 ease-out-strong hover:bg-muted/40"
              >
                <BrandMark name={view.brandName} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {view.brandName}
                </span>
                <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground transition-colors duration-150 ease-out-strong group-hover:text-foreground">
                  브랜드 홈
                  {/* 화살표가 hover 에 1px 만 움직인다 — 방향만 알리고 소란스럽지 않게 */}
                  <ChevronRight
                    aria-hidden
                    className="size-3.5 transition-transform duration-150 ease-out-strong group-hover:translate-x-px"
                  />
                </span>
              </Link>
            ) : (
              <div className="flex items-center gap-3 border-t py-5">
                <BrandMark name={view.brandName} />
                <p className="text-sm font-medium">{view.brandName}</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 재고 부족 안내 — 남은 재고 수량은 응답에 담기지 않을 수 있어 알리지 않는다. */}
      <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col gap-2">
            <DialogTitle>재고가 부족해요</DialogTitle>
            <DialogDescription>
              선택하신 수량만큼 담을 재고가 부족해요. 수량을 줄여서 다시
              시도해주세요.
            </DialogDescription>
          </div>
          <div className="mt-6 flex justify-end">
            <Button
              variant="outline"
              className="h-11 rounded-lg px-5"
              onClick={() => setStockDialogOpen(false)}
            >
              확인
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * 브랜드 머리글자 마크.
 *
 * 상세 응답의 brand 에 logoUrl 이 있지만 비어 오는 브랜드가 많아, 이름 첫 글자로
 * 대신한다. 검정 면(bg-primary)으로 채우면 한 줄짜리 브랜드 행에서 이 원이 가장
 * 강한 요소가 되어 브랜드명보다 먼저 읽힌다 — 테두리와 옅은 바탕으로 낮춘다.
 *
 * 글자·숫자가 아닌 문자는 건너뛴다. 브랜드명이 "(BD-2959)" 처럼 오는 상품이
 * 실제로 있어(상품 838), 그냥 첫 글자를 쓰면 원 안에 "(" 만 덩그러니 남아
 * 고장난 것처럼 보인다.
 */
function BrandMark({ name }: { name: string }) {
  // \p{L}\p{N} + u 플래그: 한글·영문·숫자를 한 번에 다룬다(한글은 \w 에 안 걸린다).
  const initial = [...name].find((ch) => /[\p{L}\p{N}]/u.test(ch)) ?? "·";

  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted/40 text-xs font-semibold text-muted-foreground"
    >
      {initial}
    </span>
  );
}
