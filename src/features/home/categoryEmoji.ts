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
 * 카테고리 아이콘 이미지 경로 — `public/categories/` 의 파일을 가리킨다.
 *
 * 파일명은 카테고리명이 아니라 `01-service` 식의 번호+영문 slug 다.
 * 카테고리명에 `/` 가 들어가 파일명에 그대로 못 쓰고(경로로 해석된다),
 * 한글 파일명은 URL 인코딩이 얽혀 다루기 번거롭기 때문. 대응은 이 표가 전담한다.
 *
 * 표에 있어도 파일이 실제로 없을 수 있다(에셋 교체 중 등). 그 경우는 여기서 알 수 없고
 * 로드 실패로만 드러나므로, 호출부가 `onError` 로 DEFAULT_CATEGORY_IMAGE 를 세운다.
 */
const CATEGORY_IMAGE: Record<string, string> = {
  "서비스/기타": "/categories/01-service.svg",
  "가전/디지털": "/categories/02-digital.svg",
  뷰티: "/categories/03-beauty.svg",
  반려동물: "/categories/04-pet.svg",
  "패션의류/잡화": "/categories/05-fashion.svg",
  "출산/유아동": "/categories/06-baby.svg",
  "생활/주방": "/categories/07-living.svg",
  "헬스/건강/의료": "/categories/08-health.svg",
  "도서/취미/문구": "/categories/09-book.svg",
  "가구/인테리어": "/categories/10-furniture.svg",
  "스포츠/레저": "/categories/11-sports.svg",
  "자동차/공구": "/categories/12-auto.svg",
  식품: "/categories/13-food.svg",
  "꽃/원예": "/categories/14-flower.svg",
};

/**
 * 매핑에 없거나 파일이 없을 때 쓰는 기본 아이콘.
 * 다른 아이콘과 같은 그라데이션 팔레트라 섞여 있어도 톤이 어긋나지 않는다.
 */
export const DEFAULT_CATEGORY_IMAGE = "/categories/00-default.svg";

export function categoryImage(name: string): string | null {
  return CATEGORY_IMAGE[name] ?? null;
}
