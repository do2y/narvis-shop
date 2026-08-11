// 요약 문단(M-11 `markdown`)을 렌더 가능한 블록으로 쪼갠다.
//
// 파서 본체는 shared/utils/markdown.ts 에 있다 — 챗 말풍선(CH-2 `token.text`)이
// 같은 파서를 쓰게 되면서 승격했다. 여기서는 요약에 맞는 설정만 고정한다.
//
// 보안(HTML을 파싱하지 않는 이유)은 그쪽 상단 주석 참조.

import {
  parseMarkdown,
  type MarkdownBlock,
  type MarkdownInline,
} from "@/shared/utils/markdown";

export type SummaryInline = MarkdownInline;
export type SummaryBlock = MarkdownBlock;

/**
 * 요약은 정적 문서다 — 스트리밍이 아니라 완성된 문자열이 한 번에 온다.
 * 그래서 짝이 맞지 않는 `**`는 미완성이 아니라 LLM의 실수이므로 평문으로 남긴다
 * (`danglingEmphasis` 기본값 false). 제목은 요약 패널의 라벨로 쓰므로 켠다.
 */
export function parseSummary(markdown: string): SummaryBlock[] {
  return parseMarkdown(markdown, { headings: true });
}
