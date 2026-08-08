"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * 전역 토스트.
 *
 * 카드 안 인라인 문구를 대체한다 — 문구를 카드에 넣으면 그 카드만 세로로 늘어나
 * 그리드에서 옆 카드와 높이가 어긋나고, 사라질 때 또 한 번 튄다.
 *
 * 디자인은 apple-design 스킬을 따랐다:
 *
 * §12 재질·깊이 — 토스트는 콘텐츠 위에 잠깐 떠 있는 기능 레이어다. 반투명 +
 *   backdrop-blur 로 두면 아래 내용이 비쳐 "위에 얹혀 있다"가 형태로 읽힌다.
 *   작은 표면이라 블러는 얕게, 그림자도 과하지 않게 준다("큰 표면일수록 두껍게" 의 역).
 *
 *   **어두운 재질을 쓴다.** 이 앱은 배경이 흰색이라 밝은 반투명은 흰 바탕에
 *   묻혀 알림이 온 줄도 모른다. 어두운 재질은 콘텐츠에서 확실히 분리되면서도
 *   불투명 검정 판보다 조용하다(§12: 어두운/무거운 재질이 구조를 분리한다).
 *
 * §12 vibrancy — 반투명 위의 글자는 흐린 회색을 쓰지 않는다. 바탕이 어두우므로
 *   전경을 뒤집어 text-background 에 font-medium 으로 무게를 살짝 얹는다.
 *
 * §15 타이포 — tracking 은 크기별로 다르게. 작은 UI 텍스트라 살짝 양수(tracking-wide
 *   대신 미세하게)로 두어 흐린 배경 위 가독성을 확보한다.
 *
 * §14 접근성 — 투명도·대비 설정을 존중한다. prefers-reduced-transparency 에서는
 *   블러를 끄고 불투명하게, prefers-contrast: more 에서는 테두리를 진하게 세운다.
 *   (모션은 sonner 가 prefers-reduced-motion 을 자체 처리한다)
 *
 * 위치는 상단 중앙. 헤더와 겹치지 않게 그 높이(64px)만큼 내려서 띄운다 —
 * 반투명끼리 포개지면 둘 다 읽기 어려워진다(§12).
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      // 기본 4초는 한 줄 안내로는 길다. 읽고 넘기기 충분한 정도만.
      duration={2500}
      // AppHeader 가 sticky top-0 에 h-16(64px)이라 그 아래로 내린다 —
      // 겹치면 반투명끼리 포개져 둘 다 읽기 어려워진다(§12: 밝은 반투명을
      // 다른 반투명 위에 쌓지 않는다). 가장자리 여백 16px 을 더해 80px.
      offset={80}
      // 모바일은 헤더가 화면을 더 많이 차지해 같은 값이면 답답하다.
      mobileOffset={72}
      // 같은 동작을 연달아 하면 알림이 쌓여 화면을 가린다. 최신 것만 남긴다
      // (§16 단순함 — 모든 것을 다 보여주는 게 친절한 게 아니다).
      visibleToasts={2}
      toastOptions={{
        classNames: {
          toast: [
            // 재질: 어두운 반투명 + 얕은 블러. 이 앱은 배경이 흰색이라 밝은
            // 반투명은 흰 바탕에 묻혀 알림이 온 줄도 모른다(실제로 그랬다).
            // 어두운 재질은 콘텐츠에서 확실히 분리되면서도, 불투명 검정 판보다
            // 조용하다(§12: 어두운 재질이 구조를 분리한다).
            "!bg-foreground/70 !backdrop-blur-md !backdrop-saturate-150",
            // 빛을 받는 윗변 — 어두운 표면에서도 위가 밝아야 판이 아닌 물체로 읽힌다.
            "!border !border-white/10 !border-t-white/20",
            // 어두운 표면은 그림자가 잘 안 보인다. 아래로 살짝 띄워 부유감만 준다.
            "!shadow-lg !shadow-black/20",
            // 알약 형태 — CLAUDE.md radius 규칙(버튼·칩은 rounded-full)
            "!rounded-full !px-4 !py-3",
            // 어두운 바탕이므로 전경을 뒤집는다. tracking 은 미세하게 양수(§15).
            "!text-sm !font-medium !tracking-[0.01em] !text-background",
            "!gap-2.5",
            // 투명도를 낮춘 사용자에게는 불투명하게(§14)
            "[@media(prefers-reduced-transparency:reduce)]:!bg-foreground",
            "[@media(prefers-reduced-transparency:reduce)]:!backdrop-blur-none",
            // 고대비 설정에서는 테두리를 세운다(§14)
            "[@media(prefers-contrast:more)]:!border-background/50",
          ].join(" "),
          // 어두운 바탕 위 보조 설명 — 본문보다 한 단계 낮추되 흐려서 안 읽히면 안 된다.
          description: "!text-background/70 !font-normal",
          // 되돌리기(실행 취소) 같은 보조 액션이다 — 알림보다 시끄러우면 안 되므로
          // 솔리드 흰 버튼 대신 같은 재질 위 옅은 판으로 둔다(§16 절제).
          // 누를 수 있다는 것은 테두리와 press 반응으로 전한다(§1 즉시 피드백).
          actionButton: [
            "!rounded-full !bg-white/15 !text-background !font-medium",
            "!border !border-white/20 !px-2.5",
            "hover:!bg-white/25 active:!scale-95 !transition-all",
          ].join(" "),
          cancelButton: "!rounded-full !bg-white/15 !text-background",
          // 아이콘은 currentColor SVG 라 색만 바꾸면 된다. 어두운 바탕이므로
          // 기본값을 밝은 쪽으로 잡는다 — 커스텀 아이콘(toast() 기본형)은
          // success/error 클래스를 타지 않아 여기서 색을 받는다.
          icon: "!text-background/70",
          // 성공/실패는 아이콘 색으로만 가른다 — 배경까지 물들이면 재질이 깨지고,
          // 실패가 성공보다 시끄러워야 할 이유도 없다(§16 절제).
          success: "[&_[data-icon]]:!text-background/70",
          // 어두운 바탕에서 destructive(짙은 빨강)는 묻힌다 — 밝은 쪽으로 올린다.
          error: "[&_[data-icon]]:!text-red-400",
        },
      }}
    />
  );
}
