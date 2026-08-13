"use client";

import { cn } from "@/lib/utils";
import { ProductImage } from "@/shared/ui/ProductImage";
import { MessageMarkdown } from "./MessageMarkdown";
import type { ChatMessage } from "./store";

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  /** 진행 상태 문구(progress 이벤트, 구매자·판매자 공용). 답변 전 로딩 표시용 */
  progress?: string | null;
  showUserAvatar?: boolean;
  onRetry: () => void;
}

function TypingIndicator() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="입력 중">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

export function MessageList({
  messages,
  isStreaming,
  progress,
  showUserAvatar = true,
  onRetry,
}: MessageListProps) {
  return (
    // 메시지 간 간격(gap-6)은 말풍선 내부(gap-1.5)·같은 응답의 요소 간격보다 넓다 —
    // 셋이 같은 값이면 "누가 말한 덩어리"가 어디서 끊기는지 읽히지 않는다.
    // 단계: 섹션 내부(1.5) < 섹션 간(3) < 메시지 간(6).
    <div className="flex flex-col gap-6">
      {/* 비휴지 안내는 대화 시작 전에만 — 대화가 시작되면 공간을 비워 대화에 집중 */}
      {messages.length === 0 && (
        <p className="text-xs text-muted-foreground">
          · 이 대화는 이 탭에서만 유지돼요
        </p>
      )}

      {messages.map((msg, i) => {
        const isLast = i === messages.length - 1;
        const isPending =
          isStreaming && isLast && msg.role === "assistant" && !msg.error;
        // 답변이 아직 비었을 때만 말풍선 자체가 타이핑 표시가 된다.
        const showTyping = isPending && !msg.text;
        // 진행 표시는 답변 렌더링과 독립이다 — publishing 은 근거 token 이 나간 뒤
        // products.ready 직전에 오므로, 답변이 채워진 뒤에도 보여줄 자리가 필요하다
        // (계약 CH-2 §progress). 빈 말풍선일 때는 버블 안에서 이미 보여주므로 제외.
        const showStatusLine =
          isPending && Boolean(msg.text) && Boolean(progress);
        // 답변이 아직 없고 진행 문구만 있는 상태 — 말풍선을 씌우지 않는다.
        const showStatusOnly = showTyping && Boolean(progress);

        return msg.role === "user" ? (
          <div
            key={msg.id}
            className={cn(
              "flex animate-in items-start justify-end duration-300 fade-in slide-in-from-bottom-2 slide-in-from-right-2",
              showUserAvatar ? "gap-2" : "gap-0",
            )}
          >
            <div className="flex max-w-[80%] flex-col items-end gap-1.5">
              {/* 보낸 사진은 말풍선 위에 남긴다 — 입력창에서만 지우고 대화에는 보존한다.
                  서버가 어떤 이벤트로도 되돌려주지 않으므로 여기가 유일한 기록이다. */}
              {msg.imageUrls?.map((url) => (
                <ProductImage
                  key={url}
                  src={url}
                  alt="보낸 이미지"
                  className="max-h-56 w-auto max-w-full rounded-2xl rounded-tr-sm border object-cover"
                />
              ))}
              {msg.text && (
                <span className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm leading-relaxed tracking-tight text-primary-foreground">
                  {msg.text}
                </span>
              )}
            </div>
            {showUserAvatar && <UserAvatar />}
          </div>
        ) : (
          <div
            key={msg.id}
            className="flex animate-in items-start gap-2 duration-300 fade-in slide-in-from-bottom-2 slide-in-from-left-2"
          >
            {/* 답변이 도착하기 전(응답 대기)에만 맥박을 준다 — 토큰이 흐르기 시작하면
                글자 자체가 진행을 보여주므로 아바타는 조용해진다. */}
            <Avatar thinking={showTyping} />
            {msg.error ? (
              <div className="flex max-w-[80%] flex-col items-start gap-2 rounded-2xl rounded-tl-sm bg-destructive/10 px-4 py-2.5">
                <span className="text-sm text-destructive">{msg.error}</span>
                {/* 재시도해도 같은 결과가 뻔한 실패(권한·과다 요청 등)에는 버튼을 주지 않는다 —
                    누를수록 상황이 나빠지거나 무의미하다. 판단은 서버 retryable 을 따른다. */}
                {msg.retryable !== false && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="rounded-full border border-destructive/30 px-3 py-1 text-sm text-destructive transition-all hover:bg-destructive/10 active:scale-95"
                  >
                    다시 시도
                  </button>
                )}
                {/* 문의 시 서버 로그에서 이 요청을 찾는 키. 눈에 띄지 않게 두되
                    사용자가 복사해 전달할 수 있어야 한다. */}
                {msg.requestId && (
                  <span className="select-all text-[11px] text-destructive/60">
                    오류 코드 {msg.requestId}
                  </span>
                )}
              </div>
            ) : (
              // 같은 응답에 속한 것들(본문 + 진행 표시)은 가깝게 둔다 —
              // 메시지 간 간격(gap-6)보다 훨씬 좁아야 한 덩어리로 읽힌다
              <div className="flex min-w-0 max-w-[80%] flex-col items-start gap-1.5">
                <span
                  className={cn(
                    // whitespace-pre-wrap 은 여기가 아니라 MessageMarkdown 의 문단에
                    // 있다 — 목록 블록에까지 걸리면 마커와 내용 사이 개행이 살아나
                    // 항목이 두 줄로 꺾인다. 진행 문구는 아래에서 따로 붙인다.
                    "text-sm leading-relaxed",
                    // 진행 문구는 답변이 아니라 상태다 — 말풍선을 씌우면 AI 가 뱉은
                    // 발화처럼 읽히고, 답변이 도착하는 순간 같은 버블이 내용만 갈리며
                    // 튄다. 버블 없이 같은 자리에 얹어 "아직 말이 시작되지 않았음"을
                    // 형태로 구분한다.
                    // pt 를 pb 보다 키워 아래로 내린다 — 버블을 벗기면서 세로 패딩이
                    // 함께 빠져 문구가 아바타 위쪽에 붙어 보였다. 바깥 gap 이 아니라
                    // 여기서 조절해야 답변 도착 후 버블로 바뀔 때 자리가 흔들리지 않는다.
                    showStatusOnly
                      ? "px-1 pb-1 pt-2.5 text-muted-foreground"
                      : "rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5",
                    showTyping && !showStatusOnly && "py-3",
                  )}
                  aria-live={showStatusOnly ? "polite" : undefined}
                >
                  {showTyping ? (
                    // 진행 텍스트(progress)가 있으면 로딩 문구로, 없으면 점 애니메이션.
                    // progress 는 답변이 아니라 상태 문구라 마크다운을 태우지 않는다.
                    progress ? (
                      <span className="flex items-center gap-3 whitespace-pre-wrap">
                        <TypingIndicator />
                        {progress}
                      </span>
                    ) : (
                      <TypingIndicator />
                    )
                  ) : (
                    <MessageMarkdown text={msg.text} />
                  )}
                </span>

                {/* 답변이 렌더된 뒤에도 오는 진행 표시(publishing) 자리.
                    말풍선 밖 얇은 줄이라 답변 텍스트를 밀지 않고, 사라질 때도
                    버블 높이가 변하지 않아 레이아웃이 튀지 않는다. */}
                {showStatusLine && (
                  <span
                    className="flex animate-in items-center gap-2 px-1 text-xs text-muted-foreground duration-300 fade-in"
                    aria-live="polite"
                  >
                    <TypingIndicator />
                    {progress}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * AI 아바타 — 이미지 대신 스파크 글리프(SVG)로 그린다.
 *
 * 28px 자리라 비트맵은 뭉개지고 배율마다 흐려진다. 코드로 그리면 어느 배율에서도
 * 선명하고 네트워크 요청도 없다.
 *
 * 기본은 정지다. 이 아바타는 AI 말풍선마다 붙어 화면에 계속 떠 있으므로,
 * 상시 도는 애니메이션은 자주 보는 것일수록 조용해야 한다는 원칙에 어긋난다
 * (.agents/skills: "frequency of use", "purposeful animation").
 * 그래서 움직임은 "지금 생각 중"이라는 뜻을 가질 때만 준다 — thinking 일 때만
 * 은은하게 반짝인다. 상태를 전달하는 목적이 있어 장식이 아니다.
 */
function Avatar({ thinking = false }: { thinking?: boolean }) {
  return (
    // 말풍선 옆 장식이라 스크린리더에서 숨긴다 — 발화자는 버블 위치·문맥으로 이미 구분된다.
    // 응답 중 상태는 아래 TypingDots 가 role/문구로 따로 알린다.
    // overflow-visible: 반짝일 때 번지는 halo(drop-shadow)가 뷰박스 경계에서 잘리지 않게.
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="mt-0.5 size-7 shrink-0 overflow-visible"
    >
      <defs>
        {/* 로고·파비콘과 같은 팔레트 — 아이스블루 → 스카이블루 → 세이지 → 버터옐로우.
            로고가 파랑에서 노랑으로 넘어가는 축을 그대로 따라 같은 브랜드로 읽히게 한다.
            id 가 문서 전역이라 다른 컴포넌트와 겹치지 않게 이름을 구체적으로 둔다. */}
        <linearGradient id="ai-spark" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#BDD5F4" />
          <stop offset="30%" stopColor="#8DB9F4" />
          <stop offset="60%" stopColor="#B9CFBF" />
          <stop offset="100%" stopColor="#F8DB72" />
        </linearGradient>
      </defs>

      {/* 4가닥 스파크. 직선 삼각형 대신 큐빅 곡선으로 허리를 오목하게 파서
          끝이 뾰족하고 가운데가 잘록한 별이 된다 — AI 를 가리키는 관용 기호라
          설명 없이 읽힌다.

          <g>로 감싸 배치(translate/scale)와 애니메이션을 분리한다 — 같은 요소에 두면
          반짝일 때의 scale 이 배치용 transform 을 덮어써 도형이 제자리를 벗어난다. */}
      <g
        className={cn(
          thinking &&
            "origin-center [transform-box:fill-box] animate-avatar-thinking motion-reduce:animate-none",
        )}
      >
        <path
          fill="url(#ai-spark)"
          d="M12 2c.5 4.7 2.8 7 7.5 7.5v.1c-4.7.5-7 2.8-7.5 7.4-.5-4.6-2.8-6.9-7.5-7.4v-.1C9.2 9 11.5 6.7 12 2Z"
          transform="translate(-1.5 3.5) scale(0.95)"
        />
      </g>

      {/* 작은 두 번째 스파크 — 하나만 있으면 심심하고, 크기 차이가 리듬을 만든다.
          28px 로 줄면 둘이 붙어 한 덩어리로 뭉쳐 보이므로 오른쪽 위로 충분히 띄운다.
          큰 것과 어긋난 타이밍으로 깜빡여(-0.6s) 둘이 번갈아 반짝이는 것처럼 보인다. */}
      <g
        className={cn(
          thinking &&
            "origin-center [transform-box:fill-box] animate-avatar-thinking [animation-delay:-0.55s] motion-reduce:animate-none",
        )}
      >
        <path
          fill="url(#ai-spark)"
          // 정지 상태에서는 큰 것에 딸린 부속으로 읽히게 살짝 연하게 둔다.
          // thinking 이면 애니메이션의 opacity 가 이 값을 대신한다.
          opacity={thinking ? undefined : 0.75}
          d="M19.2 3.1c.14 1.32.77 1.94 2.11 2.11v.04c-1.34.14-1.97.77-2.11 2.11-.14-1.34-.77-1.97-2.11-2.11v-.04c1.34-.18 1.97-.79 2.11-2.11Z"
        />
      </g>
    </svg>
  );
}

/**
 * 사용자 아바타 — 채운 원, 중립색.
 * AI 는 색을 가진 스파크, 사용자는 무채색 원으로 형태부터 갈라 한눈에 구분되게 한다.
 * 브랜드색은 AI 기능 강조 전용이라(CLAUDE.md) 여기 쓰지 않는다.
 */
function UserAvatar() {
  return (
    <span
      aria-hidden
      className="mt-0.5 size-7 shrink-0 rounded-full bg-muted ring-1 ring-black/5"
    />
  );
}
