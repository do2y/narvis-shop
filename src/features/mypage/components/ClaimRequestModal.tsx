"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

import { Check } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import {
  claimRequestSchema,
  type ClaimRequestFormInput,
  type ClaimRequestFormValues,
} from "../claimSchema";
import { useCreateClaim } from "../useClaims";
import { canClaimItem, type ClaimType, type Order } from "../types";

// 사유는 종류마다 다르다 — 취소는 배송 전이라 상품을 받아보지 못한 상태고,
// 반품은 받아본 뒤라 파손·오배송 같은 사유가 성립한다.
const REASONS: Record<ClaimType, string[]> = {
  CANCEL: [
    "단순 변심",
    "다른 상품으로 다시 주문할래요",
    "주문 실수(수량·옵션)예요",
    "배송이 너무 늦어요",
  ],
  RETURN: [
    "단순 변심",
    "사이즈·색상이 기대와 달라요",
    "상품이 파손·불량이에요",
    "다른 상품이 배송됐어요",
    "배송이 너무 늦어요",
  ],
};

// 문구도 종류마다 갈린다. 한 곳에 모아 화면·모달이 같은 말을 쓰게 한다.
const COPY: Record<ClaimType, { title: string; done: string }> = {
  CANCEL: { title: "주문 취소", done: "주문 취소가 접수됐어요" },
  RETURN: { title: "반품 신청", done: "반품 신청이 접수됐어요" },
};

