"use client";

import { parseMarkdown, type MarkdownInline } from "@/shared/utils/markdown";

/**
 * 챗 말풍선 본문 — CH-2 `token.text`를 렌더한다.
 *
 * 지원 문법은 AI팀과 합의한 4종뿐이다: 줄바꿈 · `-` 불릿 · `1.` 번호 · `**강조**`.
 * 제목·링크·이미지·표·코드블록·인용·수평선·중첩 목록·HTML은 전부 평문으로 나간다.
 *
 * 보안: 파서가 HTML을 해석하지 않고 여기서도 dangerouslySetInnerHTML을 쓰지 않는다.
 * 말풍선에는 **사용자 발화와 판매자가 등록한 상품·옵션명**이 그대로 실릴 수 있어
 * AI 문장만 온다고 가정할 수 없다. `<img onerror=...>`가 와도 글자로 나간다.
 * shared/utils/markdown.ts 상단 주석 참조.
 */

function Inlines({ inlines }: { inlines: MarkdownInline[] }) {
  return (
    <>
      {inlines.map((inline, i) =>
        inline.bold ? (
          <strong key={i} className="font-semibold">
            {inline.text}
          </strong>
        ) : (
          <span key={i}>{inline.text}</span>
        ),
      )}
    </>
  );
}

export function MessageMarkdown({ text }: { text: string }) {
  const blocks = parseMarkdown(text, {
    // 합의 범위 밖 — `# 제목`은 마커째 글자로 남겨 회귀가 눈에 띄게 한다
    headings: false,
    // 스트리밍 중 열린 `**`를 미리 굵게 — 별표가 깜빡였다 사라지지 않게
    danglingEmphasis: true,
  });

  // 문법만 있고 내용이 없으면 빈 자리를 남기지 않는다.
  // (스트리밍 첫 프레임의 빈 문자열은 호출부가 타이핑 표시로 대체한다)
  if (blocks.length === 0) return null;

  return (
    // gap-2: 말풍선 안이라 문단 사이를 넓게 벌리면 버블만 길어진다.
    // 한 덩어리로 읽히되 문단 경계는 보이는 정도.
    <span className="flex flex-col gap-2">
      {blocks.map((block, i) => {
        if (block.type === "list") {
          const Tag = block.ordered ? "ol" : "ul";
          return (
            <Tag
              key={i}
              start={block.ordered ? block.start : undefined}
              // 마커를 직접 그리지 않고 브라우저 기본 마커를 쓴다 — 번호 목록은
              // 항목이 늘어도 번호가 자동으로 이어지고, `start`로 원문의 첫 번호를
              // 그대로 옮길 수 있다(사용자가 "2번"이라 부를 번호와 어긋나면 안 된다).
              // ps-5: 마커가 말풍선 왼쪽 패딩 밖으로 삐져나가지 않을 만큼만.
              className="flex list-outside flex-col gap-1 ps-5"
              style={{ listStyleType: block.ordered ? "decimal" : "disc" }}
            >
              {block.items.map((item, j) => (
                // min-w-0: 긴 상품명이 안 꺾이고 말풍선을 밀어내지 않게
                <li key={j} className="min-w-0">
                  <Inlines inlines={item} />
                </li>
              ))}
            </Tag>
          );
        }

        return (
          // whitespace-pre-wrap: 파서가 줄 단위로만 보므로 문단 안의 공백·들여쓰기는
          // 원문 그대로 남는다. 부모에서 이 클래스를 뗐으니 여기서 유지한다.
          <span key={i} className="whitespace-pre-wrap">
            <Inlines inlines={block.inlines} />
          </span>
        );
      })}
    </span>
  );
}
