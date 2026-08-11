"use client";

import { X } from "lucide-react";
import type { ConditionChip, ConditionField } from "@/shared/types/chat";

interface ConditionChipsProps {
  conditions: ConditionChip[];
  /**
   * 칩 제거 — conditionActions 로 전송.
   *
   * value 까지 넘긴다. category·brand 는 값당 칩 1개라(계약 v0.32.14) field 만으로는
   * 어느 칩을 눌렀는지 특정되지 않는다.
   */
  onRemove: (field: ConditionField, value: string | number) => void;
  disabled?: boolean; // 스트리밍 중엔 제거 비활성
}

// AI가 추출한 필터 조건 칩. 각 칩은 X로 제거 가능(계약 CH-2 §conditions).
export function ConditionChips({
  conditions,
  onRemove,
  disabled,
}: ConditionChipsProps) {
  if (conditions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {conditions.map((chip) => (
        <span
          // field 단독은 키가 될 수 없다 — category·brand 는 값당 칩 1개로 나뉘어
          // 같은 field 가 여러 개 온다(계약 v0.32.14). 중복 키는 React 경고에서
          // 끝나지 않고 리컨실리에이션을 어긋나게 해, 하나를 지우면 엉뚱한 칩이
          // 사라져 보이고 등장 애니메이션도 남은 칩에서 다시 돈다.
          key={`${chip.field}:${chip.value}`}
          className="flex animate-in items-center gap-1 rounded-full bg-muted py-1.5 pl-3 pr-1.5 text-sm text-muted-foreground duration-200 fade-in zoom-in-95"
        >
          {chip.label}
          <button
            type="button"
            onClick={() => onRemove(chip.field, chip.value)}
            disabled={disabled}
            aria-label={`${chip.label} 조건 제거`}
            className="flex size-5 items-center justify-center rounded-full transition-colors hover:bg-foreground/10 disabled:opacity-40"
          >
            <X className="size-3.5" />
          </button>
        </span>
      ))}
    </div>
  );
}
