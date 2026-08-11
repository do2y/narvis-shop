"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/shared/ui/button";
import { PREDICATE_ORDER } from "../types";
import { PREDICATE_STYLE } from "../predicateStyle";

/**
 * 취향이 0개일 때의 대표 카드 — `SummaryCard` 를 통째로 대신한다.
 *
 * ## 왜 별도 컴포넌트인가
 * 데이터가 없을 때 `SummaryCard` 를 그대로 그리면, 왼쪽 열(결론 문장·단서·최근
 * 관심)이 전부 조건부라 통째로 사라지고 오른쪽 "0개" 한 줄만 남는다. 제목은
 * 왼쪽 위, 문장 하나는 오른쪽에 떨어져 **로딩이 덜 된 화면처럼** 보였다.
 * 2열 골격 자체가 "채울 것이 둘"이라는 전제 위에 있어서, 빈 상태에서는
 * 유지할 이유가 없다. 그래서 빈 상태 전용 레이아웃으로 갈아끼운다.
 *
 * ## 무엇이 유지되고 무엇이 바뀌나
 * - 유지: 옅은 브랜드 배경 · 로고색 상단 라인 · `rounded-lg` — 데이터가 없어도
 *   이 카드가 페이지의 첫 번째 카드라는 위계는 같다. 회색 비활성 면으로
 *   떨어뜨리지 않는다.
 * - 바뀜: 2열 → 텍스트 그룹 하나(왼쪽 정렬, 최대 너비 제한) + 오른쪽 작은 그래픽.
 *   가운데 정렬하지 않는 이유는 이 페이지의 헤더·다른 섹션이 전부 왼쪽
 *   정렬이라, 이 카드만 중앙 정렬하면 빈 상태가 다른 화면처럼 튄다.
 *
 * ## 높이
 * 고정 높이를 두지 않는다. 채워진 카드(요약 문단 + 단서 + 칩 + 분포)와
 * 대략 비슷한 높이로 떨어져, 취향이 처음 생겼을 때 카드가 크게 튀지 않는다.
 */
