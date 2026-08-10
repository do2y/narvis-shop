// 방사형 그래프의 좌표 계산 — 순수 함수만 둔다(렌더 없음).
//
// 라이브러리를 쓰지 않는 이유: 노드가 `나 1 + 관계 5 + 관계당 N`으로 **고정 구조**라
// force-directed가 풀 문제가 없다. d3-force를 넣어도 결국 같은 그림이 나오는데
// 의존성만 는다. 나중에 물리 시뮬레이션이 필요해지면 **이 파일만** 갈아끼운다.
//
// 순수 함수로 분리한 두 번째 이유는 검증이다 — 비례 배분·겹침 없음·빈 그룹 자리를
// 렌더 없이 vitest로 확인할 수 있다(graphLayout.test.ts).

import {
  PREDICATE_ORDER,
  PREDICATE_LABEL,
  type PreferenceEdge,
  type PreferencePredicate,
} from "../types";

/**
 * 관계당 화면에 그리는 항목 수.
 *
 * 서버 상한이 폐지되어 edges가 전량 오므로 자르는 것은 FE 몫이다. 6개인 이유는
 * 방사형에서 한 가지가 쓸 수 있는 각도 안에 라벨이 겹치지 않고 들어가는 한계가
 * 그쯤이어서다. 넘친 만큼은 `+N`으로 알리고 포커스 모드에서 펼친다.
 *
 * **상한은 접기가 아니라 잘라내는 것이다** — 목록 뷰(GROUP_DISPLAY_LIMIT)와
 * 값이 다른 것은 제약이 다르기 때문이다(목록은 세로로 무한히 늘어난다).
 */
export const GRAPH_ITEMS_PER_BRANCH = 6;

/**
 * 포커스 모드(한 관계만 확대)에서의 상한.
 *
 * **각도가 아니라 세로 픽셀이 진짜 제약이다.** 한때 이 값이 24인데 라벨 18쌍이
 * 겹쳤는데, 원인은 개수가 아니라 부채꼴 각도만으로 간격을 잡은 것이었다
 * (항목당 9°가 되어 라벨이 포개졌다). buildGraphLayout이 계산 후 세로 간격을
 * 픽셀로 보정하게 고친 뒤로는 24개도 겹치지 않는다.
 *
 * 그래서 상한을 정하는 기준은 겹침이 아니라 **뷰박스를 넘는가**다. 실측:
 *
 * | 개수 | 겹침 | 화면 밖 | 세로 사용 |
 * |------|------|---------|-----------|
 * | 24   | 0쌍  | 0개     | 483px     |
 * | 28   | 0쌍  | 0개     | 567px     |
 * | 32   | 0쌍  | 1개     | 651px     |
 * | 40   | 0쌍  | 5개     | 819px     |
 *
 * 28이 마지막 안전값이지만 24를 쓴다 — 여유 4개가 있어야 라벨이 지금보다
 * 길어지거나 뷰박스가 바뀌어도 곧바로 깨지지 않는다.
 *
 * 이 수를 넘는 그룹은 잘리는 게 아니라 목록 뷰가 받는다(PreferenceGraph의
 * "N개 모두 보기"). 방사형은 라벨이 가로로 뻗어 82개를 담을 수 없고,
 * 세로로 늘어나는 목록에는 개수 제한이 없다.
 */
export const GRAPH_ITEMS_FOCUSED = 24;

/**
 * 뷰박스. 가로가 넓은 이유는 **라벨이 가로로 길기 때문**이다.
 *
 * 정사각으로 두면 좌우 항목의 라벨("블루투스 이어폰")이 뷰박스를 넘어 잘리고,
 * 그걸 피하려고 반지름을 줄이면 그래프가 한가운데 작게 뭉친다. 3:2로 두면
 * 라벨이 뻗을 가로 여백이 생겨 같은 반지름에서도 잘리지 않는다.
 */
