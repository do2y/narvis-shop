import { BRAND_SORTS, type BrandSort } from "../types";

// 정렬 — 네이티브 select. 옵션이 4개뿐이고 모바일에서 OS 피커가 가장 다루기 쉽다.
export function SortSelect({
  value,
  onChange,
}: {
  value: BrandSort;
  onChange: (sort: BrandSort) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">정렬 기준</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as BrandSort)}
        className="h-11 rounded-full border bg-background px-4 text-sm font-medium transition hover:border-foreground/30"
      >
        {BRAND_SORTS.map((sort) => (
          <option key={sort.value} value={sort.value}>
            {sort.label}
          </option>
        ))}
      </select>
    </label>
  );
}
