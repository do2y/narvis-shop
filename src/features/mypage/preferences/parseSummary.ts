// 요약 문단(M-11 `markdown`)을 렌더 가능한 블록으로 쪼갠다.
//
// ⚠️ **이 문자열은 LLM이 생성한 것이라 신뢰 경계 밖이다.**
//
// 방어 전략은 sanitize가 아니라 "HTML을 애초에 파싱하지 않는 것"이다. 결과를
// React 노드로 조립하고 dangerouslySetInnerHTML을 쓰지 않으므로, 원문에
// <script>가 들어 있어도 그냥 글자로 화면에 나간다. 라이브러리(react-markdown
// + rehype-sanitize)를 쓰지 않는 이유이기도 하다 — allowedElements를 잘못
// 잡으면 오히려 위험해지는데, 파싱하지 않으면 그 실수 자체가 불가능하다.
//
// 지원 문법은 노션 3.0이 요구하는 "제목·목록·강조 정도"로 한정한다.
// 링크·이미지는 계약에 없고, 열어주면 피싱 표면이 된다.

/** 인라인 조각 — 강조는 텍스트 안에서만 갈린다 */
export interface SummaryInline {
  text: string;
  bold: boolean;
}

export type SummaryBlock =
  | { type: "heading"; level: 1 | 2 | 3; inlines: SummaryInline[] }
  | { type: "paragraph"; inlines: SummaryInline[] }
  | { type: "list"; items: SummaryInline[][] };

/** `**강조**` 만 인식한다. 짝이 맞지 않는 `**`는 평문으로 남긴다 */
function parseInlines(text: string): SummaryInline[] {
  const out: SummaryInline[] = [];
  // 여는 ** 와 닫는 ** 사이에 최소 한 글자. 줄바꿈은 넘지 않는다.
  const pattern = /\*\*([^*\n]+?)\*\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      out.push({ text: text.slice(cursor, match.index), bold: false });
    }
    out.push({ text: match[1], bold: true });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    out.push({ text: text.slice(cursor), bold: false });
  }
  // 전부 빈 문자열이면 조각을 만들지 않는다(빈 <span> 방지)
  return out.filter((i) => i.text.length > 0);
}

/**
 * 마크다운 문자열을 블록 배열로.
 *
 * 줄 단위로만 본다 — 중첩 목록·인용·코드블록은 지원하지 않고 평문 문단이 된다.
 * 요약은 몇 문장짜리라 그 이상의 구조가 필요하지 않고, 문법을 늘릴수록
 * "이건 파싱되나?"를 판단할 표면만 넓어진다.
 */
export function parseSummary(markdown: string): SummaryBlock[] {
  const blocks: SummaryBlock[] = [];
  // 연속된 목록 항목을 한 <ul>로 묶기 위해 진행 중인 목록을 들고 간다
  let list: SummaryInline[][] | null = null;

  const flushList = () => {
    if (list && list.length > 0) blocks.push({ type: "list", items: list });
    list = null;
  };

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();

    if (line.length === 0) {
      flushList();
      continue;
    }

    // 마커만 있고 내용이 없는 줄("- ", "#")은 버린다. 여기서 걸러내지 않으면
    // 아래 평문 분기로 떨어져 "#" 한 글자짜리 문단이 화면에 남는다.
    // (trim 뒤라 "# " 같은 줄은 마커만 남은 상태로 도착한다)
    if (/^(#{1,6}|[-*])$/.test(line)) {
      flushList();
      continue;
    }

    // 제목 — # ~ ### 까지. #### 이상은 평문으로 둔다(요약에 쓸 깊이가 아니다)
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      const inlines = parseInlines(heading[2]);
      if (inlines.length > 0) {
        blocks.push({
          type: "heading",
          level: heading[1].length as 1 | 2 | 3,
          inlines,
        });
      }
      continue;
    }

    // 목록 — "- " 또는 "* ". 마커만 있고 내용이 없는 줄은 버린다
    const item = /^[-*]\s+(.*)$/.exec(line);
    if (item) {
      const inlines = parseInlines(item[1]);
      if (inlines.length > 0) {
        list ??= [];
        list.push(inlines);
      }
      continue;
    }

    flushList();
    const inlines = parseInlines(line);
    if (inlines.length > 0) blocks.push({ type: "paragraph", inlines });
  }

  flushList();
  return blocks;
}
