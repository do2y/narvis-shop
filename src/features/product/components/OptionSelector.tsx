"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  clampQuantity,
  resolveOptionSelection,
} from "../utils/optionSelection";
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

  // 선택·재고 판정은 순수 함수로 뺐다(utils/optionSelection) — 재고 조합이
  // 화면으로는 재현되지 않아 테스트로 검증한다.
  const {
    selected,
    soldOut: selectedSoldOut,
    stockLimit,
  } = resolveOptionSelection({ options, pickedId, productStock: maxQuantity });
  const optionId = selected?.optionId ?? null;

  // 재고가 줄어(다른 창에서 담기 등) qty가 상한을 넘어도 표시·전파는 상한으로 클램프한다.
  // state를 effect에서 되돌리는 대신 렌더 중 파생값으로 계산 → cascading render 회피.
  const quantity = clampQuantity(qty, stockLimit);

  // 재고가 있으면 상한을 넘겨 담지 못하게 막는다(1 이상은 항상 허용).
  // 품절 옵션은 애초에 담을 수 없어 수량 안내가 의미 없으므로 제외한다.
  const atMax =
    !selectedSoldOut && stockLimit != null && quantity >= stockLimit;

  // 선택/수량 변경을 상위로 전파. (부모의 액션 버튼이 최신 선택을 읽도록)
  useEffect(() => {
    onChange?.({ option: selected, quantity, soldOut: selectedSoldOut });
  }, [selected, quantity, selectedSoldOut, onChange]);

  return (
    // gap-4: 옵션·수량·선택단가가 하나의 "고르는 구역"으로 묶여 보이도록
    // 섹션 간격(gap-6 이상)보다 좁게 유지한다(§16 근접성 = 관계).
    <div className="flex flex-col gap-4">
      {options.length > 0 && (
        <Field label="옵션">
          {/* 네이티브 select 를 쓰지 않는다 — <option> 안에는 요소를 넣을 수 없어
              품절을 글자색과 꼬리말로만 표현하게 되고, 그러면 목록을 훑어서는
              구분되지 않는다(배지·행 배경이 불가능). */}
          <Select
            value={optionId ?? ""}
            // string 으로 다룬다 — optionId 는 64비트 ID라 숫자로 바꾸면 끝자리가
            // 조용히 바뀌어 서버가 CART_OPTION_INVALID 로 거부한다.
            onValueChange={(next) => setPickedId(next)}
          >
            <SelectTrigger aria-label="옵션 선택">
              {/* 값(optionId)이 아니라 옵션명을 보여준다 — 기본 렌더는 raw value 다 */}
              <SelectValue>
                {(value) => {
                  const opt = options.find((o) => o.optionId === value);
                  if (!opt) return null;
                  return (
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">
                        {opt.extraPrice > 0
                          ? `${opt.name} (+${opt.extraPrice.toLocaleString("ko-KR")}원)`
                          : opt.name}
                      </span>
                      {/* 목록 배지와 같은 값을 쓴다 — 닫힌 상태와 펼친 상태에서
                          같은 것이 다르게 보이면 다른 상태로 읽힌다 */}
                      {opt.purchaseState === "SOLD_OUT" && (
                        <span className="shrink-0 rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          품절
                        </span>
                      )}
                    </span>
                  );
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => {
                // 품절 옵션도 목록에 남긴다 — 숨기면 "원래 없는 옵션"과 구분되지 않아
                // 재입고를 기다릴지 판단할 수 없다(명세의 의도). 대신 고르지 못하게 막는다.
                const optSoldOut = opt.purchaseState === "SOLD_OUT";
                return (
                  <SelectItem
                    key={opt.optionId}
                    value={opt.optionId}
                    disabled={optSoldOut}
                  >
                    <SelectItemText>
                      {/* 추가금이 있는 옵션만 금액을 함께 노출 */}
                      {opt.extraPrice > 0
                        ? `${opt.name} (+${opt.extraPrice.toLocaleString("ko-KR")}원)`
                        : opt.name}
                    </SelectItemText>
                    {/* 색만으로 알리지 않는다 — 배지 글자가 상태를 직접 말한다.
                        경고가 아니라 "고를 수 없음"이라 중립 회색으로 둔다.
                        배경은 행보다 한 단계 진해야 한다 — 같은 명도면 배지가
                        행에 묻혀 글자만 떠 있는 것처럼 보인다. */}
                    {optSoldOut && (
                      <span className="shrink-0 rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        품절
                      </span>
                    )}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {/* 고른 뒤 재고가 소진되면 선택값이 품절인 채로 남는다 — 왜 담기지 않는지
              알려주지 않으면 버튼만 막힌 채 이유를 알 수 없다. */}
          {selectedSoldOut && (
            <p className="text-xs text-muted-foreground" role="status">
              현재 선택한 옵션은 품절되었습니다. 다른 옵션을 골라주세요.
            </p>
          )}
        </Field>
      )}

      <Field label="수량">
        {/* rounded-sm(6px) — 종전 rounded-full 은 이 자리에서 알약 하나가 통째로
            떠 있는 것처럼 보여 옆의 옵션 select(각진 사각)와 언어가 어긋났다.
            CLAUDE.md 의 "입력은 rounded-sm" 을 따른다 — 이건 버튼이 아니라
            수량 입력 컨트롤이다.

            h-11 로 select 와 높이를 맞춘다. divide-x 로 세 칸을 나눠 각 버튼의
            누를 수 있는 범위가 눈에 보이게 한다(종전에는 경계가 없어 어디까지가
            버튼인지 알 수 없었다). */}
        <div className="flex h-11 w-fit items-center divide-x rounded-sm border">
          <button
            type="button"
            // 표시값(클램프된 quantity) 기준으로 증감 — qty가 상한보다 커도 자연스럽게 이어진다.
            onClick={() => setQty(Math.max(1, quantity - 1))}
            disabled={quantity <= 1}
            aria-label="수량 감소"
            // size-11(44px) — 터치 타겟 최소치(CLAUDE.md). 아이콘은 작게 두되
            // 누를 수 있는 면적은 유지한다.
            className="flex size-11 items-center justify-center rounded-l-sm text-muted-foreground transition-colors duration-150 ease-out-strong hover:text-foreground disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <Minus className="size-3.5" />
          </button>
          {/* tabular-nums: 1→2 처럼 자릿수가 같아도 글자 폭이 달라 숫자가 미세하게
              흔들린다. 고정폭 숫자로 두면 증감 중에도 좌우 버튼이 제자리에 있다. */}
          <span className="flex h-11 w-12 items-center justify-center text-sm font-medium tabular-nums">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQty(quantity + 1)}
            disabled={atMax}
            aria-label="수량 증가"
            className="flex size-11 items-center justify-center rounded-r-sm text-muted-foreground transition-colors duration-150 ease-out-strong hover:text-foreground disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        {/* 재고 상한에 도달했을 때만 안내. 남은 재고 수량은 노출하지 않는다. */}
        {atMax && (
          <p className="text-xs text-muted-foreground" role="status">
            더 담을 수 있는 재고가 없어요.
          </p>
        )}
      </Field>

      {/* 옵션 추가금이 붙으면 최종 단가가 달라지므로 합계를 명시.
          라벨은 보조로 낮추고 금액만 본문 색으로 올린다 — 상단 가격과 중복되는
          정보라 같은 무게로 두면 "가격이 두 개"로 읽힌다. */}
      {selected && selected.extraPrice > 0 && (
        <div className="flex items-baseline justify-between border-t pt-4">
          <span className="text-xs text-muted-foreground">선택 단가</span>
          <span className="text-sm font-semibold tabular-nums">
            {(basePrice + selected.extraPrice).toLocaleString("ko-KR")}원
          </span>
        </div>
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
      {/* 라벨은 보조 정보다 — 값(선택된 옵션·수량)보다 강하면 안 된다.
          text-xs + muted 로 낮추고, 값 쪽이 본문 크기를 갖는다. */}
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
