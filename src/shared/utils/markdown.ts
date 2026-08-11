// LLM이 생성한 문자열을 렌더 가능한 블록으로 쪼갠다.
// 취향 요약(M-11 `markdown`)과 챗 말풍선(CH-2 `token.text`)이 함께 쓴다.
//
// ⚠️ **입력은 전부 신뢰 경계 밖이다.**
//
// 요약은 LLM이 만든 문장이고, 챗 토큰에는 그에 더해 **사용자 발화와 판매자가
// 등록한 상품·옵션명이 그대로 실린다**. AI가 쓴 문장만 온다고 가정하면 안 된다.
//
// 방어 전략은 sanitize가 아니라 "HTML을 애초에 파싱하지 않는 것"이다. 결과를
// React 노드로 조립하고 dangerouslySetInnerHTML을 쓰지 않으므로, 원문에
// <script>나 <img onerror=...>가 들어 있어도 그냥 글자로 화면에 나간다.
// 라이브러리(react-markdown + rehype-sanitize)를 쓰지 않는 이유이기도 하다 —
// allowedElements를 잘못 잡으면 오히려 위험해지는데, 파싱하지 않으면 그 실수
// 자체가 불가능하다.
//
// 링크·이미지는 어느 채널에서도 지원하지 않는다. 문법을 열지 않으면
// `[텍스트](javascript:...)` 경로가 애초에 생기지 않는다.

/** 인라인 조각 — 강조는 텍스트 안에서만 갈린다 */
export interface MarkdownInline {
  text: string;
  bold: boolean;
}

export type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; inlines: MarkdownInline[] }
  | { type: "paragraph"; inlines: MarkdownInline[] }
  /**
   * `ordered`면 번호 목록. `start`는 원문의 첫 번호로, 렌더가 `<ol start>`에
   * 그대로 넘긴다 — AI가 매긴 번호와 화면의 번호가 어긋나면 사용자가 "2번"으로
   * 답하는 경로(챗 되물음)가 깨진다.
   */
  | {
      type: "list";
      ordered: boolean;
      start: number;
      items: MarkdownInline[][];
    };

export interface ParseMarkdownOptions {
  /**
   * `#` 제목을 제목 블록으로 읽는다. 끄면 `# 발견 사항`이 마커째 평문이 된다.
   *
   * 챗에서 끄는 이유: 말풍선에 제목 계층이 필요할 만큼 긴 답변은 내보내지 않기로
   * AI팀과 합의했다. 마커를 떼어 그럴듯하게 그려 주면 합의 위반이 조용히 묻히므로,
   * 글자로 남겨 회귀가 눈에 띄게 한다.
   */
  headings?: boolean;
  /**
   * 닫히지 않은 `**`를 강조의 시작으로 보고 나머지를 굵게 렌더한다.
   *
   * 스트리밍용이다. 토큰이 한 글자씩 도착하는 동안 `**3건`은 매 프레임 지나가는
   * 중간 상태인데, 이때 별표를 글자로 내보내면 화면에서 깜빡였다 사라진다.
   * 미리 굵게 잡아 두면 닫는 `**`가 도착해도 굵기가 그대로라 글자가 튀지 않는다.
   *
   * 끄면 짝이 맞지 않는 `**`는 평문으로 남는다(정적 문서용).
   */
  danglingEmphasis?: boolean;
}

/**
 * `**강조**`만 인식한다.
 *
 * 여는 `**`와 닫는 `**` 사이에 최소 한 글자를 요구한다 — 요구하지 않으면
 * `****`가 빈 강조로 잡히고, 구분선 용도로 별표를 늘어놓은 줄이 통째로 사라진다.
 */
