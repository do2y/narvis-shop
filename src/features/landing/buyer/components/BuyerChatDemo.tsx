"use client";

import { Check, ShoppingCart, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/shared/utils/formatPrice";
import { useDemoSequence } from "../../hooks/useDemoSequence";
import { useTypeOnce } from "../../hooks/useTypeOnce";
import { DemoBar, DemoFrame } from "../../ui";
import { TONE_CLASS, type DemoScenario } from "../scenarios";

/**
 * 소비자 대화 데모 — 질문에서 장바구니까지 한 흐름을 자동 재생한다.
 *
 * 실제 채팅 화면(`features/chat`)을 그대로 축소하지 않는다. 그 화면에는 입력창·
 * 세션 안내·찜 버튼·새 대화 버튼이 함께 있는데, 랜딩에서 320px 폭으로 줄이면
 * 전부 읽히지 않는 장식이 된다. **메시지·조건 칩·추천 카드**만 남겨 같은 디자인
 * 언어(말풍선 모양·칩 형태·카드 구성)로 다시 조립했다.
 *
 * ## 장면
 * 0 질문 타이핑 → 1 조건 분석 → 2 칩 등장 → 3 답변 → 4 카드 →
 * 5 후속 요청 → 6 옵션 확인 → 7 담기 완료
 *
 * 한 장면에서 한 가지만 움직인다(요구사항). 카드 3장은 예외처럼 보이지만
 * stagger로 60ms씩 밀어 "차례로 놓이는 하나의 동작"으로 읽히게 했다.
 *
 * ## 접근성
 * 이 데모는 본문 텍스트가 이미 설명하는 내용을 **그림으로 반복**하는 것이라
 * 호출부에서 `aria-hidden`을 건다. 스크린리더가 타이핑 중인 글자를 한 자씩
 * 읽거나 장면이 바뀔 때마다 같은 문장을 다시 읽는 것을 막는다.
 */
export function BuyerChatDemo({
  scenario,
  /** 화면에 들어오기 전에는 재생하지 않는다 — 보이지 않는 애니메이션은 값이 없다 */
  active,
}: {
  scenario: DemoScenario;
  active: boolean;
}) {
  const { resetting, reducedMotion, reached } = useDemoSequence(
    // 각 장면 체류 시간. 읽을 글자가 많은 장면(답변·완료)에 더 준다.
    [2100, 900, 1500, 1700, 2400, 1500, 1400, 2000],
    { paused: !active, loopDelayMs: 3200 },
  );

  const typing = useTypeOnce(scenario.question, {
    charMs: 42,
    // 재생 중이고 첫 장면일 때만 친다. 모션 감소면 완성 문장을 바로 보여준다.
    enabled: active && !reducedMotion,
  });

  const target = scenario.products[scenario.followUp.targetIndex];

  return (
    <DemoFrame dimmed={resetting} className="flex h-full flex-col">
      <DemoBar>Narvis 쇼핑 채팅</DemoBar>

      {/*
        높이를 고정한다. 장면마다 내용이 늘어나는데 높이가 따라 늘면 아래 섹션이
        계속 밀려 스크롤 위치가 흔들린다(CLS). 넘치는 만큼은 아래에서 잘리고,
        마지막 장면이 항상 보이도록 `justify-end`로 아래쪽에 붙인다 —
        실제 채팅도 새 메시지가 아래에 쌓인다.
      */}
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-hidden p-4 sm:gap-3.5 sm:p-5">
        {/* ① 사용자 질문 */}
        <Row side="user" show>
          {typing.text}
          {/* 커서는 타이핑 중에만 — 멈춘 뒤에도 깜빡이면 "아직 입력 중"으로 읽힌다 */}
          {!typing.done && (
            <span
              aria-hidden
              className="ml-0.5 inline-block h-[1em] w-px translate-y-[2px] bg-primary-foreground/70 motion-safe:animate-pulse"
            />
          )}
        </Row>

        {/* ② 조건 분석 — 진행 문구. 실제 progress 이벤트가 오는 자리다 */}
        {reached(1) && !reached(3) && (
          <Row side="ai" plain show>
            <span className="flex items-center gap-2 text-muted-foreground">
              <Dots />
              조건을 분석하고 있어요
            </span>
          </Row>
        )}

        {/* ③ 조건 칩 — 순차 등장 */}
        {reached(2) && (
          <div className="flex flex-wrap gap-1.5 pl-1">
            {scenario.chips.map((chip, i) => (
              <span
                key={chip.field}
                style={{ transitionDelay: `${i * 90}ms` }}
                className={cn(
                  "flex items-center gap-1 rounded-full bg-muted py-1 pl-2.5 pr-1.5 text-xs text-muted-foreground",
                  "transition-[opacity,transform] duration-300 ease-out-strong",
                  "motion-reduce:transition-opacity",
                  reached(2)
                    ? "translate-y-0 opacity-100"
                    : "translate-y-1 opacity-0",
                )}
              >
                {chip.label}
                {/* 실제 화면과 같은 X — "이 조건은 뺄 수 있다"가 이 데모의 요점이다 */}
                <span
                  aria-hidden
                  className="flex size-4 items-center justify-center rounded-full"
                >
                  <X className="size-3" />
                </span>
              </span>
            ))}
          </div>
        )}

        {/* ④ 답변 */}
        {reached(3) && (
          <Row side="ai" show>
            {scenario.answer}
          </Row>
        )}

        {/* ⑤ 추천 카드 — 가로 스크롤 대신 좁은 화면에서 1열로 접는다 */}
        {reached(4) && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {scenario.products.map((p, i) => (
              <DemoCard
                key={p.id}
                product={p}
                index={i}
                // 후속 요청 장면부터 대상 카드를 강조한다 —
                // "두 번째"가 어느 것인지 말이 아니라 화면으로 가리킨다
                highlighted={reached(5) && i === scenario.followUp.targetIndex}
                dimmed={reached(5) && i !== scenario.followUp.targetIndex}
              />
            ))}
          </div>
        )}

        {/* ⑥ 후속 요청 */}
        {reached(5) && (
          <Row side="user" show>
            {scenario.followUp.request}
          </Row>
        )}

        {/* ⑦ 옵션 확인 — 사용자 확인 없이 진행되지 않는다는 걸 보여주는 장면 */}
        {reached(6) && scenario.followUp.option && (
          <Row side="ai" show>
            <span className="flex flex-wrap items-center gap-2">
              옵션을 선택해 주세요
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium",
                  "transition-colors duration-300 ease-out-strong",
                  reached(7)
                    ? "border-brand bg-brand/10 text-brand"
                    : "text-muted-foreground",
                )}
              >
                {scenario.followUp.option}
              </span>
            </span>
          </Row>
        )}

        {/* ⑧ 담기 완료 */}
        {reached(7) && (
          <div
            className={cn(
              "flex items-start gap-2 rounded-sm bg-brand/10 px-3 py-2.5 text-[13px] font-medium text-brand",
              "transition-[opacity,transform] duration-300 ease-out-strong",
              "motion-reduce:transition-opacity",
              "translate-y-0 opacity-100",
            )}
          >
            <Check className="mt-0.5 size-4 shrink-0" />
            <span>{scenario.followUp.doneMessage}</span>
          </div>
        )}
      </div>

      {/* 장바구니 요약 — 완료 시 개수가 오른다. 대화가 실제 행동으로
          이어졌다는 것을 화면 밖 상태 변화로 확인시킨다 */}
      <div className="flex h-12 shrink-0 items-center justify-between border-t bg-muted/30 px-4 text-xs">
        <span className="text-muted-foreground">
          {reached(7) ? "장바구니에 담겼어요" : "대화로 담을 수 있어요"}
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5 font-semibold tabular-nums",
            "transition-colors duration-300 ease-out-strong",
            reached(7) ? "text-brand" : "text-muted-foreground",
          )}
        >
          <ShoppingCart className="size-3.5" />
          {reached(7) ? 1 : 0}
          {reached(7) && target && (
            <span className="font-medium">· {formatPrice(target.price)}</span>
          )}
        </span>
      </div>
    </DemoFrame>
  );
}