export const VIEWBOX_W = 1200;
/*
  ⚠️ 800 → 680 으로 낮췄다(3:2 → 약 1.76:1).

  패널이 가로로 넓고 세로는 뷰포트에 맞춰 잘리므로(약 1150×460, 2.5:1),
  뷰박스가 3:2 면 `preserveAspectRatio` 가 세로에 맞춰 축소해 **가로 814px 만
  쓰고 좌우가 letterbox 로 남았다**(실측: 컨테이너 대비 64%). 뷰박스를 실제
  패널 비율 쪽으로 당기면 같은 높이에서 가로를 더 쓴다.

  완전히 2.5:1 로 맞추지는 않는다 — 그러면 세로가 너무 눌려 위아래 가지의
  라벨이 서로 가까워진다. 라벨 간 세로 간격 보정(MIN_LABEL_GAP)이 그만큼
  더 많이 밀어내야 하고, 밀어낼수록 부채꼴이 흐트러진다.
*/
export const VIEWBOX_H = 680;
const CENTER_X = VIEWBOX_W / 2;
const CENTER_Y = VIEWBOX_H / 2;

/**
 * 중심(나) → 관계 노드 거리.
 *
 * **가지 수에 따라 달라진다.** 고정하면 가지가 적을 때 그래프가 화면 한가운데
 * 작게 뭉친다(실측: 1가지에서 가로의 33%만 사용). 가지가 적으면 각도 여유가
 * 남으므로 그만큼 멀리 밀어 화면을 채운다.
 */
function branchRadiusFor(filledCount: number, focusedMode: boolean): number {
  /*
    ⚠️ 값을 키웠다(214 → 286 등). 이전 값에서는 그림이 뷰박스의 **64%** 만
    써서, 큰 패널 한가운데 작게 떠 있는 것처럼 보였다(실측). 방사형은
    반지름이 곧 그림 크기라 여백을 줄이려면 여기를 늘려야 한다.

    상한은 라벨이다 — 항목 라벨이 가지에서 다시 뻗어 나가므로, 반지름을
    너무 키우면 바깥 라벨이 뷰박스를 넘는다. 아래 값은 leafRadius 와 합쳐
    가장자리에 라벨 폭(약 150px)이 남도록 잡았다.
  */
  // 포커스 모드에서는 부채꼴이 커지므로 가지를 중심 쪽으로 당겨 자리를 내준다
  if (focusedMode) return 210;
  if (filledCount <= 1) return 330;
  if (filledCount === 2) return 300;
  return 286;
}

/**
 * 관계 노드 → 항목 노드 거리.
 *
 * 가지가 적으면 항목도 멀리 펼쳐 빈 화면을 메운다.
 */
function leafRadiusFor(filledCount: number, focusedMode: boolean): number {
  // 포커스 모드는 한 가지에 24개까지 펼쳐 부채꼴이 훨씬 커진다.
  // 같은 반지름을 쓰면 위아래가 뷰박스를 넘는다.
  if (focusedMode) return 130;
  return filledCount <= 2 ? 190 : 165;
}

/**
 * 라벨이 차지하는 가로 폭의 상한(문자 수 기준).
 *
 * 넘으면 말줄임한다. 라벨이 길어질수록 옆 가지를 침범하는데, 방사형에서는
 * 그게 곧 "읽을 수 없는 화면"이 된다.
 */
export const LABEL_MAX_CHARS = 10;

export interface Point {
  x: number;
  y: number;
}

export interface LeafNode extends Point {
  edge: PreferenceEdge;
  /** 라벨을 노드의 어느 쪽에 둘지 — 좌우 반쪽에 따라 뒤집어 화면 밖으로 안 나가게 */
  anchor: "start" | "end";
}

export interface BranchNode extends Point {
  predicate: PreferencePredicate;
  label: string;
  /** 그룹의 전체 항목 수 — 헤더 숫자이자 노드 크기·가지 굵기의 근거 */
  total: number;
  /** 실제로 그린 항목 */
  leaves: LeafNode[];
  /** 그리지 못하고 남은 수 — `+N` */
  overflow: number;
  isEmpty: boolean;
  anchor: "start" | "end" | "middle";
}

export interface GraphLayout {
  center: Point;
  branches: BranchNode[];
}