function parseInlines(text: string, danglingEmphasis: boolean): MarkdownInline[] {
  const out: MarkdownInline[] = [];
  // 줄바꿈은 넘지 않는다 — 블록 경계를 강조가 가로지르면 목록 항목이 붙어 버린다
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

  let rest = text.slice(cursor);

  // 남은 꼬리에 열린 채로 끝난 `**`가 있으면 그 뒤를 굵게 넘긴다.
  // 위 루프가 닫힌 쌍을 모두 소비한 뒤라, 여기 남은 `**`는 짝이 없는 것이 확실하다.
  if (danglingEmphasis && rest.length > 0) {
    const open = rest.indexOf("**");
    if (open !== -1) {
      const before = rest.slice(0, open);
      const after = rest.slice(open + 2);
      if (before.length > 0) out.push({ text: before, bold: false });
      // `**`로 끝난 순간에는 굵힐 내용이 아직 없다 — 조각을 만들지 않고 넘긴다.
      // 다음 글자가 도착하면 그때 굵게 나타난다.
      if (after.length > 0) out.push({ text: after, bold: true });
      rest = "";
    }
  }

  if (rest.length > 0) out.push({ text: rest, bold: false });

  // 전부 빈 문자열이면 조각을 만들지 않는다(빈 <span> 방지)
  return out.filter((i) => i.text.length > 0);
}

/** `- ` / `* ` 불릿. 마커 뒤 공백을 요구해 `*강조*`나 곱셈 표기와 갈린다 */
const BULLET = /^[-*]\s+(.*)$/;
/** `1. ` 번호 목록. `1)` 형태는 받지 않는다 — 합의 문법은 `1.` 하나뿐이다 */
const ORDERED = /^(\d{1,3})\.\s+(.*)$/;
/** 마커만 있고 내용이 없는 줄. 평문 분기로 흘려보내면 "#" 한 글자가 화면에 남는다 */
const EMPTY_MARKER = /^(#{1,6}|[-*]|\d{1,3}\.)$/;

/**
 * 마크다운 문자열을 블록 배열로.
 *
 * 줄 단위로만 본다 — 중첩 목록·인용·코드블록·표는 지원하지 않고 평문 문단이 된다.
 * 문법을 늘릴수록 "이건 파싱되나?"를 판단할 표면만 넓어지는데, 두 사용처 모두
 * 그 이상의 구조가 필요 없다(챗은 AI팀과 4종으로 범위를 합의했다).
 */
export function parseMarkdown(
  markdown: string,
  { headings = true, danglingEmphasis = false }: ParseMarkdownOptions = {},
): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  // 연속된 항목을 한 목록으로 묶기 위해 진행 중인 목록을 들고 간다
  let list: { ordered: boolean; start: number; items: MarkdownInline[][] } | null =
    null;

  const flushList = () => {
    if (list && list.items.length > 0) {
      blocks.push({ type: "list", ...list });
    }
    list = null;
  };

  const inlinesOf = (text: string) => parseInlines(text, danglingEmphasis);

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();

    if (line.length === 0) {
      flushList();
      continue;
    }

    if (EMPTY_MARKER.test(line)) {
      flushList();
      continue;
    }

    // 제목 — # ~ ### 까지. #### 이상은 평문으로 둔다(쓸 깊이가 아니다)
    const heading = headings ? /^(#{1,3})\s+(.*)$/.exec(line) : null;
    if (heading) {
      flushList();
      const inlines = inlinesOf(heading[2]);
      if (inlines.length > 0) {
        blocks.push({
          type: "heading",
          level: heading[1].length as 1 | 2 | 3,
          inlines,
        });
      }
      continue;
    }

    const bullet = BULLET.exec(line);
    const ordered = bullet ? null : ORDERED.exec(line);
    if (bullet || ordered) {
      const isOrdered = ordered !== null;
      const content = ordered ? ordered[2] : bullet![1];
      const inlines = inlinesOf(content);
      if (inlines.length > 0) {
        // 종류가 바뀌면(불릿↔번호) 별개의 목록이다 — 한 <ul>에 섞으면 마커가 뒤엉킨다
        if (list && list.ordered !== isOrdered) flushList();
        list ??= {
          ordered: isOrdered,
          // 번호 목록은 원문의 첫 번호에서 시작한다. AI가 `3.`부터 보냈다면
          // 화면도 3부터여야 사용자가 부르는 번호와 서버가 아는 번호가 맞는다.
          start: ordered ? Number(ordered[1]) : 1,
          items: [],
        };
        list.items.push(inlines);
      }
      continue;
    }

    flushList();
    const inlines = inlinesOf(line);
    if (inlines.length > 0) blocks.push({ type: "paragraph", inlines });
  }

  flushList();
  return blocks;
}