export function ClaimRequestModal({
  open,
  onOpenChange,
  order,
  type,
  orderItemId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 목록의 Order 와 상세의 OrderDetail 이 함께 쓴다 — 필요한 건 items 뿐이다 */
  order: Pick<Order, "items">;
  /** 취소(배송 전) | 반품(배송 후) — 사유 목록·문구·전송 body 가 갈린다 */
  type: ClaimType;
  /**
   * 신청 대상 아이템. 상품 단위로 신청하므로 호출부가 지정한다.
   * 없으면 신청 가능한 첫 아이템으로 시작한다(주문 카드에서 연 경우).
   */
  orderItemId?: number;
}) {
  const router = useRouter();
  const {
    mutate,
    isPending,
    isSuccess,
    isError,
    errorMessage,
    reset: resetMutation,
  } = useCreateClaim();

  // 신청 대상은 이 종류로 신청 가능한 아이템뿐이다 — 한 주문에 배송중과 배송완료가
  // 섞이면 전체를 다 보여줄 경우 서버가 거부할 줄까지 고르게 된다.
  const targets = order.items.filter((item) => canClaimItem(item.status, type));
  const initialId =
    orderItemId ?? targets[0]?.orderItemId ?? order.items[0]?.orderItemId;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClaimRequestFormInput, unknown, ClaimRequestFormValues>({
    // 폼 필드는 문자열(input) → coerce 후 orderItemId: number(output)로 검증.
    // 3번째 제네릭(output)으로 handleSubmit 콜백이 변환된 값을 받게 한다.
    resolver: zodResolver(claimRequestSchema),
    defaultValues: { orderItemId: initialId, reason: "", detail: "" },
  });

  // 열릴 때마다 폼·뮤테이션 상태 초기화 (대상 재지정, 사유 비움, 완료 화면 해제).
  useEffect(() => {
    if (!open) return;
    resetMutation();
    reset({ orderItemId: initialId, reason: "", detail: "" });
  }, [open, initialId, reset, resetMutation]);

  // zodResolver가 input→output 변환을 마친 값을 넘겨준다(orderItemId: number).
  const submit = (values: ClaimRequestFormValues) => {
    // API body는 type·reason만 받는다. 상세 설명은 별도 필드가 없어 사유에 덧붙인다.
    const reason = values.detail
      ? `${values.reason} - ${values.detail}`
      : values.reason;
    mutate({ orderItemId: values.orderItemId, body: { type, reason } });
    // 성공 시 모달을 닫지 않고 완료 화면(isSuccess)으로 전환 — 아래 렌더 분기.
  };

  // 대상이 하나면 고를 게 없다 — 호출부가 아이템을 지정했거나 신청 가능한 줄이 하나뿐인 경우.
  const fixed = orderItemId !== undefined || targets.length <= 1;
  const fixedItem =
    order.items.find((i) => i.orderItemId === initialId) ?? order.items[0];
  const copy = COPY[type];

  // 신청 접수 완료 — 피드백 화면. '내역 보기'로 이동하거나 닫기.
  if (isSuccess) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle className="sr-only">{copy.title} 완료</DialogTitle>
          <div className="flex flex-col items-center py-4 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-green-50 text-green-600">
              <Check className="size-7" />
            </span>
            <p className="mt-4 text-base font-bold">{copy.done}</p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              처리 현황은 취소·반품 내역에서 확인할 수 있어요.
            </p>
            <div className="mt-6 flex w-full gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 rounded-sm"
                onClick={() => onOpenChange(false)}
              >
                닫기
              </Button>
              <Button
                type="button"
                className="h-11 flex-1 rounded-sm"
                onClick={() => {
                  onOpenChange(false);
                  router.push("/mypage/claims");
                }}
              >
                내역 보기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{copy.title}</DialogTitle>

        <form
          onSubmit={handleSubmit(submit)}
          className="mt-5 flex flex-col gap-4"
          noValidate
        >
          {/* 대상 상품 — 단일 상품이면 표시만, 여러 개면 선택 */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="claim-product">신청 상품</Label>
            {fixed ? (
              <>
                <p className="rounded-sm border bg-muted/40 px-4 py-3 text-sm">
                  {fixedItem?.productName}
                  {fixedItem?.optionName ? ` (${fixedItem.optionName})` : ""}
                </p>
                <input
                  type="hidden"
                  {...register("orderItemId")}
                  value={initialId}
                />
              </>
            ) : (
              <select
                id="claim-product"
                aria-invalid={!!errors.orderItemId}
                className={cn(
                  "h-11 rounded-sm border bg-background px-3 text-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
                {...register("orderItemId")}
              >
                {/* 옵션이 다르면 같은 상품도 별개 줄이므로 옵션명을 함께 보여준다 */}
                {targets.map((item) => (
                  <option key={item.orderItemId} value={item.orderItemId}>
                    {item.productName}
                    {item.optionName ? ` (${item.optionName})` : ""}
                  </option>
                ))}
              </select>
            )}
            {errors.orderItemId && (
              <p className="text-sm text-destructive">
                {errors.orderItemId.message}
              </p>
            )}
          </div>

          {/* 사유 */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="claim-reason">사유</Label>
            <select
              id="claim-reason"
              aria-invalid={!!errors.reason}
              defaultValue=""
              className={cn(
                "h-11 rounded-sm border bg-background px-3 text-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              {...register("reason")}
            >
              <option value="" disabled>
                사유를 선택해주세요
              </option>
              {REASONS[type].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {errors.reason && (
              <p className="text-sm text-destructive">{errors.reason.message}</p>
            )}
          </div>

          {/* 상세 설명 (선택) */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="claim-detail">상세 설명 (선택)</Label>
            <textarea
              id="claim-detail"
              rows={3}
              placeholder="자세한 사유를 남겨주시면 처리에 도움이 돼요."
              aria-invalid={!!errors.detail}
              className={cn(
                "resize-none rounded-sm border bg-background px-3 py-2.5 text-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              {...register("detail")}
            />
            {errors.detail && (
              <p className="text-sm text-destructive">{errors.detail.message}</p>
            )}
          </div>

          {/* 실패 안내 — 자동 재시도 없이 제출 버튼으로 재시도.
              거부 사유(배송중 취소 불가·중복 접수 등)를 서버 코드로 구분해 보여준다. */}
          {isError && !isSuccess && errorMessage && (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="mt-2 flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-sm"
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="h-11 flex-1 rounded-sm"
            >
              {isPending ? "신청 중…" : "신청하기"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
