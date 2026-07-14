import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import {
  claimRequestSchema,
  type ClaimRequestFormInput,
  type ClaimRequestFormValues,
} from "../claimSchema";
import { useCreateClaim } from "../useClaims";
import type { ClaimType, Order } from "../types";

// 신청 종류별 제목·명사·사유 목록. RETURN=반품(환불), EXCHANGE=교환.
const TYPE_META: Record<
  Extract<ClaimType, "RETURN" | "EXCHANGE">,
  { title: string; noun: string; reasons: string[] }
> = {
  RETURN: {
    title: "반품 신청",
    noun: "반품",
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
    noun: "교환",
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
  const navigate = useNavigate();
  const { mutate, isPending, isSuccess, isError, reset: resetMutation } =
    useCreateClaim();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClaimRequestFormInput, unknown, ClaimRequestFormValues>({
    // 폼 필드는 문자열(input) → coerce 후 productId: number(output)로 검증.
    // 3번째 제네릭(output)으로 handleSubmit 콜백이 변환된 값을 받게 한다.
    resolver: zodResolver(claimRequestSchema),
    defaultValues: {
      productId: order.items[0]?.productId,
      reason: "",
      detail: "",
    },
  });

  // 열릴 때마다 폼·뮤테이션 상태 초기화 (첫 상품 선택, 사유 비움, 완료 화면 해제).
  useEffect(() => {
    if (!open) return;
    resetMutation();
    reset({ productId: order.items[0]?.productId, reason: "", detail: "" });
  }, [open, order, reset, resetMutation]);

  // zodResolver가 input→output 변환을 마친 값을 넘겨준다(productId: number).
  const submit = (values: ClaimRequestFormValues) => {
    mutate({
      orderId: order.orderId,
      productId: values.productId,
      type,
      reason: values.reason,
      detail: values.detail || undefined,
    });
    // 성공 시 모달을 닫지 않고 완료 화면(isSuccess)으로 전환 — 아래 렌더 분기.
  };

  const single = order.items.length === 1;

  // 신청 접수 완료 — 피드백 화면. '내역 보기'로 이동하거나 닫기.
  if (isSuccess) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle className="sr-only">{meta.title} 완료</DialogTitle>
          <div className="flex flex-col items-center py-4 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-green-50 text-green-600">
              <Check className="size-7" />
            </span>
            <p className="mt-4 text-base font-bold">
              {meta.noun} 신청이 접수됐어요
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              처리 현황은 취소·반품·교환 내역에서 확인할 수 있어요.
            </p>
            <div className="mt-6 flex w-full gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 rounded-xl"
                onClick={() => onOpenChange(false)}
              >
                닫기
              </Button>
              <Button
                type="button"
                className="h-11 flex-1 rounded-xl"
                onClick={() => {
                  onOpenChange(false);
                  navigate("/mypage/claims");
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
