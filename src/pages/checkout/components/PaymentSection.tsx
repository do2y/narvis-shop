import { cn } from "@/lib/utils";
import { PAYMENT_METHODS } from "../placeholder";
import type { PaymentMethod } from "../types";

// 결제 수단 선택 — 실제 PG 미연동(모의 결제)이라 카드 정보는 받지 않는다.
// 성공/실패는 서버가 paymentMethod로만 판정한다(MOCK_FAIL이면 무조건 실패).
export function PaymentSection({
  method,
  onMethodChange,
}: {
  method: PaymentMethod;
  onMethodChange: (v: PaymentMethod) => void;
}) {
  return (
    <section className="rounded-sm border bg-background p-5 sm:p-6">
      <h2 className="text-lg font-bold">결제 수단</h2>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PAYMENT_METHODS.map((m) => {
          const active = m.value === method;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => onMethodChange(m.value)}
              className={cn(
                "h-12 rounded-full border text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input hover:bg-muted/40",
              )}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        데모용 모의 결제예요. 실제로 청구되지 않으며, 실패 흐름을 보려면 &lsquo;테스트:
        결제 실패&rsquo;를 선택하세요.
      </p>
    </section>
  );
}
