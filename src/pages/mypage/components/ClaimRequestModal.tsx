import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { claimRequestSchema, type ClaimRequestFormValues } from "../claimSchema";
import { useCreateClaim } from "../useClaims";
import type { ClaimType, Order } from "../types";

// 신청 종류별 제목·사유 목록. RETURN=반품(환불), EXCHANGE=교환.
const TYPE_META: Record<
  Extract<ClaimType, "RETURN" | "EXCHANGE">,
  { title: string; reasons: string[] }
> = {
  RETURN: {
    title: "반품 신청",
    reasons: [
      "단순 변심",
      "사이즈·색상이 기대와 달라요",
      "상품이 파손·불량이에요",
      "다른 상품이 배송됐어요",
      "배송이 너무 늦어요",
    ],
  },
  EXCHANGE: {
    title: "교환 신청",
    reasons: [
      "사이즈를 변경하고 싶어요",
      "색상을 변경하고 싶어요",
      "상품이 파손·불량이에요",
      "다른 상품이 배송됐어요",
    ],
  },
};

export function ClaimRequestModal({
  open,
  onOpenChange,
  order,
  type,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  type: Extract<ClaimType, "RETURN" | "EXCHANGE">;
}) {
  const meta = TYPE_META[type];
  const { mutate, isPending, isSuccess, isError, reset: resetMutation } =
    useCreateClaim();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClaimRequestFormValues>({
    resolver: zodResolver(claimRequestSchema),
    defaultValues: { productId: order.items[0]?.productId, reason: "", detail: "" },
  });

  // 열릴 때마다 폼·뮤테이션 상태 초기화 (첫 상품 선택, 사유 비움).
  useEffect(() => {
    if (!open) return;
    resetMutation();
    reset({ productId: order.items[0]?.productId, reason: "", detail: "" });
  }, [open, order, reset, resetMutation]);

  const submit = (values: ClaimRequestFormValues) => {
    mutate(
      {
        orderId: order.orderId,
        productId: values.productId,
        type,
        reason: values.reason,
        detail: values.detail || undefined,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const single = order.items.length === 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{meta.title}</DialogTitle>

        <form
          onSubmit={handleSubmit(submit)}
          className="mt-5 flex flex-col gap-4"
          noValidate
        >
          {/* 대상 상품 — 단일 상품이면 표시만, 여러 개면 선택 */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="claim-product">신청 상품</Label>
            {single ? (
              <>
                <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm">
                  {order.items[0].name}
                </p>
                <input
                  type="hidden"
                  {...register("productId")}
                  value={order.items[0].productId}
                />
              </>
            ) : (
              <select
                id="claim-product"
                aria-invalid={!!errors.productId}
                className={cn(
                  "h-11 rounded-xl border bg-background px-3 text-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
                {...register("productId")}
              >
                {order.items.map((item) => (
                  <option key={item.productId} value={item.productId}>
                    {item.name}
                  </option>
                ))}
              </select>
            )}
            {errors.productId && (
              <p className="text-sm text-destructive">
                {errors.productId.message}
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
                "h-11 rounded-xl border bg-background px-3 text-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              {...register("reason")}
            >
              <option value="" disabled>
                사유를 선택해주세요
              </option>
              {meta.reasons.map((r) => (
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
                "resize-none rounded-xl border bg-background px-3 py-2.5 text-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              {...register("detail")}
            />
            {errors.detail && (
              <p className="text-sm text-destructive">{errors.detail.message}</p>
            )}
          </div>

          {/* 실패 안내 — 자동 재시도 없이 제출 버튼으로 재시도 */}
          {isError && !isSuccess && (
            <p className="text-sm text-destructive">
              신청에 실패했어요. 잠시 후 다시 시도해주세요.
            </p>
          )}

          <div className="mt-2 flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="h-11 flex-1 rounded-xl"
            >
              {isPending ? "신청 중…" : "신청하기"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
