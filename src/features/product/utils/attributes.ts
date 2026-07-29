import type { ProductAttributeValue } from "../types";

export interface SpecRow {
  label: string;
  value: string;
}

const HIDDEN_KEYS = new Set(["옵션구성"]);

function formatValue(value: ProductAttributeValue): string | null {
  if (value == null) return null; // "소재": null — 값 미입력
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  // 옵션 축 후보값 목록(["S","M","L"]) — 나열해서 보여준다.
  if (Array.isArray(value)) {
    const items = value.filter((v) => typeof v === "string" && v.trim() !== "");
    return items.length > 0 ? items.join(", ") : null;
  }
  // 그 외 객체는 표시용 계약이 없다. 렌더하면 React error #31이므로 버린다.
  return null;
}

// attributes 맵 → 스펙 표 행. 표시 불가능한 값(null·빈값·메타 객체)은 제외한다.
export function toSpecRows(
  attributes: Record<string, ProductAttributeValue> | undefined,
): SpecRow[] {
  if (!attributes) return [];
  const rows: SpecRow[] = [];
  for (const [label, raw] of Object.entries(attributes)) {
    if (HIDDEN_KEYS.has(label)) continue;
    const value = formatValue(raw);
    if (value !== null) rows.push({ label, value });
  }
  return rows;
}
