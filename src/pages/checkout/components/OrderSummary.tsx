import { Button } from "@/components/ui/button";

function formatPrice(v: number): string {
  return `${v.toLocaleString("ko-KR")}원`;
}

// 결제 금액 요약 + 결제 버튼. 넓은 화면에선 우측 sticky.
export function OrderSummary({
  itemsTotal,
  discount,
  canSubmit,
  onSubmit,
}: {
  itemsTotal: number;
  discount: number;
  canSubmit: boolean;
  onSubmit: () => void;
}) {
  const finalTotal = itemsTotal - discount;

  return (
    <div className="rounded-xl border bg-background p-5 sm:p-6 lg:sticky lg:top-20">
      <h2 className="text-lg font-bold">결제 금액</h2>

      <dl className="mt-4 flex flex-col gap-2.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">상품 금액</dt>
          <dd className="font-medium">{formatPrice(itemsTotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">할인 금액</dt>
          <dd className="font-medium text-red-500">
            -{formatPrice(discount)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">배송비</dt>
          <dd className="font-medium">무료</dd>
        </div>
      </dl>

      <div className="mt-5 flex items-baseline justify-between border-t pt-5">
        <span className="text-base font-bold">최종 결제 금액</span>
        <span className="text-xl font-bold">{formatPrice(finalTotal)}</span>
      </div>

      <Button
        className="mt-5 h-12 w-full rounded-xl text-base"
        disabled={!canSubmit}
        onClick={onSubmit}
      >
        {formatPrice(finalTotal)} 결제하기
      </Button>
    </div>
  );
}
