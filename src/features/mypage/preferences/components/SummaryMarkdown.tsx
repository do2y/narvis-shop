"use client";

import { parseSummary, type SummaryInline } from "../parseSummary";

/**
 * 좌상단 요약 문단 — M-11 `markdown` 필드를 렌더한다.
 *
 * "AI가 나를 이렇게 이해했다"를 문장으로 보여주는 영역이고, 그래프와 **같은
 * 데이터의 다른 표현**이다. 항목을 지우면 다음 갱신 때 문단에서도 사라지는데
 * 즉시는 아니라, 문단과 트리가 잠시 어긋나 보일 수 있다(노션 3.0).
 *
 * 보안: 파서가 HTML을 해석하지 않고 여기서도 dangerouslySetInnerHTML을 쓰지
 * 않는다. LLM이 만든 문자열에 <script>가 섞여 와도 React가 이스케이프해
 * 글자로 나간다. parseSummary.ts 상단 주석 참조.
 */

// 제목은 h3~h5로 낮춘다 — 페이지 제목(h2)보다 아래여야 문서 위계가 맞는다.
const HEADING_TAG = { 1: "h3", 2: "h4", 3: "h5" } as const;

function Inlines({ inlines }: { inlines: SummaryInline[] }) {
  return (
    <>
      {inlines.map((inline, i) =>
        inline.bold ? (
          <strong key={i} className="font-semibold text-foreground">
            {inline.text}
          </strong>
        ) : (
          <span key={i}>{inline.text}</span>
        ),
      )}
    </>
  );
}

export function SummaryMarkdown({ markdown }: { markdown: string }) {
  const blocks = parseSummary(markdown);

  // 문법만 있고 내용이 없는 문자열이 올 수 있다 — 그때는 빈 자리를 남기지 않는다.
  // (markdown: null 인 경우는 호출부가 빈 상태 문구로 대체한다)
  if (blocks.length === 0) return null;

  return (
    // gap-3 → gap-2: 블록이 3개(제목·핵심문장·근거목록)뿐이라 사이가 넓으면
    // 짧은 내용이 세로로 늘어져 그래프를 밀어낸다
    <div className="flex flex-col gap-2 text-muted-foreground">
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          const Tag = HEADING_TAG[block.level];
          return (
            <Tag
              key={i}
              // 요약 제목은 패널 라벨 역할이라 작고 조용하게 — 본문(핵심 문장)이
              // 가장 크게 읽혀야 위계가 맞는다
              className="text-[11px] font-semibold uppercase leading-none tracking-[0.08em] text-muted-foreground"
            >
              <Inlines inlines={block.inlines} />
            </Tag>
          );
        }

        if (block.type === "list") {
          return (
            /*
              근거 항목 — **2열로 편다.**

              항목 하나가 "소니 제품을 선호로 등록하셨어요" 정도라 한 열로 쌓으면
              오른쪽이 통째로 비고 패널만 세로로 길어진다. 넓은 화면에서 2열이면
              같은 내용이 절반 높이에 들어가, 접지 않고도 그래프가 접힘선 위에
              남는다(요약을 감추지 않기 위한 대가를 여기서 치른다).

              좁은 화면에서는 1열로 돌아간다 — 2열에서 문장이 꺾이는 것보다 낫다.
              `leading-snug`: 짧은 문장이라 relaxed 만큼의 행간이 필요 없다.
              긴 이름이 줄바꿈돼도 불릿은 `mt-[0.45em]` 로 첫 줄에 붙어 정렬이
              흐트러지지 않는다.
            */
            <ul
              key={i}
              className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2"
            >
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2 leading-snug">
                  <span
                    aria-hidden="true"
                    className="mt-[0.45em] size-1 shrink-0 rounded-full bg-muted-foreground/50"
                  />
                  <span className="min-w-0">
                    <Inlines inlines={item} />
                  </span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          // 핵심 요약 문장 — 이 패널에서 가장 먼저 읽혀야 하는 줄.
          // 크기는 유지하고 행간만 좁힌다(snug) — 이 줄이 작아지면 위계가 무너진다
          <p
            key={i}
            className="text-[15px] leading-snug text-foreground/90"
          >
            <Inlines inlines={block.inlines} />
          </p>
        );
      })}
    </div>
  );
}
