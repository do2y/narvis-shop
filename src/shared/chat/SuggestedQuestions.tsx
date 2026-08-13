"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

interface SuggestedQuestionsProps {
  questions: string[];
  onSelect: (question: string) => void;
  disabled?: boolean;
}

/**
 * 추천 질문 — 입력창 위 보조 선택지. 클릭 시 해당 문장으로 대화를 시작한다.
 *
 * 종전에는 캡슐 버튼이 왼쪽부터 여러 줄로 흘러넘쳤다. 문구 길이가 제각각이라
 * 줄마다 끝나는 지점이 달라 정렬이 무너져 보였고, 네 개가 2~3줄을 차지해
 * 입력창과 한 덩어리의 큰 버튼 묶음처럼 읽혔다.
 *
 * 여기서는 **한 줄 가로 스크롤**로 바꾼다. 좁은 채팅 패널에서 긴 문장 네 개를
 * 다 펼칠 방법은 없고, 억지로 2열 그리드에 끼우면 문구가 잘린다. 한 줄로 두면
 * 높이가 고정되고(칩 하나 높이), 잘린 다음 칩이 "옆에 더 있다"를 알려준다.
 */
export function SuggestedQuestions({
  questions,
  onSelect,
  disabled,
}: SuggestedQuestionsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (questions.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {/* 칩이 무엇인지 한 마디로 알려준다 — 없으면 버튼 네 개가 왜 거기 있는지
          맥락 없이 놓인다. 입력창 좌측 정렬선에 맞춘다(px-1). */}
      <p className="px-1 text-xs text-muted-foreground">
        이런 질문을 해보세요
      </p>

      {/* fade(mask-image)는 쓰지 않는다 — 오른쪽 끝을 투명으로 깎으면 마지막 칩의
          글자가 흐려져 "잘렸다"가 아니라 "글씨가 지워졌다"로 보인다. 스크롤 가능
          신호는 잘린 다음 칩이 이미 충분히 준다(끝에 닿기 전에는 항상 일부가 보인다). */}
      {/* -mx-4 + px-4: 부모(p-4) 밖으로 흘려 화면 끝까지 스크롤되게 하되,
          첫 칩과 마지막 칩은 입력창 정렬선 안에서 시작·끝난다. */}
      <div className="-mx-4">
        <div
          ref={scrollRef}
          // 마우스 휠은 세로(deltaY)만 준다 — 가로 스크롤러는 기본적으로 반응하지 않아
          // "스크롤이 안 된다"가 된다(트랙패드 좌우 스와이프·드래그는 원래 동작).
          // 세로 델타를 가로 이동으로 옮겨 휠만 있는 마우스에서도 넘길 수 있게 한다.
          onWheel={(e) => {
            const el = scrollRef.current;
            if (!el) return;
            // 이미 가로 성분이 있으면(트랙패드) 브라우저 기본 동작에 맡긴다
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
            const max = el.scrollWidth - el.clientWidth;
            if (max <= 0) return;
            const next = Math.min(max, Math.max(0, el.scrollLeft + e.deltaY));
            // 끝에 닿았으면 페이지 세로 스크롤을 막지 않는다 — 가두면 대화가 안 내려간다
            if (next === el.scrollLeft) return;
            e.preventDefault();
            el.scrollLeft = next;
          }}
          className={cn("flex gap-1.5 overflow-x-auto px-4", "scrollbar-none")}
        >
          {questions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onSelect(q)}
              disabled={disabled}
              className={cn(
                // 높이를 고정해 문구 길이와 무관하게 같은 띠로 읽히게 한다.
                // whitespace-nowrap 이 없으면 긴 문구가 2줄이 되어 혼자 높이가 달라진다.
                "flex h-8 shrink-0 items-center whitespace-nowrap",
                // radius 를 낮춘다 — 캡슐(rounded-full)은 통통해 보여 주 액션처럼 읽힌다
                "rounded-sm border px-2.5 text-xs",
                "bg-background text-muted-foreground",
                // hover 는 아주 미세하게 — 이동·확대 없이 면과 글자색만 한 단 바뀐다
                "transition-colors duration-150 ease-out-strong",
                "hover:[@media(hover:hover)]:bg-muted hover:[@media(hover:hover)]:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:pointer-events-none disabled:opacity-40",
              )}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
