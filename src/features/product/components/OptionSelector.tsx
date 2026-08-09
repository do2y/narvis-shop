"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import type { ProductOption } from "../types";

export interface OptionSelection {
  // 선택된 옵션. 옵션 없는 상품은 null (장바구니·주문에 optionId를 보내지 않음)
  option: ProductOption | null;
  quantity: number;
  /**
   * 고른 옵션이 품절인가 (2026-08-09 옵션별 재고).
   * 상품의 purchaseState 는 "살 수 있는 옵션이 하나도 없을 때"만 SOLD_OUT 이라,
   * 일부 색만 품절인 상품은 그 판정으로 걸러지지 않는다. 담기 차단은 이 값으로 한다.
   */
  soldOut: boolean;
}

// 백엔드 옵션 모델은 평면 목록({optionId, name:"화이트/M", extraPrice})이라 단일 선택.
// 옵션이 없는 상품(options: [])은 수량만 노출한다.
export function OptionSelector({
  options,
  basePrice,
  maxQuantity,
  onChange,
}: {
  options: ProductOption[];
  basePrice: number;
  // 옵션 없는 상품의 재고 상한. 상세 도착 전(재고 미상)에는 undefined → 제한 없이 증가 허용.
  // 옵션이 있으면 이 값 대신 선택된 옵션의 stockQuantity 를 쓴다(2026-08-09) —
  // 상품 값은 옵션 재고의 합계라 상한으로 쓰면 담기지 않을 수량까지 허용된다.
  maxQuantity?: number;
  onChange?: (selection: OptionSelection) => void;
}) {
  // 사용자가 고른 값만 담는다. 초기값을 options[0]으로 잡으면 상세 도착 전 첫 렌더에서
  // null로 굳어(초기화 함수는 재실행되지 않음) select에는 첫 옵션이 보이는데
  // 실제 선택은 비어 있는 상태가 된다.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  // 미선택이면 첫 옵션을 기본값으로 본다 — select의 표시값과 항상 일치시킨다.
  // 품절 옵션은 기본 선택에서 건너뛴다 — 첫 옵션이 품절이면 화면에 열자마자
  // 담기 버튼이 막힌 채로 시작해 살 수 있는 색이 있는데도 없는 것처럼 보인다.
  const firstAvailable =
    options.find((o) => o.purchaseState === "AVAILABLE") ?? options[0] ?? null;
  const selected =
    options.find((o) => o.optionId === pickedId) ?? firstAvailable;
  const optionId = selected?.optionId ?? null;
  const selectedSoldOut = selected?.purchaseState === "SOLD_OUT";

  // 수량 상한 — 옵션이 있으면 그 옵션 재고, 없으면 상품 재고.
  const stockLimit = selected ? selected.stockQuantity : maxQuantity;

  // 재고가 줄어(다른 창에서 담기 등) qty가 상한을 넘어도 표시·전파는 상한으로 클램프한다.
  // state를 effect에서 되돌리는 대신 렌더 중 파생값으로 계산 → cascading render 회피.
  // (1 이상은 항상 허용, 재고가 0이어도 최소 1)
  const quantity =
    stockLimit != null ? Math.min(qty, Math.max(1, stockLimit)) : qty;

  // 재고가 있으면 상한을 넘겨 담지 못하게 막는다(1 이상은 항상 허용).
  // 품절 옵션은 애초에 담을 수 없어 수량 안내가 의미 없으므로 제외한다.
  const atMax =
    !selectedSoldOut && stockLimit != null && quantity >= stockLimit;

  // 선택/수량 변경을 상위로 전파. (부모의 액션 버튼이 최신 선택을 읽도록)
  useEffect(() => {
    onChange?.({ option: selected, quantity, soldOut: selectedSoldOut });
  }, [selected, quantity, selectedSoldOut, onChange]);

  return (
    <div className="flex flex-col gap-5">
      {options.length > 0 && (
        <Field label="옵션">
          <div className="relative">
            <select
              value={optionId ?? ""}
              // Number() 로 바꾸지 말 것 — optionId 는 64비트 ID라 숫자로 만들면
              // 끝자리가 조용히 바뀌어 서버가 CART_OPTION_INVALID 로 거부한다.
              onChange={(e) => setPickedId(e.target.value)}
              aria-label="옵션 선택"
              className="h-11 w-full appearance-none rounded-sm border bg-background px-4 pr-10 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {options.map((opt) => {
                // 품절 옵션도 목록에 남긴다 — 숨기면 "원래 없는 옵션"과 구분되지 않아
                // 재입고를 기다릴지 판단할 수 없다(명세의 의도). 대신 고르지 못하게 막는다.
                const optSoldOut = opt.purchaseState === "SOLD_OUT";
                return (
                  <option
                    key={opt.optionId}
                    value={opt.optionId}
                    disabled={optSoldOut}
                  >
                    {/* 추가금이 있는 옵션만 금액을 함께 노출 */}
                    {opt.extraPrice > 0
                      ? `${opt.name} (+${opt.extraPrice.toLocaleString("ko-KR")}원)`
                      : opt.name}
                    {optSoldOut && " — 품절"}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          {/* 전 옵션 품절이면 기본 선택이 품절 옵션으로 잡힌다 — 왜 담기지 않는지
              알려주지 않으면 버튼만 막힌 채 이유를 알 수 없다. */}
          {selectedSoldOut && (
            <p className="text-xs text-muted-foreground" role="status">
              품절된 옵션이에요. 다른 옵션을 골라주세요.
            </p>
          )}
        </Field>
      )}

      <Field label="수량">
        <div className="flex w-fit items-center rounded-full border">
          <button
            type="button"
            // 표시값(클램프된 quantity) 기준으로 증감 — qty가 상한보다 커도 자연스럽게 이어진다.
            onClick={() => setQty(Math.max(1, quantity - 1))}
            aria-label="수량 감소"
            className="flex size-10 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-10 text-center text-sm font-medium">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQty(quantity + 1)}
            disabled={atMax}
            aria-label="수량 증가"
            className="flex size-10 items-center justify-center text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <Plus className="size-4" />
          </button>
        </div>
        {/* 재고 상한에 도달했을 때만 안내. 남은 재고 수량은 노출하지 않는다. */}
        {atMax && (
          <p className="text-xs text-muted-foreground" role="status">
            더 담을 수 있는 재고가 없어요.
          </p>
        )}
      </Field>

      {/* 옵션 추가금이 붙으면 최종 단가가 달라지므로 합계를 명시 */}
      {selected && selected.extraPrice > 0 && (
        <p className="text-sm text-muted-foreground">
          선택 단가{" "}
          <span className="font-semibold text-foreground">
            {(basePrice + selected.extraPrice).toLocaleString("ko-KR")}원
          </span>
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}
