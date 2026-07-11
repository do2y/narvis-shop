import { cn } from "@/lib/utils";
import { MOCK_FAIL_CARD, PAYMENT_METHODS } from "../placeholder";

// 결제 수단 선택 + 카드 입력(카드 선택 시).
// 카드번호는 상위에서 실패 판정에 쓰므로 controlled로 올린다.
export function PaymentSection({
  method,
  onMethodChange,
  cardNumber,
  onCardNumberChange,
}: {
  method: string;
  onMethodChange: (v: string) => void;
  cardNumber: string;
  onCardNumberChange: (v: string) => void;
}) {
  const isCard = method === "신용 · 체크카드";

  return (
    <section className="rounded-xl border bg-background p-5 sm:p-6">
      <h2 className="text-lg font-bold">결제 수단</h2>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {PAYMENT_METHODS.map((m) => {
          const active = m === method;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onMethodChange(m)}
              className={cn(
                "h-12 rounded-full border text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input hover:bg-muted/40",
              )}
            >
              {m}
            </button>
          );
        })}
      </div>

      {isCard && (
        <div className="mt-6 flex flex-col gap-4 border-t pt-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">카드 번호</label>
            <input
              inputMode="numeric"
              placeholder="0000 0000 0000 0000"
              value={cardNumber}
              onChange={(e) => onCardNumberChange(e.target.value)}
              className="h-11 w-full rounded-xl border px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {/* 데모 안내 — 실패 플로우를 테스트할 수 있도록 실패 카드 노출 */}
            <p className="text-xs text-muted-foreground">
              결제 실패를 테스트하려면{" "}
              <button
                type="button"
                onClick={() => onCardNumberChange(MOCK_FAIL_CARD)}
                className="font-medium text-foreground underline underline-offset-2"
              >
                {MOCK_FAIL_CARD}
              </button>{" "}
              카드로 시도해보세요.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <label className="text-sm font-medium">유효기간</label>
              <input
                inputMode="numeric"
                placeholder="MM/YY"
                className="h-11 w-full rounded-xl border px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <label className="text-sm font-medium">CVC</label>
              <input
                inputMode="numeric"
                placeholder="000"
                className="h-11 w-full rounded-xl border px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
