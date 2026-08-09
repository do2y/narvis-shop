import { cn } from "@/lib/utils";

/**
 * 판매자 화면 인터랙션 규칙 — "같아 보이는 것은 같게 동작한다"를 코드 한 곳에 모은다.
 *
 * 원래는 같은 성격의 버튼이 자리마다 press 세기(0.99·0.95·0.90)와 transition 대상이
 * 제각각이었다. 개별 화면에서 눈으로 맞추면 다음 화면을 고칠 때 또 어긋나므로 상수로 둔다.
 *
 * 세 가지가 전부 의도적이다:
 *  - `transition-all` 금지 → 바뀌는 속성만 적는다. all 은 shadow·layout 까지 트랜지션
 *    대상으로 잡아 불필요한 리페인트를 만든다.
 *  - `ease-out-strong`(globals.css) → CSS 기본 곡선은 완만해 반응이 잘 읽히지 않는다.
 *    ease-in 계열은 시작이 느려 사용자가 가장 주시하는 첫 순간을 비운다.
 *  - hover 는 `@media(hover:hover)` 뒤로 → 터치에서는 탭이 hover 로 잡혀
 *    손을 뗀 뒤에도 배경색이 남는다.
 *
 * 지속시간 150ms: press 피드백은 "눌렀다"는 사실만 전하면 되므로 길면 굼떠 보인다
 * (판매자 화면은 하루에도 수십 번 누르는 업무 화면이라 특히).
 */

/**
 * 축소 모션 대응: `motion-reduce:` 로 이동만 끄고 색 전환은 남긴다.
 * 축소 모션은 "모션 없음"이 아니라 전정기관을 건드리는 움직임만 빼는 것이다 —
 * 색·불투명도 변화는 상태를 알리는 정보라 유지한다(앱 나머지와 같은 방식).
 */
const reduceSafe = "motion-reduce:transition-none motion-reduce:active:scale-100";

/** 누를 수 있는 요소 공통 — 색 전환 + press 축소 */
export const pressable = cn(
  "transition-[transform,scale,background-color,color,border-color]",
  "duration-150 ease-out-strong",
  "active:scale-[0.97]",
  reduceSafe,
);

/**
 * 카드처럼 큰 면적을 누를 때 — 면적이 넓어 같은 배율도 더 크게 읽히므로 약하게.
 *
 * background-color 도 대상에 넣는다: 테두리·그림자 대신 배경톤으로 면을 구분하는
 * 자리(대시보드 할 일 타일)가 생겼는데, 빠져 있으면 hover 색이 트랜지션 없이 튄다.
 */
export const pressableCard = cn(
  "transition-[transform,scale,box-shadow,border-color,background-color]",
  "duration-150 ease-out-strong",
  "active:scale-[0.99]",
  reduceSafe,
);

/** 터치에서 hover 잔상이 남지 않게 게이팅한 배경 hover */
export const hoverMuted = "hover:[@media(hover:hover)]:bg-muted";

/** 숫자 열 정렬 — 자릿수가 흔들리지 않게 고정폭 숫자를 쓴다(금액·재고·판매량) */
export const numeric = "tabular-nums";