/**
 * 관계별 각도를 **항목 수에 비례해** 배분한다.
 *
 * 균등 72°로 나누지 않는 이유: `avoids`·`purchased`가 당분간 항상 비어 있어
 * 두 방향이 텅 빈 채 남으면 화면이 어색해진다. 가진 만큼 차지하게 하면 그
 * 비대칭이 "허전함"이 아니라 **"내 취향이 이쪽에 몰려 있다"는 정보**가 된다.
 *
 * 빈 그룹에도 최소 자리를 준다 — 지우면 "회피는 등록할 수 없나?"라는 오해가
 * 생기고, 강조하면 오류처럼 보인다. 자리만 지키게 한다.
 */
function allocateAngles(
  counts: Map<PreferencePredicate, number>,
  filled: PreferencePredicate[],
): Map<PreferencePredicate, number> {
  // 빈 그룹은 아래쪽 좁은 띠에만 모아 두고, 나머지 전부를 데이터가 있는
  // 그룹이 나눠 갖는다. 빈 그룹에 넉넉한 각도를 주면 "가장 잘 보이는 자리를
  // 빈 것이 차지하는" 화면이 된다.
  const emptyArc = emptyArcFor(PREDICATE_ORDER.length - filled.length);
  const usable = 360 - emptyArc;

  const weights = filled.map((p) => {
    const n = counts.get(p) ?? 0;
    // 개수를 그대로 쓰면 24 대 1에서 작은 쪽이 사라진다. 제곱근으로 눌러
    // 편차는 보이되 작은 그룹도 라벨이 들어갈 자리를 갖게 한다.
    return { predicate: p, weight: Math.sqrt(n) + 1.4 };
  });

  const total = weights.reduce((sum, w) => sum + w.weight, 0) || 1;
  const spans = new Map<PreferencePredicate, number>(
    weights.map((w) => [w.predicate, (w.weight / total) * usable]),
  );

  // 빈 그룹은 아래쪽 띠를 균등하게 나눈다
  const empties = PREDICATE_ORDER.filter((p) => !spans.has(p));
  for (const p of empties) {
    spans.set(p, emptyArc / Math.max(1, empties.length));
  }
  return spans;
}

/**
 * 빈 그룹 전체가 쓰는 아래쪽 띠의 각도 — 자리는 지키되 좁게.
 *
 * 다만 **개수에 비례해 늘린다.** 4개가 62°를 나눠 가지면 노드 간격이 ~50px라
 * "아직 없어요" 라벨이 서로 포개진다(실측). 하나당 34°는 확보한다.
 */
function emptyArcFor(emptyCount: number): number {
  return Math.min(150, Math.max(1, emptyCount) * 34);
}

/**
 * 데이터가 많은 그룹을 위·양옆, 빈 그룹을 아래로 보낸다.
 *
 * 눈이 먼저 가는 자리에 실제 내용이 오게 하는 배치다. 그룹의 **화면 배치만**
 * FE가 정하고, 그룹 **안** 항목 순서는 서버 것을 그대로 둔다(재정렬 금지).
 */
function orderBranchesForPlacement(
  counts: Map<PreferencePredicate, number>,
): { filled: PreferencePredicate[]; empty: PreferencePredicate[] } {
  return {
    filled: PREDICATE_ORDER.filter((p) => (counts.get(p) ?? 0) > 0),
    empty: PREDICATE_ORDER.filter((p) => (counts.get(p) ?? 0) === 0),
  };
}

/**
 * 세로를 눌러 타원으로 배치한다.
 *
 * 원으로 두면 세로로도 반지름만큼 퍼져 뷰박스 위아래가 남고 그래프가 작아진다.
 * 라벨은 가로로 길고 세로로는 한 줄이라, 세로를 눌러야 같은 면적에서
 * **더 크고 덜 겹치게** 그릴 수 있다.
 */
const Y_SQUASH = 0.72;

/**
 * 문자열 → 0~1 사이의 **결정적** 수.
 *
 * 배치에 변화를 주되 `Math.random()` 을 쓰지 않기 위한 것이다. 무작위면
 * 렌더할 때마다 그래프가 달라져 "데이터가 바뀌어도 노드가 과도하게 움직이지
 * 않는다"는 요건을 깬다. 해시는 같은 입력에 항상 같은 값이라 그 문제가 없다.
 *
 * FNV-1a 변형 — 암호학적 강도가 필요 없는 자리라 짧고 빠른 것으로 충분하다.
 */
