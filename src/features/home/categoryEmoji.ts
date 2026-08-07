// 카테고리 표시 아이콘 — 백엔드가 이미지·emoji를 관리하지 않으므로 프론트에서 붙인다.
//
// 키는 대분류 name 을 그대로 쓴다(응답값 = 화면 표기). id 로 키를 잡지 않는 이유:
// 카테고리 재적재 때 id 가 바뀐 적이 있어, 이름이 더 안정적인 식별자다.
//
// 매핑에 없으면 기본 이모지로 폴백해 화면이 깨지지 않게 한다.
const CATEGORY_EMOJI: Record<string, string> = {
  "패션의류/잡화": "👗",
  뷰티: "💄",
  식품: "🍱",
  "가전/디지털": "🔌",
  "생활/주방": "🍳",
  "출산/유아동": "🍼",
  "헬스/건강/의료": "💪",
  "도서/취미/문구": "📚",
  "가구/인테리어": "🛋️",
  "스포츠/레저": "⚽",
  "자동차/공구": "🚗",
  "꽃/원예": "🌷",
  반려동물: "🐶",
  "서비스/기타": "🛎️",
};

const FALLBACK_EMOJI = "🏷️";

export function categoryEmoji(name: string): string {
  return CATEGORY_EMOJI[name] ?? FALLBACK_EMOJI;
}

/**
 * 카테고리 아이콘 이미지 경로 — `public/categories/` 에 파일을 넣으면 이모지 대신 쓰인다.
 *
 * 파일을 아직 안 넣은 카테고리는 여기 등록하지 않으면 되고, 그때는 이모지로 폴백한다.
 * 즉 14개를 한꺼번에 채울 필요 없이 준비된 것부터 하나씩 켤 수 있다.
 *
 * 카테고리명에 `/` 가 들어가 그대로 파일명에 쓸 수 없어(경로로 해석된다)
 * 슬래시를 `-` 로 바꾼 이름을 쓴다.
 */
const CATEGORY_IMAGE: Record<string, string> = {
  // 예) "뷰티": "/categories/beauty.png",
};

export function categoryImage(name: string): string | null {
  return CATEGORY_IMAGE[name] ?? null;
}
