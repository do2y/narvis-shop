// 한국어 조사 선택 — 앞 단어의 받침 유무로 갈린다.
// 상품명처럼 사용자 데이터를 문장에 끼워 넣을 때 "은(는)" 같은 병기를 쓰지 않기 위한 유틸.

// 받침 유무로 갈리는 조사 쌍 — [받침 있음, 받침 없음]
// "으로/로"는 ㄹ 받침이 예외("서울로")라 규칙이 하나 더 필요하다. 쓸 일이 생기면 그때 넣는다.
const PAIRS = {
  은: ["은", "는"],
  이: ["이", "가"],
  을: ["을", "를"],
  과: ["과", "와"],
} as const;

export type JosaType = keyof typeof PAIRS;

/**
 * 마지막 글자에 받침이 있는지. 판별 불가면 null.
 *
 * 한글은 유니코드에서 (초성·중성·종성) 조합이 순서대로 배열돼 있어,
 * 가(0xAC00)로부터의 거리를 28(종성 개수)로 나눈 나머지가 곧 종성 인덱스다. 0이면 받침 없음.
 *
 * 상품명은 영문·숫자로 끝나는 경우가 흔해(예: "코튼 팬츠 2XL") 읽는 소리 기준으로 처리한다.
 */
function hasFinalConsonant(word: string): boolean | null {
  const last = word.trim().at(-1);
  if (!last) return null;

  const code = last.charCodeAt(0);

  // 한글 음절 영역
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;

  // 숫자 — 읽는 소리의 받침을 따른다(1 일, 3 삼, 6 육, 7 칠, 8 팔, 0 영은 받침 있음)
  if (last >= "0" && last <= "9") return "1368019".includes(last);

  // 영문 — 알파벳 이름을 한글로 읽었을 때의 받침
  // (L 엘, M 엠, N 엔, R 아르, 그 외 모음/자음 이름은 받침 없음)
  const upper = last.toUpperCase();
  if (upper >= "A" && upper <= "Z") return "LMNR".includes(upper);

  // 기호·한자 등은 판별할 수 없다 — 호출부가 병기로 물러나게 null을 준다
  return null;
}

/**
 * 단어에 맞는 조사를 붙여 반환한다. 판별 불가한 문자로 끝나면 "은(는)" 형태로 병기한다.
 *
 * withJosa("린넨 셔츠", "은") → "린넨 셔츠는"
 * withJosa("코튼 팬츠", "은") → "코튼 팬츠는"
 * withJosa("맨투맨", "은")   → "맨투맨은"
 */
export function withJosa(word: string, type: JosaType): string {
  const [withFinal, withoutFinal] = PAIRS[type];
  const has = hasFinalConsonant(word);
  if (has === null) return `${word}${withFinal}(${withoutFinal})`;
  return `${word}${has ? withFinal : withoutFinal}`;
}
