import { create } from "zustand";

/**
 * 로그인 유도 모달의 열림 상태 — UI 상태라 Zustand(CLAUDE.md 상태 구분).
 *
 * 왜 전역인가: 이 안내를 띄우는 곳이 찜 버튼만 해도 넷이다(상품 상세·브랜드 카드·
 * 챗 카드·찜 목록). 호출부마다 open state 와 <Dialog> 를 두면 같은 모달이 네 벌로
 * 갈리고, 문구·버튼 배치가 화면마다 어긋난다. 상태만 여기 두고 실물은 루트에
 * 하나(LoginPromptDialog)만 건다.
 *
 * 이 화면을 띄우는 것은 훅(useRequireLogin) 몫이다 — 호출부는 store 를 직접 만지지
 * 않는다.
 */
export type LoginPrompt = {
  /** 무엇을 하려다 막혔는지 — 동사로. */
  title: string;
  /** 로그인 후 무슨 일이 일어나는지(또는 일어나지 않는지). */
  description: string;
  /** 로그인 후 돌아올 경로. 확정된 값이라 열 때 담아 둔다. */
  returnUrl: string;
};

type LoginPromptState = {
  prompt: LoginPrompt | null;
  open: (prompt: LoginPrompt) => void;
  close: () => void;
};

export const useLoginPromptStore = create<LoginPromptState>((set) => ({
  prompt: null,
  open: (prompt) => set({ prompt }),
  close: () => set({ prompt: null }),
}));