function hashUnit(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // >>> 0 으로 부호를 없앤 뒤 0~1 로 정규화
  return ((h >>> 0) % 1000) / 1000;
}

function polar(angleDeg: number, radius: number, origin: Point): Point {
  // -90°에서 시작해 12시 방향이 0이 되게 한다(위쪽이 눈에 먼저 들어온다)
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: origin.x + Math.cos(rad) * radius,
    y: origin.y + Math.sin(rad) * radius * Y_SQUASH,
  };
}

/** 긴 라벨은 말줄임 — 방사형에서 긴 라벨은 옆 가지를 침범한다 */
export function truncateLabel(label: string): string {
  return label.length > LABEL_MAX_CHARS
    ? `${label.slice(0, LABEL_MAX_CHARS - 1)}…`
    : label;
}

/**
 * 라벨을 노드의 어느 쪽으로 뻗을지.
 *
 * **각도가 아니라 실제 좌표로 판정한다.** 항목은 가지에서 다시 뻗어 나가므로
 * 각도만 보면 중심 기준 좌우와 어긋날 수 있다(오른쪽 각도인데 좌표는 중심보다
 * 왼쪽인 경우). 왼쪽 반원에서 라벨을 오른쪽으로 뻗으면 화면 밖으로 나간다.
 */
function anchorFor(point: Point, origin: Point): "start" | "end" {
  return point.x >= origin.x ? "start" : "end";
}

/**
 * 취향 목록을 방사형 2단 그래프 좌표로 바꾼다.
 *
 * 구조는 `나 → 관계 → 대상` 2단계다. 대상끼리 잇는 링크가 데이터에 없어
 * (모든 관계가 `나 → 대상` 한 방향·한 단계) 다단계 그래프는 만들 수 없다.
 * 관계 5종이 **데이터에 실제로 있는 유일한 중간 단계**라 그것을 가지로 쓴다.
 *
 * @param focused 포커스 모드에서 확대할 관계. 있으면 그 관계만 상한이 커진다.
 */
