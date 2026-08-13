/**
 * 랜딩 탭 — 소비자용 / 판매자용.
 *
 * 두 탭은 콘텐츠만 바뀌는 표시 전환이 아니라 **대상이 다른 두 서비스 소개**다.
 * 그래서 URL(`?tab=`)에 남긴다 — 판매자에게 링크를 보낼 때 소비자 화면이
 * 열리면 안 되고, 뒤로가기로 직전에 보던 쪽으로 돌아갈 수 있어야 한다.
 */
export type LandingTab = "buyer" | "seller";

/** 알 수 없는 값(?tab=xyz, 없음)은 소비자로 떨어뜨린다 */
export function parseTab(raw: string | null | undefined): LandingTab {
  return raw === "seller" ? "seller" : "buyer";
}

/**
 * 헤더의 섹션 앵커.
 *
 * 두 탭이 같은 id를 쓴다 — 탭을 바꿔도 "주요 기능"이 같은 자리를 가리켜야
 * 메뉴가 탭마다 다른 뜻이 되지 않는다. 각 탭의 섹션 컴포넌트가 이 id를 단다.
 */
export const NAV_SECTIONS = [
  { id: "features", label: "주요 기능" },
  { id: "how-it-works", label: "이용 방법" },
] as const;