export function EmptySummaryCard() {
  return (
    <section
      aria-labelledby="preference-summary-heading"
      className="relative overflow-hidden rounded-lg border border-brand/15 bg-brand/[0.035] px-4 py-5 sm:px-7 sm:py-7"
    >
      {/* 채워진 카드와 같은 로고색 라인 — 빈 상태여도 대표 카드임은 같다 */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,#8FB4F2,#8FD3A6_55%,#F0D274)]"
      />

      {/* 모바일은 items-start 로 좁히지 않는다 — 그러면 자식이 콘텐츠 폭으로
          줄어들어 CTA 의 `w-full`(카드 폭 채우기)이 먹지 않는다. 그래픽만
          self-start 로 왼쪽에 붙인다 */}
      <div className="flex flex-col-reverse gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        {/*
          제목 → 핵심 안내 → 보조 설명 → CTA 가 한 덩어리로 읽히도록 묶는다.

          max-w-lg(32rem=512px): 안내 문장이 **넓은 화면에서 한 줄에 들어가는**
          최소 단계다. 그 문장의 실제 폭이 약 497px 이라 sm(384)·md(448)에서는
          어절 하나가 다음 줄로 떨어져 어색하게 끊겼다.

          더 넓히지는 않는다 — 이 열은 옆 그래픽과 카드 패딩을 빼면 약 616px 을
          쓸 수 있어(마이페이지 셸 max-w-6xl · 사이드바 224 · gap 48 기준)
          lg 로도 여유가 있고, 그 이상은 한 줄이 길어져 읽기 흐름이 나빠진다.
        */}
        <div className="flex min-w-0 max-w-lg flex-col items-start max-sm:w-full">
          {/*
            `취향 요약` 라벨은 화면에서 뺐다 — 빈 상태에서는 요약할 것이 없어
            제목이 내용 없는 머리말로 떠 있고, 바로 아래 "아직 발견한 취향이
            없어요"가 실질적인 제목 역할을 한다.

            대신 sr-only 로 남긴다. 지우면 이 섹션의 `aria-labelledby` 가
            없는 id 를 가리켜 라벨 없는 region 이 된다.
          */}
          <h2 id="preference-summary-heading" className="sr-only">
            취향 요약
          </h2>

          {/*
            "지금까지 0개의 취향이 쌓였어요"에서 바꿨다. 개수를 굵게 세우면
            0이 이 카드의 핵심 정보가 되는데, 0은 사용자가 알아야 할 값이
            아니라 아직 시작 전이라는 상태일 뿐이다. 숫자를 지우고 상태로 쓴다.
          */}
          <p className="text-[15px] font-bold tracking-tight break-keep sm:text-lg">
            아직 발견한 취향이 없어요
          </p>
          {/*
            제목과 한 덩어리로 읽히도록 바짝 붙인다(mt-1.5).

            break-keep: 한국어는 기본 줄바꿈이 글자 단위라 "모여 / 요." 처럼
            어절 한가운데가 잘린다. 어절을 통째로 넘겨 띄어쓰기에서만 끊는다.
          */}
          <p className="mt-1.5 text-[13px] leading-relaxed break-keep text-muted-foreground sm:text-sm">
            나비스와 이야기하다 보면 좋아하는 브랜드와 조건이 이곳에 하나씩
            모여요.
          </p>

          {/*
            취향이 생기는 실제 경로는 채팅(대화)과 구매다. 그중 지금 바로
            할 수 있는 쪽만 버튼으로 준다 — 구매는 "가서 사세요"가 되어
            빈 상태에서 꺼낼 말이 아니다.

            ## 왜 브랜드 채움인가
            테두리 버튼이었는데 브랜드 채움으로 올렸다. 옅은 브랜드 배경
            위에 브랜드색 **테두리**만 두니 대비가 낮아 비활성처럼 읽혔다.
            이 카드에서 유일한 행동이라 위계를 명확히 세운다.

            검정(`variant="default"` = bg-primary)을 쓰지 않는 이유: 앱에서
            검정 채움은 결제·주문 급의 무게고, 여기 파스텔 그래픽 옆에서
            혼자 무채색이라 겉돈다. `--brand`(딥 블루) 단색은 랜딩 히어로
            CTA와 같은 처리라(BuyerHero) 앱 안에서 이미 "AI 기능의 대표
            행동" 자리를 뜻한다. 그라데이션은 쓰지 않는다 — 상단 로고색
            라인과 경쟁하고, 이 화면에 그라데이션 면은 중심 원 하나로 족하다.

            대비: --brand(#2a63b8) 위 --brand-foreground(≈ #fafafa)는
            5.63:1 로 AA(4.5:1)를 넘는다.

            ## 크기·형태
            공통 `buttonVariants` 의 size 는 h-6~h-9 라 터치 타겟(h-11)에
            못 미친다. 그래서 base 클래스(포커스 링·disabled·transition)만
            가져오고 높이·패딩·radius 만 덮어쓴다.
            h-11(44px) · px-5(20px) · rounded-xl(=radius*1.4 ≈ 14px).
            앱의 다른 브랜드 CTA 는 rounded-full 이지만, 여기서는 캡슐이
            지나치게 길어 보여 한 단계 각지게 둔다.

            ## 문구
            "취향 찾으러 가기"는 목적지가 채팅인데 그 사실을 감춘다.
            "나비스와 이야기하기"는 무엇을 하러 가는지가 분명하고, 옆
            문장("나비스와 이야기하다 보면…")과 같은 말이라 이어진다.
            화살표는 이동임을 알리는 용도로 작게(size-4)만 둔다 —
            로봇·말풍선·반짝임 같은 AI 관용 아이콘은 쓰지 않는다.

            ## 인터랙션
            hover 는 살짝 어둡게(brand/90) + 1px 떠오름, active 는 눌림.
            base 클래스에 `active:translate-y-px` 가 있어 그대로 살리고,
            hover 의 -1px 과 합쳐 눌리는 느낌이 분명해진다.
            `motion-reduce` 로 이동·전환을 끈다.

            ## 반응형
            모바일(<sm)은 `w-full` — 카드 폭에 맞춰 채운다. 좁은 화면에서
            글자만큼만 좁은 버튼은 누르기 어렵고 카드 안에서 떠 보인다.
          */}
          <Link
            href="/chat"
            className={cn(
              buttonVariants(),
              "mt-5 h-11 w-full rounded-xl px-4 text-[13px] font-semibold sm:mt-7 sm:w-auto sm:px-5 sm:text-sm",
              "bg-brand text-brand-foreground",
              "transition-[transform,background-color] duration-150 ease-out-strong",
              "hover:[@media(hover:hover)]:-translate-y-px hover:[@media(hover:hover)]:bg-brand/90",
              "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
            )}
          >
            나비스와 이야기하기
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <ConvergingDots />
      </div>
    </section>
  );
}