export function buildGraphLayout(
  edges: readonly PreferenceEdge[],
  focused: PreferencePredicate | null = null,
): GraphLayout {
  const byPredicate = new Map<PreferencePredicate, PreferenceEdge[]>(
    PREDICATE_ORDER.map((p) => [p, []]),
  );
  for (const edge of edges) {
    byPredicate.get(edge.predicate)?.push(edge);
  }

  const counts = new Map(
    PREDICATE_ORDER.map((p) => [p, byPredicate.get(p)?.length ?? 0] as const),
  );

  const { filled, empty } = orderBranchesForPlacement(counts);
  const angleSpan = allocateAngles(counts, filled);

  const focusedMode = focused !== null;
  const branchRadius = branchRadiusFor(filled.length, focusedMode);
  const leafRadius = leafRadiusFor(filled.length, focusedMode);

  /*
    중심은 뷰박스 한가운데에 둔다.

    한때 가지가 적을 때 중심을 왼쪽으로 밀었는데, 가지를 오른쪽으로 눕히는
    보정(LEAN)과 겹쳐 **왼쪽 절반이 통째로 비는** 화면이 됐다. 지금은
    반지름이 가지 수에 반응하므로(branchRadiusFor) 중심을 옮길 필요가 없다.
  */
  const center: Point = { x: CENTER_X, y: CENTER_Y };

  const branches: BranchNode[] = [];

  // 배치 순서: 데이터 있는 그룹이 위(12시)를 중심으로 좌우로 퍼지고,
  // 빈 그룹은 아래(6시) 좁은 띠에 모인다. 12시에서 시작하려면 채워진
  // 그룹 전체 각도의 절반만큼 왼쪽에서 출발해야 대칭이 맞는다.
  const filledTotal = filled.reduce((sum, p) => sum + (angleSpan.get(p) ?? 0), 0);

  // 12시를 중심으로 좌우 대칭이 되게 시작점을 잡는다
  let cursor = -filledTotal / 2;

  const emptyArc = emptyArcFor(empty.length);
  const placement = [...filled, ...empty];
  for (const predicate of placement) {
    const span = angleSpan.get(predicate) ?? 0;
    // 빈 그룹 구간이 시작되면 6시 방향(180°)의 띠로 커서를 옮긴다
    if (predicate === empty[0]) cursor = 180 - emptyArc / 2;

    // 가지는 자기 몫의 한가운데에 놓는다
    const mid = cursor + span / 2;
    cursor += span;

    const groupEdges = byPredicate.get(predicate) ?? [];
    const total = groupEdges.length;
    const isEmpty = total === 0;

    const limit =
      focused === predicate ? GRAPH_ITEMS_FOCUSED : GRAPH_ITEMS_PER_BRANCH;
    // 서버 정렬을 보존한다 — 앞에서부터 자를 뿐 재정렬하지 않는다
    const shown = groupEdges.slice(0, limit);

    const branchPoint = polar(mid, branchRadius, center);

    /*
      항목을 가지 주변에 부채꼴로 펼친다.

      두 제약이 맞선다 — 좁게 펼치면 항목끼리 라벨이 겹치고, 넓게 펼치면 옆
      가지를 침범한다. 그래서 **가지가 받은 각도(span)**와 **항목 수에 필요한
      최소 각도** 중 큰 쪽을 쓰되, 상한을 둬 옆 가지까지 넘어가지는 않게 한다.

      항목당 최소 각도가 필요한 이유: 항목이 6개인데 span이 30°면 5°마다
      노드가 놓여 라벨이 반드시 겹친다. 가지 각도는 그룹 크기 비례라
      항목 수와 항상 맞아떨어지지 않는다.
    */
    // 세로를 눌러 배치하므로(Y_SQUASH) 같은 각도라도 세로 간격이 그만큼
    // 줄어든다. 그 몫까지 감안해 각도를 잡아야 실제 화면에서 안 겹친다.
    const PER_LEAF_ANGLE = 26; // 라벨 한 줄이 겹치지 않는 최소 간격
    // 가지가 적으면 옆 가지를 침범할 걱정이 없으니 더 넓게 펼쳐 화면을 쓴다
    const cap = filled.length <= 2 ? 210 : 170;
    const leafSpan = Math.min(
      Math.max(span * 0.75, Math.max(0, shown.length - 1) * PER_LEAF_ANGLE),
      cap,
    );

    const leaves: LeafNode[] = shown.map((edge, i) => {
      // 항목이 1개면 가지 방향 그대로, 여러 개면 부채꼴로 나눈다
      const offset =
        shown.length === 1 ? 0 : (i / (shown.length - 1) - 0.5) * leafSpan;

      /*
        반경에 약간의 변화를 준다 — 기계적인 부채꼴을 완화한다.

        모든 항목이 같은 거리에 놓이면 컴퍼스로 그린 호처럼 보여, 사람의
        취향 지도가 아니라 도식이 된다. 다만 **무작위는 쓰지 않는다** —
        렌더할 때마다 자리가 바뀌면 같은 데이터인데 다른 그림이 되고,
        수정 한 번에 화면이 통째로 흔들린다.

        그래서 edgeId 에서 뽑은 **결정적 해시**를 쓴다. 같은 항목은 언제나
        같은 자리이고, 항목이 바뀔 때만 그 항목의 자리가 바뀐다.

        폭은 ±7% 로 얕게 준다. 더 크면 부채꼴이 흐트러져 어느 가지 소속인지
        읽기 어려워지고, 라벨 간 세로 간격 보정(아래)도 예측이 어려워진다.
      */
      const jitter = 1 + (hashUnit(edge.edgeId) - 0.5) * 0.14;
      const point = polar(mid + offset, leafRadius * jitter, branchPoint);
      return { ...point, edge, anchor: anchorFor(point, center) };
    });

    /*
      세로 간격을 픽셀로 보정한다.

      **각도만으로는 간격을 보장할 수 없다.** 같은 26°라도 부채꼴의 어디에
      놓이느냐에 따라 실제 세로 거리가 달라지고(양 끝으로 갈수록 sin 변화가
      작아진다), Y_SQUASH가 세로를 한 번 더 누른다. 그래서 각도를 아무리
      키워도 라벨이 붙는 구간이 남는다 — 실측에서 6개(기본 상한)에서도 겹쳤다.

      라벨은 가로로 뻗는 한 줄이라 **세로로만 벌어지면 안 겹친다.** 각도 계산
      결과를 받아 y를 훑으며 최소 간격을 못 채운 항목을 아래로 민다.
      x는 건드리지 않는다 — 가지에서 뻗어 나온 방향이 흐트러지면 어느 가지에
      속한 항목인지 읽히지 않는다.
    */
    const MIN_LABEL_GAP = 21; // 라벨 한 줄 높이(17px) + 최소 여백
    const sorted = [...leaves].sort((a, b) => a.y - b.y);
    const before = { top: sorted[0]?.y ?? 0, bottom: sorted[sorted.length - 1]?.y ?? 0 };

    for (let i = 1; i < sorted.length; i += 1) {
      const gap = sorted[i].y - sorted[i - 1].y;
      if (gap < MIN_LABEL_GAP) sorted[i].y = sorted[i - 1].y + MIN_LABEL_GAP;
    }

    /*
      밀어낸 만큼 아래로 치우치므로 되돌린다.

      **원래 범위의 중심으로 맞춘다** — 가지 중심(branchPoint.y)으로 당기면
      부채꼴이 원래 그 위나 아래에 놓였을 때 통째로 끌려와 그래프가 세로로
      쪼그라든다(실측: 화면 세로 사용률 0.47까지 떨어져 "충분히 채운다"
      테스트가 걸렸다). 벌린 결과를 제자리에 두는 것이 목적이지
      가지 옆으로 모으는 게 아니다.
    */
    if (sorted.length > 1) {
      const shift =
        (sorted[0].y + sorted[sorted.length - 1].y) / 2 -
        (before.top + before.bottom) / 2;
      for (const leaf of sorted) leaf.y -= shift;

      /*
        뷰박스 안으로 되돌린다.

        중심을 맞추는 것만으로는 부족하다 — 가지가 하나뿐이면 그 가지가
        부채꼴 상한(210°)을 통째로 쓰고, 거기에 세로 보정까지 더해져 위아래로
        넘친다(실측: 200개 1가지에서 y가 -10까지 올라갔다).

        먼저 통째로 밀어 넣고, 그래도 넘치면 간격을 균등하게 줄인다.
        간격을 줄이는 쪽이 항목을 빼는 것보다 낫다 — MIN_LABEL_GAP은 여유를
        둔 값이라 조금 좁아져도 라벨이 곧바로 닿지는 않는다.
      */
      // 96px: 라벨이 뻗을 자리까지 감안한 가장자리 여백.
      // 그래프 테스트가 요구하는 값(90)보다 살짝 크게 잡아 경계에 딱 붙지 않게 한다.
      const MARGIN = 96;
      let top = sorted[0].y;
      let bottom = sorted[sorted.length - 1].y;

      const push = Math.max(0, MARGIN - top) - Math.max(0, bottom - (VIEWBOX_H - MARGIN));
      if (push !== 0) {
        for (const leaf of sorted) leaf.y += push;
        top += push;
        bottom += push;
      }

      const available = VIEWBOX_H - MARGIN * 2;
      if (bottom - top > available) {
        const scale = available / (bottom - top);
        const mid = (top + bottom) / 2;
        for (const leaf of sorted) leaf.y = mid + (leaf.y - mid) * scale;
      }
    }

    branches.push({
      ...branchPoint,
      predicate,
      label: PREDICATE_LABEL[predicate],
      total,
      leaves,
      overflow: Math.max(0, total - shown.length),
      isEmpty,
      anchor: isEmpty ? "middle" : anchorFor(branchPoint, center),
    });
  }

  // 반환 순서는 화면 배치 순서가 아니라 **계약 순서**로 되돌린다.
  // DOM 순서가 곧 탭 순서라, 시각 배치를 따라가면 키보드 이동이 뒤죽박죽이 된다.
  branches.sort(
    (a, b) =>
      PREDICATE_ORDER.indexOf(a.predicate) - PREDICATE_ORDER.indexOf(b.predicate),
  );

  return { center, branches };
}
