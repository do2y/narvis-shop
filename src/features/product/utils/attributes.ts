import type { ProductAttributeValue } from "../types";

export interface SpecRow {
  label: string;
  value: string;
}

const HIDDEN_KEYS = new Set(["옵션구성"]);

// 값이 문자열로 채워져 있지만 실제로는 "판매자가 안 적었다"는 뜻인 관용구.
// 출처는 11번가 상품정보고시 — 법정 고시 항목(기능성화장품여부·제조국·KC인증정보 등)에
// 몰려 있고, AI 시드 추출이 이 문구를 그대로 옮겨 담았다. 실측 2,027건.
//
// ⚠️ 완전 일치로만 판정한다. 부분 일치(includes("없음"))로 바꾸면
// "안감없음"·"지퍼없음"·"큐빅없음"처럼 진짜 속성값까지 사라진다.
//
// 근본 해결은 시드 생성 단계에서 이 값들을 null로 통일하는 것 — 백엔드 이슈로 등록됨.
const EMPTY_VALUES = new Set(["미표기", "표기없음", "표시없음", "정보없음"]);

// 여기 넣지 않기로 한 값들:
// - "해당없음"·"없음" — 정보의 부재가 아니라 "이 제품엔 그 속성이 없다"는 확인이다
//   (기능성: 해당없음 = 기능성 화장품이 아님).
// - "상세설명참조"·"상세페이지 참조" 등 — 상세 이미지를 보라는 안내라 그 자체로 의미가 있다.

function isEmptyValue(trimmed: string): boolean {
  // 같은 뜻에 띄어쓰기만 다른 표기가 섞여 들어온다("표기 없음" vs "표기없음").
  return EMPTY_VALUES.has(trimmed.replace(/\s+/g, ""));
}

function formatValue(value: ProductAttributeValue): string | null {
  if (value == null) return null; // "소재": null — 값 미입력
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || isEmptyValue(trimmed)) return null;
    return trimmed;
  }
  // 옵션 축 후보값 목록(["S","M","L"]) — 나열해서 보여준다.
  // 원소에도 미기재 관용구가 섞여 들어오므로 문자열과 같은 기준으로 거른다.
  if (Array.isArray(value)) {
    const items = value
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter((v) => v !== "" && !isEmptyValue(v));
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