/**
 * 빈 상태 그래픽 — **취향이 모여 내가 된다**를 작게 줄인 추상 그림.
 *
 * 관계도의 중심 노드와 같은 문법을 쓴다: 여러 취향 색이 가운데 하나로 모인다.
 * 다만 관계도를 축소해 그대로 보여주지는 않는다 — 그러면 "데이터가 있는 것처럼"
 * 보이고, 실제 그래프가 생겼을 때 같은 그림을 두 번 본 셈이 된다.
 * 여기서는 **아직 도착하지 않은 상태**를 그린다:
 *   - 중심 원은 점선(아직 채워지지 않았다)이고 안은 로고색 그라데이션이 아주 옅다
 *   - 관계 5색 점이 중심을 향해 놓이고, 각 점에서 중심으로 짧은 점선이 뻗는다
 *
 * 색은 `PREDICATE_STYLE.tint` 를 그대로 쓴다 — 취향이 쌓여 관계도가 그려졌을 때
 * 같은 색이 같은 자리에서 이어진다.
 *
 * 순수 장식이라 스크린리더에서 뺀다(옆 문단이 같은 내용을 이미 말한다).
 * 애니메이션은 넣지 않는다 — 회전·점멸은 로딩 중으로 오독된다.
 */
function ConvergingDots() {
  const SIZE = 132;
  const c = SIZE / 2;
  /** 중심 원 반지름 — 바깥 점과 겹치지 않을 만큼만 */
  const R = 26;
  /** 점이 놓이는 궤도 반지름 */
  const ORBIT = 52;

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="size-24 shrink-0 self-start sm:size-32 sm:self-auto"
    >
      <defs>
        {/* 로고색 3색 — 카드 상단 라인과 같은 순서(파랑→초록→노랑) */}
        <linearGradient id="empty-center" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8FB4F2" stopOpacity={0.28} />
          <stop offset="55%" stopColor="#8FD3A6" stopOpacity={0.28} />
          <stop offset="100%" stopColor="#F0D274" stopOpacity={0.28} />
        </linearGradient>
      </defs>

      {/* 관계 5종 — 점 + 중심으로 향하는 짧은 점선.
          각도는 위(-90°)에서 시작해 균등 분할. 데이터가 아니라 도식이라
          레이아웃 계산(graphLayout)을 끌어오지 않는다 */}
      {PREDICATE_ORDER.map((predicate, i) => {
        const angle =
          (-90 + (360 / PREDICATE_ORDER.length) * i) * (Math.PI / 180);
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const { tint } = PREDICATE_STYLE[predicate];

        return (
          <g key={predicate}>
            {/* 점 → 중심 방향으로 뻗다가 중심 원 앞에서 멈춘다 —
                닿아 있으면 이미 연결이 완성된 그림이 된다 */}
            <line
              x1={c + dx * (ORBIT - 7)}
              y1={c + dy * (ORBIT - 7)}
              x2={c + dx * (R + 7)}
              y2={c + dy * (R + 7)}
              stroke={tint}
              strokeWidth={1.5}
              strokeOpacity={0.45}
              strokeLinecap="round"
              strokeDasharray="2 4"
            />
            <circle
              cx={c + dx * ORBIT}
              cy={c + dy * ORBIT}
              r={4}
              fill={tint}
              fillOpacity={0.75}
            />
          </g>
        );
      })}

      {/* 중심 — 아직 완성되지 않은 `나`.
          점선 테두리 + 아주 옅은 로고색 면. 관계도의 중심 노드처럼 글자를
          넣지는 않는다(작아서 안 읽히고, 넣으면 축소판처럼 보인다) */}
      <circle cx={c} cy={c} r={R} fill="url(#empty-center)" />
      <circle
        cx={c}
        cy={c}
        r={R}
        fill="none"
        className="stroke-brand/35"
        strokeWidth={1.5}
        strokeDasharray="3 5"
      />
    </svg>
  );
}
