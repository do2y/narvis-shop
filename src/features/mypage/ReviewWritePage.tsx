"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import type { ProductCard } from "@/shared/types/chat";
import { ProductImage } from "@/shared/ui/ProductImage";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { cn } from "@/lib/utils";
import { reviewSchema, type ReviewValues } from "./reviewSchema";
import { useCreateReview } from "./useCreateReview";
import { StarRatingInput } from "./components/StarRatingInput";

export default function ReviewWritePage() {
  const params = useSearchParams();
  // 후기 대상은 주문 줄(orderItemId). productId는 상품 요약 표시·캐시 조회용.
  // 둘 다 Number()로 감싸지 않는다 — 64비트 id라 끝자리가 바뀐다.
  // orderItemId 는 그대로 서버로 나가고(엉뚱한 줄에 후기가 달린다),
  // productId 는 아래 ['products', productId] 캐시 조회가 조용히 빗나가 상품 요약이 안 뜬다.
  const orderItemId = params.get("orderItemId") ?? "";
  const productId = params.get("productId") ?? "";
  const router = useRouter();
  const queryClient = useQueryClient();

  // 상품 정보는 진입 시 시딩된 상세 캐시에서 읽는다(주문 카드 → setQueryData).
  const product = queryClient.getQueryData<Partial<ProductCard>>([
    "products",
    productId,
  ]);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 0, content: "" },
  });

  const { mutate, isPending, isSuccess, errorMessage } = useCreateReview();

  // 필수 파라미터 없이 직접 진입 → 주문 내역으로.
  // Next에서는 렌더 중 내비게이션이 경고를 내므로 이펙트에서 replace한다.
  // 문자열 id 라 빈 값만 걸러낸다. Number.isFinite 로 판정하면 정상 링크가
  // 전부(64비트 id는 유한수로 파싱되지 않으므로) 주문 내역으로 튕긴다.
  const missingTarget = orderItemId.length === 0;
  useEffect(() => {
    if (missingTarget) router.replace("/mypage/orders");
  }, [missingTarget, router]);

  if (missingTarget) return null;

  const onSubmit = (values: ReviewValues) => {
    // 성공 시 즉시 이동하지 않고 완료 화면(isSuccess)으로 전환 — 아래 렌더 분기.
    mutate({ orderItemId, ...values });
  };

  // 후기 등록 완료 — 피드백 화면. 반품 완료 화면과 동일 톤.
  if (isSuccess) {
    return (
      <div className="flex flex-col items-center py-10 text-center sm:py-16">
        <span className="flex size-14 items-center justify-center rounded-full bg-green-50 text-green-600">
          <Check className="size-7" />
        </span>
        <p className="mt-4 text-base font-bold">후기가 등록됐어요</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          소중한 후기 감사해요. 다른 분들의 구매에 큰 도움이 돼요.
        </p>
        <Button
          type="button"
          className="mt-6 h-11 rounded-full px-6"
          onClick={() => router.replace("/mypage/orders")}
        >
          주문 내역으로
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold">후기 작성</h2>

      {/* 대상 상품 요약 — 시딩 캐시 있으면 표시 */}
      {product && (
        <div className="mt-5 flex gap-4 rounded-sm border bg-background p-4">
          <ProductImage
            src={product.imageUrl}
            alt=""
            className="size-16 shrink-0 rounded-sm bg-muted object-cover"
          />
          <div className="flex min-w-0 flex-col justify-center gap-1">
            <p className="text-xs text-muted-foreground">{product.brandName}</p>
            <p className="truncate text-sm font-medium">{product.name}</p>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-6 flex flex-col gap-7"
        noValidate
      >
        {/* 별점 */}
        <div className="flex flex-col gap-2">
          <Label>별점</Label>
          <Controller
            control={control}
            name="rating"
            render={({ field }) => (
              <StarRatingInput value={field.value} onChange={field.onChange} />
            )}
          />
          {errors.rating && (
            <p className="text-sm text-destructive">{errors.rating.message}</p>
          )}
        </div>

        {/* 내용 */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="review-content">후기 내용 (선택)</Label>
          <textarea
            id="review-content"
            rows={6}
            placeholder="상품은 어떠셨나요? 사이즈, 소재, 배송 등 솔직한 후기를 남겨주세요."
            aria-invalid={!!errors.content}
            className={cn(
              "w-full resize-none rounded-sm border border-input bg-transparent px-3.5 py-3 text-sm outline-none transition-colors",
              "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
            )}
            {...register("content")}
          />
          {errors.content && (
            <p className="text-sm text-destructive">{errors.content.message}</p>
          )}
        </div>

        {/* 사진 첨부는 두지 않는다 — 업로드 API(백엔드)가 아직 없어서,
            첨부해도 등록 시 조용히 사라진다. 붙이는 것보다 없는 게 정직하다.
            API 가 생기면 파일 전송까지 함께 구현한다. */}

        {errorMessage && (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="h-12 flex-1 rounded-full"
          >
            취소
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="h-12 flex-1 rounded-full"
          >
            {isPending ? "등록 중…" : "후기 등록"}
          </Button>
        </div>
      </form>
    </div>
  );
}
