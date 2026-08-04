"use client";

import { useChatStore } from "./store";

interface ClaimFailureBannerProps {
  /** "다시 시도" — 승계를 재시도한다. 실패해도 배너는 유지된다. */
  onRetry: () => void;
  /** "기억 없이 계속" — 대화는 남기고 맥락만 포기한다(배너만 걷음). */
  onContinue: () => void;
  /** "지우고 새로 시작" — 대화까지 비우고 새 방을 판다. */
  onStartNew: () => void;
}

/**
 * 로그인 승계(CH-7) 실패 안내.
 *
 * 화면엔 로그인 전 대화가 남아 있지만 서버 맥락은 끊긴 상태다. 이 사실을 알리지
 * 않고 다음 발화를 받으면 "AI 가 방금 한 얘기를 기억 못 하는" 어긋남이 생기므로,
 * 사용자가 진로를 고를 때까지 전송을 막고 이 배너를 띄운다. 선택지는 셋이다:
 * - 다시 시도 — 승계를 재시도한다. 성공하면 맥락까지 되살아난다(유일한 복구 수단)
 * - 기억 없이 계속 — 대화는 남기고 맥락만 포기한다
 * - 지우고 새로 시작 — 대화까지 비운다(되돌릴 수 없음)
 *
 * 막는 건 "조용히 맥락이 끊기는 것"이지 사용자의 선택이 아니다 — 알고 고른다면
 * 맥락 없이 계속하는 것도 정당한 선택이라 길을 열어 둔다(§16.2 Agency).
 *
 * 메시지 목록 위에 고정한다 — 대화 흐름 안의 말풍선으로 두면 새 메시지가 쌓일 때
 * 위로 밀려 올라가 미해결 상태인데도 시야에서 사라진다.
 *
 * 디자인 방향(apple-design 스킬):
 * - 경고 아이콘·붉은 색을 쓰지 않는다. 사용자의 실수도 파괴적 상황도 아니라
 *   "이어받지 못했다"는 상태 보고다. 색으로 놀래키는 대신 활자 위계로 전한다
 *   (§16.6 모든 요소는 제 몫을 한다 / §16.7 무엇도 우연이 아니다).
 * - 위계는 크기가 아니라 weight·size·leading 을 한 세트로 잡아 만든다(§15).
 *   제목은 자간을 좁히고, 본문은 흐린 회색 대신 대비를 확보한다(§12 vibrancy).
 * - 대화 위에 "떠 있는 층"으로 만든다(§12 translucent floating layer).
 *   문서 흐름에 끼워 넣으면 채팅방의 한 구간처럼 읽혀 눈에 걸리지 않는다.
 *   대화는 이 면 아래로 흘러 지나가고, 안내는 그 위에 얹힌다.
 * - 반투명 + blur 로 아래 내용이 비쳐야 "덮고 있다"가 성립한다. 불투명 면이면
 *   그냥 잘려나간 영역으로 보인다.
 * - 사방에 여백을 둬 띄운다. 좌우가 벽에 닿으면 "떠 있는 물체"가 아니라
 *   화면을 가로지르는 띠로 읽혀 입체감이 죽는다.
 * - 그림자는 세 겹이다 — 넓고 옅은 것(거리감) + 좁고 진한 것(접지) + 위 가장자리
 *   밝은 선(빛을 받는 재질). 한 겹만 쓰면 납작하게 보인다(§12).
 * - 버튼 무게는 2단이다 — 복구(다시 시도)만 솔리드로 띄우고, 포기하는 둘은
 *   동급의 테두리 버튼으로 둔다. 자세한 근거는 아래 버튼 영역 주석 참고.
 * - 피드백은 누르는 순간(active)에 즉시 준다(§1 response).
 */
export function ClaimFailureBanner({
  onRetry,
  onContinue,
  onStartNew,
}: ClaimFailureBannerProps) {
  const claimFailure = useChatStore((s) => s.claimFailure);
  if (!claimFailure) return null;

  const { retrying } = claimFailure;

  return (
    <section
      // alert 가 아니라 status — 파괴적 경고가 아니라 진행 상태 보고다.
      // polite 라 스크린리더가 읽던 것을 끊지 않는다.
      role="status"
      aria-live="polite"
      className="z-10 mx-3 mt-3 animate-in rounded-sm border border-black/[0.06] bg-background/90 px-5 py-4 shadow-[0_8px_28px_-6px_rgba(0,0,0,0.16),0_2px_6px_-2px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl duration-200 fade-in slide-in-from-top-3 supports-[backdrop-filter]:bg-background/80 motion-reduce:animate-none sm:mx-4 sm:mt-4 sm:px-6 sm:py-5"
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1">
          {/* 제목과 본문이 같은 크기면 위계가 서지 않아 한 덩어리로 읽힌다.
              크기·굵기·색을 함께 벌려 두 층으로 만든다(§15 위계는 세트로) */}
          <h2 className="text-[15px] font-semibold leading-snug tracking-tight text-foreground">
            로그인 전 대화를 이어받지 못했어요
          </h2>
          {/* 본문은 한 문장으로 끊는다 — 선택지별 결과는 버튼 이름이 이미 말한다
              ("기억 없이 계속" / "지우고 새로 시작"). 문장으로 한 번 더 설명하면
              길어지기만 하고 제목과 뭉쳐 읽힌다(§16.6 간결함). */}
          <p className="text-[13px] leading-relaxed text-foreground/55">
            다시 시도하면 앞의 내용을 기억한 채로 이어갈 수 있어요.
          </p>
        </div>

        {/* 무게는 2단이다 — 셋을 차례로 흐리면 "1·2·3등"으로 보이지만 실제 구조는
            "복구(다시 시도) vs 포기(나머지 둘)"이고, 뒤의 둘은 대화를 남기냐만
            다른 동급이다. 3단으로 나누면 마지막이 더 나쁜 선택처럼 읽히고
            비활성으로도 보인다. 실수 방지는 순서(맨 오른쪽)와 이름("지우고")이 맡는다.
            버튼은 h-9 로 두되 after 의사요소로 세로 터치 영역을 넓혀
            실제 탭 타겟은 44px 을 지킨다 — 안내 블록에 h-11 알약 셋은 과하다. */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="relative h-9 rounded-full bg-foreground px-4 text-[13px] font-medium text-background transition duration-100 ease-out after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] hover:opacity-90 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {retrying ? "이어받는 중" : "다시 시도"}
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={retrying}
            className="relative h-9 rounded-full border border-border px-4 text-[13px] font-medium text-foreground/70 transition duration-100 ease-out after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] hover:border-foreground/25 hover:text-foreground active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            기억 없이 계속
          </button>
          {/* 되돌릴 수 없는 쪽이라 맨 오른쪽에 둔다 — 무게는 위와 같게 하고
              결과를 이름에 담아("지우고") 실수를 막는다(§16.2 Agency). */}
          <button
            type="button"
            onClick={onStartNew}
            disabled={retrying}
            className="relative h-9 rounded-full border border-border px-4 text-[13px] font-medium text-foreground/70 transition duration-100 ease-out after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] hover:border-foreground/25 hover:text-foreground active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            지우고 새로 시작
          </button>
        </div>
      </div>
    </section>
  );
}
