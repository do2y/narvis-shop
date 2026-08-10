import type { PreferencePredicate } from "./types";

/**
 * 관계 5종의 시각 정체성 — **색·설명·강도를 한곳에 모은다.**
 *
 * 요약·관계도·목록이 서로 다른 제품처럼 보이지 않으려면 "선호"가 어디서나 같은
 * 색·같은 말로 나와야 한다. 세 곳에서 각자 정하면 반드시 어긋난다.
 *
 * ## 색은 로고 계열에서 가져온다
 * 로고의 파랑·초록·노랑을 채도만 낮춰 쓴다. 채도를 낮추는 이유는 이 화면이
 * 훑어보는 지도지 대시보드가 아니어서다 — 다섯 색이 선명하면 어디를 먼저
 * 봐야 할지 알 수 없고, 로고 옆에서 다른 서비스처럼 보인다.
 *
 * ## 색만으로 구분하지 않는다
 * 관계는 **이름(선호·좋아함…)** 이 항상 함께 나오고, 그래프에서는 위치(방사
 * 각도)로도 갈린다. 색은 "같은 묶음"을 눈에 띄게 하는 보조 신호일 뿐이라
 * 색각 이상에서 두 색이 같아 보여도 읽는 데 지장이 없다.
 *
 * `--brand`(딥 틸그린) 하나로 다섯을 칠하지 않는 이유는 그러면 가지끼리
 * 구분이 사라지기 때문이다. 대신 전부 같은 채도·명도 대역에 둬 한 팔레트로 읽힌다.
 */
export interface PredicateStyle {
  /** 그래프 노드·엣지에 쓰는 실제 색값(SVG는 CSS 변수 클래스를 못 쓰는 자리가 있다) */
  tint: string;
  /** 칩·배지 배경 — 아주 옅게. 항목이 수십 개 늘어서도 시끄럽지 않아야 한다 */
  chipClass: string;
  /** 카테고리 제목 옆 포인트 라인 */
  barClass: string;
  /** 개수 배지 */
  countClass: string;
  /**
   * 이 관계가 무엇인지 한 줄.
   *
   * 계약의 정의를 사용자 말로 옮긴 것이고 새 뜻을 만들지 않는다
   * (types.ts의 PreferencePredicate 주석과 같은 내용).
   */
  hint: string;
  /** 항목이 하나도 없을 때 — 오류가 아니라 "아직"임을 말한다 */
  emptyHint: string;
}

export const PREDICATE_STYLE: Record<PreferencePredicate, PredicateStyle> = {
  prefers: {
    tint: "#7BA7E8",
    chipClass:
      "border-[#7BA7E8]/30 bg-[#7BA7E8]/[0.07] hover:[@media(hover:hover)]:bg-[#7BA7E8]/[0.14]",
    barClass: "bg-[#7BA7E8]",
    countClass: "bg-[#7BA7E8]/15 text-[#3F6FB0]",
    hint: "다른 것 대신 이걸 고르셨어요",
    emptyHint: "아직 두드러진 선호가 없어요",
  },
  likes: {
    tint: "#7FC79B",
    chipClass:
      "border-[#7FC79B]/30 bg-[#7FC79B]/[0.07] hover:[@media(hover:hover)]:bg-[#7FC79B]/[0.14]",
    barClass: "bg-[#7FC79B]",
    countClass: "bg-[#7FC79B]/15 text-[#3E8158]",
    hint: "비교 없이 그냥 좋아하시는 것들",
    emptyHint: "아직 모은 게 없어요",
  },
  interestedIn: {
    tint: "#E0BC63",
    chipClass:
      "border-[#E0BC63]/35 bg-[#E0BC63]/[0.08] hover:[@media(hover:hover)]:bg-[#E0BC63]/[0.16]",
    barClass: "bg-[#E0BC63]",
    countClass: "bg-[#E0BC63]/20 text-[#8A6A19]",
    hint: "요즘 자주 찾아보신 것들",
    emptyHint: "아직 눈여겨본 게 없어요",
  },
  purchased: {
    tint: "#9AA4C4",
    chipClass: "border-[#9AA4C4]/30 bg-[#9AA4C4]/[0.07]",
    barClass: "bg-[#9AA4C4]",
    countClass: "bg-[#9AA4C4]/18 text-[#575F7B]",
    hint: "실제로 구매하신 기록이라 고칠 수 없어요",
    emptyHint: "아직 구매 기록이 없어요",
  },
  avoids: {
    tint: "#B8BEC9",
    chipClass:
      "border-[#B8BEC9]/40 bg-[#B8BEC9]/[0.07] hover:[@media(hover:hover)]:bg-[#B8BEC9]/[0.14]",
    barClass: "bg-[#B8BEC9]",
    countClass: "bg-[#B8BEC9]/20 text-[#5B6270]",
    hint: "피하고 싶다고 하신 것들",
    // 회피는 만드는 경로가 아직 없어 늘 비어 있다(계약). 사용자 탓처럼
    // 읽히지 않게, 그리고 평가처럼 들리지 않게 담담히 적는다.
    emptyHint: "아직 피하고 싶은 건 없으신가 봐요",
  },
};
