// 카테고리 이모지 매핑 — 백엔드가 emoji를 관리하지 않으므로 프론트에서 표시용으로 붙인다.
// 대분류 name 기준. 매핑에 없는 카테고리는 기본 이모지로 폴백(화면이 깨지지 않도록).
const CATEGORY_EMOJI: Record<string, string> = {
  // 현재 백엔드 대분류 4종
  패션: "👗",
  뷰티: "💄",
  식품: "🍱",
  가전: "🔌",
  // 카테고리 확장 대비
  디지털: "⌨️",
  생활용품: "🏠",
  주방용품: "🍳",
  여행: "✈️",
  자취: "🛏️",
  선물: "🎁",
};

const FALLBACK_EMOJI = "🏷️";

export function categoryEmoji(name: string): string {
  return CATEGORY_EMOJI[name] ?? FALLBACK_EMOJI;
}
