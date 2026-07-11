import { useState } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";

// 옵션 그룹 — 제품마다 축(컬러/사이즈/용량...)과 개수가 달라 배열로 받는다.
// 조합별 재고/가격을 따지지 않는 "독립 옵션" 모델. (SKU 조합형은 계약 확정 후 검토)
export interface OptionGroup {
  name: string; // "컬러", "사이즈" ...
  values: string[];
}

// options 배열을 그대로 map 렌더하므로 옵션이 몇 개든 자동 대응.
// 계약 전이라 선택 상태는 로컬 UI만(구매 연동 별도).
export function OptionSelector({ options }: { options: OptionGroup[] }) {
  // 그룹명 → 선택값. 각 그룹 첫 값으로 초기화.
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(options.map((g) => [g.name, g.values[0] ?? ""])),
  );
  const [qty, setQty] = useState(1);

  const pick = (name: string, value: string) =>
    setSelected((prev) => ({ ...prev, [name]: value }));

  return (
    <div className="flex flex-col gap-5">
      {options.map((group) => (
        <Field
          key={group.name}
          label={group.name}
          // 사이즈 그룹에만 가이드 링크 노출
          action={
            group.name === "사이즈" ? (
              <button
                type="button"
                className="text-sm text-muted-foreground hover:underline"
              >
                사이즈 가이드
              </button>
            ) : undefined
          }
        >
          <SelectBox
            value={selected[group.name]}
            onChange={(v) => pick(group.name, v)}
            options={group.values}
            ariaLabel={`${group.name} 선택`}
          />
        </Field>
      ))}

      <Field label="수량">
        <div className="flex w-fit items-center rounded-full border">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="수량 감소"
            className="flex size-10 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-10 text-center text-sm font-medium">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            aria-label="수량 증가"
            className="flex size-10 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </Field>
    </div>
  );
}

function Field({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{label}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

// 네이티브 select 기반 드롭다운 — 접근성·모바일 터치 기본 제공.
// 커스텀 화살표를 위해 기본 appearance 제거 후 아이콘 오버레이.
function SelectBox({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  ariaLabel: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="h-11 w-full appearance-none rounded-xl border bg-background px-4 pr-10 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
