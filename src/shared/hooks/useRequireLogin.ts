"use client";

import { useLoginPromptStore } from "@/shared/stores/loginPromptStore";

/**
 * 게스트가 로그인 필요한 동작을 눌렀을 때 — 이유를 묻고, 갈지 말지는 사용자가 정한다.
 *
 * 종전에는 두 곳(상품 상세 "바로 구매", 찜 토글)이 각자 곧장 router.push 만 했다.
 * 누른 사람 입장에선 설명 없이 화면이 갈아엎히니 "왜 로그인 화면이지"가 되고,
 * 잘못 눌렀다 생각해 뒤로 가면 보고 있던 화면의 스크롤·선택 상태까지 잃는다.
 *
 * 안내를 토스트가 아니라 **모달**로 두는 이유: 토스트는 알리기만 할 뿐 거절할
 * 수단이 없다. 안내를 띄우면서 이동은 이미 확정돼 있으면, 로그인할 마음이 없는
 * 사람에게는 그 이동 자체가 방해다. 이동 전에 물어 [취소]로 하던 일을 잇게 한다.
 *
 * 실물 모달은 루트에 하나만 있다(LoginPromptDialog) — 이 안내를 띄우는 곳이 찜만
 * 해도 넷이라, 호출부마다 <Dialog> 를 두면 문구와 배치가 화면마다 갈린다.
 */
export function useRequireLogin() {
  const open = useLoginPromptStore((s) => s.open);

  /**
   * @param returnTo    로그인 후 돌아올 경로. 생략하면 현재 경로+쿼리.
   * @param title       상황별 문구. 무엇을 하려다 막혔는지 동사로 말해준다.
   * @param description 보조 설명. 로그인 뒤 동작이 자동으로 이어지지 않는 곳
   *   (바로 구매 — 선택한 옵션·수량이 리다이렉트로 유실된다)은 다시 눌러야 한다는
   *   것까지 여기서 알려야 한다.
   */
  return (
    returnTo?: string,
    title = "로그인이 필요한 기능이에요.",
    description = "로그인하면 이어서 사용할 수 있어요.",
  ) => {
    // 이벤트 시점이라 useSearchParams 가 아니라 window 에서 읽는다 —
    // 그 훅을 쓰면 호출부가 Suspense 경계에 묶여 SSR 이 비워진다(CLAUDE.md).
    // 경로는 여는 시점에 확정해 담는다. 모달이 열려 있는 동안 주소가 바뀌어도
    // 사용자가 "누른 그 화면"으로 돌아가야 하기 때문이다.
    const returnUrl =
      returnTo ?? window.location.pathname + window.location.search;
    open({ title, description, returnUrl });
  };
}
