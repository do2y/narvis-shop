import { formatPrice } from "@/shared/utils/formatPrice";

export function CartSummary({
  itemsTotal,
  discount,
  paid,
  selectedCount,
  onOrder,
}: {
  itemsTotal: number; // 선택 상품 정가 합
  discount: number; // 선택 상품 할인 합
  paid: number; // 결제 금액 — 전체 선택 시 서버 totalSale, 부분 선택 시 FE 계산
  selectedCount: number;
  onOrder: () => void;
}) {
  const canOrder = selectedCount > 0;

  return (
    <div className="rounded-sm border bg-background p-5 sm:p-6">
      <h2 className="text-lg font-bold">주문 요약</h2>

      <dl className="mt-5 flex flex-col gap-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">상품 금액</dt>
          <dd className="font-medium">{formatPrice(itemsTotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">할인 금액</dt>
          <dd className="font-medium text-red-500">
            {discount > 0 ? `-${formatPrice(discount)}` : formatPrice(0)}
          </dd>
        </div>
      </dl>

      {/* 배송비 정책이 아직 없어 표시하지 않는다. 생기면 서버 계약(Cart)에 필드를
          추가한 뒤 여기에 노출할 것 — FE가 임의 계산하면 실제 결제액과 어긋난다. */}

      <div className="mt-5 flex items-center justify-between border-t pt-5">
        <span className="text-lg font-bold">총 결제 금액</span>
        <span className="text-xl font-bold">{formatPrice(paid)}</span>
      </div>

      <button
        type="button"
        disabled={!canOrder}
        onClick={onOrder}
        className="mt-5 h-12 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {canOrder ? `선택 상품 ${selectedCount}개 주문하기` : "상품을 선택해주세요"}
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        주문 전 배송지와 결제 수단을 확인하세요
      </p>
    </div>
  );
}