/**
 * 말풍선 한 줄. 실제 `MessageList`의 모양을 따른다 —
 * 사용자는 오른쪽 검정 말풍선(`rounded-tr-sm`), AI는 왼쪽 회색(`rounded-tl-sm`).
 * 랜딩에서는 아바타를 뺐다(28px 아이콘이 반복되면 좁은 폭에서 글자 자리를 먹는다).
 */
function Row({
  side,
  children,
  show,
  plain = false,
}: {
  side: "user" | "ai";
  children: React.ReactNode;
  show: boolean;
  /** 말풍선 없이 글자만 — 진행 상태 표시용 */
  plain?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex",
        side === "user" ? "justify-end" : "justify-start",
        "transition-[opacity,transform] duration-300 ease-out-strong",
        "motion-reduce:transition-opacity motion-reduce:translate-y-0",
        show ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
    >
      <span
        className={cn(
          "max-w-[86%] text-[13px] leading-relaxed",
          plain
            ? "px-1 py-0.5"
            : side === "user"
              ? "rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 tracking-tight text-primary-foreground"
              : "rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2",
        )}
      >
        {children}
      </span>
    </div>
  );
}

/** 응답 대기 점 3개 — 실제 채팅의 TypingIndicator와 같은 표현 */
function Dots() {
  return (
    <span aria-hidden className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1 rounded-full bg-muted-foreground/60 motion-safe:animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

/**
 * 랜딩용 상품 카드.
 *
 * 실제 `ChatProductCard`에서 **추천 이유**를 남기고 찜·담기 버튼을 뺐다.
 * 랜딩 카드는 누를 수 없는 그림인데 버튼이 보이면 눌러도 아무 일이 없어 고장으로
 * 읽힌다. 대신 이유 문구를 카드에서 가장 눈에 띄는 자리에 둔다 —
 * "왜 이 상품인지 함께 알려준다"가 이 데모가 증명하려는 것이다.
 */
function DemoCard({
  product,
  index,
  highlighted,
  dimmed,
}: {
  product: import("../scenarios").DemoProduct;
  index: number;
  highlighted: boolean;
  dimmed: boolean;
}) {
  const hasDiscount = product.originalPrice > product.price;

  return (
    <article
      style={{ transitionDelay: `${index * 60}ms` }}
      className={cn(
        "flex flex-col overflow-hidden rounded-sm border bg-background",
        "transition-[opacity,transform,border-color,box-shadow] duration-300 ease-out-strong",
        "motion-reduce:transition-[opacity,border-color]",
        highlighted && "border-brand shadow-[0_0_0_1px_var(--brand)]",
        dimmed ? "opacity-40" : "opacity-100",
      )}
    >
      {/* 이미지 자리 — 순번을 함께 적는다. "두 번째 상품"이라는 말과
          화면의 카드를 잇는 유일한 단서라 장식이 아니다 */}
      <div
        className={cn(
          "relative flex h-16 items-end justify-between p-2 sm:h-20",
          TONE_CLASS[product.tone],
        )}
      >
        <span className="rounded-full bg-background/85 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-foreground">
          {index + 1}
        </span>
        {product.group && (
          <span className="rounded-full bg-background/85 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {product.group}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <span className="text-[10px] font-medium text-muted-foreground">
          {product.brandName}
        </span>
        <h4 className="product-card-two-line text-[11px] font-semibold [--product-card-two-line-lh:1.375]">
          {product.name}
        </h4>
        <p className="product-card-two-line text-[11px] text-brand [--product-card-two-line-lh:1.375]">
          {product.reason}
        </p>
        <div className="mt-auto flex flex-wrap items-baseline gap-x-1.5 pt-1">
          <span className="text-xs font-bold tabular-nums">
            {formatPrice(product.price)}
          </span>
          {hasDiscount && (
            <span className="text-[10px] tabular-nums text-muted-foreground line-through">
              {formatPrice(product.originalPrice)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
