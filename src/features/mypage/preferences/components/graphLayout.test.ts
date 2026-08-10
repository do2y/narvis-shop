import { describe, expect, it } from "vitest";
import {
  buildGraphLayout,
  GRAPH_ITEMS_FOCUSED,
  GRAPH_ITEMS_PER_BRANCH,
  truncateLabel,
  VIEWBOX_H,
  VIEWBOX_W,
} from "./graphLayout";
import { PREDICATE_ORDER, type PreferenceEdge, type PreferencePredicate } from "../types";

function edge(id: string, predicate: PreferencePredicate, label = id): PreferenceEdge {
  return {
    edgeId: id,
    predicate,
    object: { nodeId: `attribute:${label}`, type: "attribute", label },
    editable: true,
    challenged: false,
  };
}

function many(predicate: PreferencePredicate, n: number): PreferenceEdge[] {
  return Array.from({ length: n }, (_, i) => edge(`${predicate}-${i}`, predicate));
}

describe("buildGraphLayout", () => {
  it("빈 그룹도 자리를 지켜 항상 5가지를 반환한다", () => {
    // avoids·purchased는 당분간 항상 비어 있다. 빼버리면 "회피는 등록할 수
    // 없나?"라는 오해가 생기므로 자리만 지켜야 한다.
    const { branches } = buildGraphLayout(many("prefers", 3));

    expect(branches).toHaveLength(5);
    expect(branches.filter((b) => b.isEmpty).map((b) => b.predicate)).toEqual([
      "likes",
      "avoids",
      "interestedIn",
      "purchased",
    ]);
  });

  it("반환 순서가 계약 순서다 — 화면 배치 순서를 따라가지 않는다", () => {
    // DOM 순서가 곧 탭 순서다. 시각 배치(데이터 많은 순)를 따라가면
    // 키보드 이동이 뒤죽박죽이 된다.
    const { branches } = buildGraphLayout([
      ...many("interestedIn", 5),
      ...many("prefers", 2),
    ]);

    expect(branches.map((b) => b.predicate)).toEqual([...PREDICATE_ORDER]);
  });

  it("항목이 많은 관계가 더 넓은 각도를 받는다", () => {
    // 균등 72° 배분이면 두 방향이 텅 빈 채 남아 화면이 어색해진다.
    // 가진 만큼 차지하게 해야 비대칭이 정보가 된다.
    const { center, branches } = buildGraphLayout([
      ...many("prefers", 24),
      ...many("likes", 2),
    ]);

    const spread = (p: PreferencePredicate) => {
      const branch = branches.find((b) => b.predicate === p)!;
      const angles = branch.leaves.map((leaf) =>
        Math.atan2(leaf.y - center.y, leaf.x - center.x),
      );
      return Math.max(...angles) - Math.min(...angles);
    };

    expect(spread("prefers")).toBeGreaterThan(spread("likes"));
  });

  it("관계당 상한을 넘으면 잘라내고 남은 수를 overflow로 알린다", () => {
    const { branches } = buildGraphLayout(many("prefers", 24));
    const prefers = branches.find((b) => b.predicate === "prefers")!;

    expect(prefers.total).toBe(24); // 헤더 숫자는 전체를 말한다
    expect(prefers.leaves).toHaveLength(GRAPH_ITEMS_PER_BRANCH);
    expect(prefers.overflow).toBe(24 - GRAPH_ITEMS_PER_BRANCH);
  });

  it("서버 정렬을 보존한다 — 앞에서부터 자를 뿐 재정렬하지 않는다", () => {
    const edges = [
      edge("a", "prefers", "첫째"),
      edge("b", "prefers", "둘째"),
      edge("c", "prefers", "셋째"),
    ];
    const { branches } = buildGraphLayout(edges);
    const prefers = branches.find((b) => b.predicate === "prefers")!;

    expect(prefers.leaves.map((l) => l.edge.object.label)).toEqual([
      "첫째",
      "둘째",
      "셋째",
    ]);
  });

  it("포커스 모드에서는 그 관계만 상한이 커진다", () => {
    // 상한 값을 테스트에 적지 않는다 — 상수를 바꿀 때마다 여기가 깨진다.
    // (실제로 GRAPH_ITEMS_FOCUSED를 24→8로 내렸을 때 이 테스트가 걸렸다)
    const edges = [
      ...many("prefers", GRAPH_ITEMS_FOCUSED + 4),
      ...many("likes", GRAPH_ITEMS_PER_BRANCH + 4),
    ];
    const { branches } = buildGraphLayout(edges, "prefers");

    const prefers = branches.find((b) => b.predicate === "prefers")!;
    const likes = branches.find((b) => b.predicate === "likes")!;

    // 포커스된 가지는 더 많이 보여준다
    expect(prefers.leaves).toHaveLength(GRAPH_ITEMS_FOCUSED);
    expect(prefers.overflow).toBe(4);
    expect(GRAPH_ITEMS_FOCUSED).toBeGreaterThan(GRAPH_ITEMS_PER_BRANCH);
    // 다른 가지는 그대로 — 포커스는 한 그룹만 확대한다
    expect(likes.leaves).toHaveLength(GRAPH_ITEMS_PER_BRANCH);
    expect(likes.overflow).toBe(4);
  });

  it("항목이 1개면 가지와 같은 방향으로 뻗는다", () => {
    const { center, branches } = buildGraphLayout([edge("solo", "prefers")]);
    const prefers = branches.find((b) => b.predicate === "prefers")!;
    const leaf = prefers.leaves[0];

    // 중심 → 가지 방향과 가지 → 항목 방향이 같아야 한다(부채꼴 분산 없음).
    // 세로를 눌러 배치하므로(Y_SQUASH) 각도가 아니라 두 벡터의 방향을 본다.
    const toBranch = Math.atan2(prefers.y - center.y, prefers.x - center.x);
    const toLeaf = Math.atan2(leaf.y - prefers.y, leaf.x - prefers.x);
    expect(Math.abs(toBranch - toLeaf)).toBeLessThan(0.001);
  });

  it("빈 그룹은 아래쪽에 모이고, 데이터 있는 그룹보다 낮게 놓인다", () => {
    // 눈이 먼저 가는 자리를 빈 것이 차지하면 화면이 허전해 보인다.
    // (가지가 적을 때는 가로로 눕히므로 "무조건 중심 위"는 아니다 —
    //  중요한 것은 채운 그룹이 빈 그룹보다 위에 있다는 순서다)
    for (const edges of [
      [...many("prefers", 8), ...many("likes", 4)],
      [...many("prefers", 6), ...many("likes", 3), ...many("interestedIn", 2)],
    ]) {
      const { center, branches } = buildGraphLayout(edges);
      const empties = branches.filter((b) => b.isEmpty);
      const fills = branches.filter((b) => !b.isEmpty);

      // 빈 그룹은 전부 중심 아래쪽 띠에 있다
      for (const b of empties) expect(b.y).toBeGreaterThan(center.y);
      // 그리고 어떤 채운 그룹보다도 아래에 있다
      const lowestFill = Math.max(...fills.map((b) => b.y));
      for (const b of empties) expect(b.y).toBeGreaterThan(lowestFill);
    }
  });

  it("항목이 많아도 이웃 라벨이 겹치지 않는다", () => {
    // 가지 각도는 그룹 크기 비례라 항목 수와 항상 맞아떨어지지 않는다.
    // 좁은 가지에 6개가 몰리면 라벨이 겹친다.
    //
    // 겹침 판정은 라벨을 사각형으로 보고 두 축을 함께 본다 — 세로로 붙어
    // 있어도 가로로 충분히 벌어졌으면 겹치지 않는다(그 반대도 마찬가지).
    const LABEL_H = 26; // 글자 높이 + 여유
    const LABEL_W = 46; // 말줄임 라벨이 시작점에서 차지하는 최소 폭

    for (const size of [6, 12, 24]) {
      const { branches } = buildGraphLayout([
        ...many("prefers", size),
        ...many("likes", 40), // prefers의 각도 몫을 좁게 만든다
      ]);
      const leaves = branches.find((b) => b.predicate === "prefers")!.leaves;

      for (let i = 1; i < leaves.length; i++) {
        const dy = Math.abs(leaves[i].y - leaves[i - 1].y);
        const dx = Math.abs(leaves[i].x - leaves[i - 1].x);
        // 한 축이라도 라벨 크기만큼 떨어지면 겹치지 않는다
        expect(dy >= LABEL_H || dx >= LABEL_W).toBe(true);
      }
    }
  });
});

describe("truncateLabel", () => {
  it("짧은 라벨은 그대로 둔다", () => {
    expect(truncateLabel("무선")).toBe("무선");
  });

  it("긴 라벨은 말줄임한다 — 옆 가지를 침범하기 때문이다", () => {
    const long = "노이즈캔슬링 블루투스 이어폰";
    const result = truncateLabel(long);

    expect(result.length).toBeLessThan(long.length);
    expect(result.endsWith("…")).toBe(true);
  });

  it("라벨 앵커가 좌우 반원에 따라 뒤집힌다", () => {
    // 왼쪽 반원 항목의 라벨을 오른쪽으로 뻗으면 화면 밖으로 나간다.
    const { center, branches } = buildGraphLayout(many("prefers", 12), "prefers");
    const leaves = branches.find((b) => b.predicate === "prefers")!.leaves;

    for (const leaf of leaves) {
      expect(leaf.anchor).toBe(leaf.x >= center.x ? "start" : "end");
    }
  });

  it("가지가 적어도 그래프가 화면을 충분히 채운다", () => {
    // 반지름을 고정하면 가지가 적을 때 화면 한가운데 작게 뭉친다
    // (실측: 1가지에서 가로의 33%만 사용). 가지 수에 따라 반지름이
    // 반응해야 한다 — 이 화면의 핵심 콘텐츠가 작게 보이면 안 된다.
    for (const edges of [
      many("prefers", 200), // 실제로 겪은 경우: 가지 1개
      [edge("solo", "prefers")],
      [...many("prefers", 6), ...many("likes", 4)],
    ]) {
      const { branches } = buildGraphLayout(edges);
      const all = [...branches, ...branches.flatMap((b) => b.leaves)];
      const xs = all.map((n) => n.x);
      const ys = all.map((n) => n.y);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...ys) - Math.min(...ys);

      expect(w / VIEWBOX_W).toBeGreaterThan(0.35);
      expect(h / VIEWBOX_H).toBeGreaterThan(0.5);
    }
  });

  it("빈 그룹끼리도 라벨이 겹치지 않게 벌어진다", () => {
    // 빈 그룹 4개가 좁은 띠를 나눠 가지면 "아직 없어요"가 서로 포개진다.
    const { branches } = buildGraphLayout(many("prefers", 20));
    const empties = branches.filter((b) => b.isEmpty);

    for (let i = 1; i < empties.length; i++) {
      const dx = Math.abs(empties[i].x - empties[i - 1].x);
      const dy = Math.abs(empties[i].y - empties[i - 1].y);
      // "아직 없어요"가 들어갈 가로 폭(~90) 또는 두 줄 높이(~44)만큼은 떨어져야
      expect(dx >= 90 || dy >= 44).toBe(true);
    }
  });

  it("가지가 적어도 그래프가 화면 중앙에 균형 있게 놓인다", () => {
    // 가지 하나가 12시에 서면 세로로만 자라 가로가 텅 빈다(실측 13%).
    // 눕히기(LEAN)와 중심 이동(CENTER_SHIFT)이 함께 동작해야 가운데 온다.
    for (const edges of [
      [edge("solo", "prefers")],
      many("prefers", 24),
      [...many("prefers", 6), ...many("likes", 3)],
    ]) {
      const { branches } = buildGraphLayout(edges);
      const all = [...branches, ...branches.flatMap((b) => b.leaves)];
      const xs = all.map((n) => n.x);
      const mid = (Math.min(...xs) + Math.max(...xs)) / 2;

      // 그래프의 가로 중앙이 뷰박스 중앙에서 크게 벗어나지 않아야 한다
      expect(Math.abs(mid - VIEWBOX_W / 2)).toBeLessThan(90);
    }
  });

  it("빈 그래프에서도 5가지를 반환하고 좌표가 유한하다", () => {
    // exists: false / edges: [] 는 오류가 아니라 신규 회원의 정상 상태다.
    const { branches } = buildGraphLayout([]);

    expect(branches).toHaveLength(5);
    for (const branch of branches) {
      expect(Number.isFinite(branch.x)).toBe(true);
      expect(Number.isFinite(branch.y)).toBe(true);
      expect(branch.leaves).toHaveLength(0);
      expect(branch.overflow).toBe(0);
    }
  });

  it("포커스 모드에서 라벨 사각형이 겹치지 않는다", () => {
    /*
      ⚠️ 회귀 방지 — 실제로 겪은 버그다.

      포커스 상한이 24인데 부채꼴 각도만으로 간격을 잡아서, 항목당 9°가 되어
      라벨 18쌍이 서로 포개졌다. buildGraphLayout이 세로 간격을 픽셀로 보정하게
      고쳐 해결했다(개수를 줄여서가 아니다 — 24개 그대로 겹침 0이 된다).

      **노드 거리가 아니라 라벨 사각형으로 검증한다.** 이 구분이 이 테스트의
      핵심이다 — 처음엔 노드 중심 간 거리로 쟀는데, 노드는 점이라 25px만
      떨어져도 통과하지만 라벨은 가로 150px짜리 글자라 그대로 겹쳤다.
      화면에서 겹치는 것은 점이 아니라 글자다.

      라벨이 **뷰박스 안에 있는지**도 함께 본다. 겹침은 픽셀 보정이 막아주지만,
      그 보정이 항목을 세로로 밀어내므로 개수가 늘면 화면 밖으로 나간다
      (실측: 32개부터 이탈 시작). 지금 상한 24는 그 앞이다.

      폭 추정은 PreferenceGraph.labelWidth와 같은 규칙을 쓴다(한글은 폰트
      크기와 거의 같고 영숫자는 그 절반쯤). SVG에는 렌더 전에 텍스트 폭을
      알 방법이 없어 양쪽 다 추정치를 쓴다.
    */
    const FONT = 17;
    const labelWidth = (label: string) =>
      [...label].reduce(
        (sum, ch) => sum + (/[ᄀ-ᇿ㄰-㆏가-힯一-鿿]/.test(ch) ? FONT : FONT * 0.55),
        0,
      );

    const { branches } = buildGraphLayout(
      [...many("prefers", 82), ...many("likes", 54)],
      "prefers",
    );

    for (const branch of branches) {
      // 라벨은 노드에서 anchor 방향으로 뻗는다(그래프의 gap = ±15)
      const boxes = branch.leaves.map((leaf) => {
        const width = labelWidth(truncateLabel(leaf.edge.object.label));
        const left = leaf.anchor === "start" ? leaf.x + 15 : leaf.x - 15 - width;
        return { left, right: left + width, top: leaf.y - 9, bottom: leaf.y + 9 };
      });

      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i];
          const b = boxes[j];
          const overlaps =
            a.left < b.right &&
            b.left < a.right &&
            a.top < b.bottom &&
            b.top < a.bottom;
          expect(overlaps).toBe(false);
        }
      }

      // 세로 보정이 항목을 밀어내므로 상한을 올리면 화면 밖으로 나간다.
      // 겹침만 보면 이 이탈을 놓친다 — 겹치지 않으면서 화면 밖일 수 있다.
      for (const box of boxes) {
        expect(box.top).toBeGreaterThan(0);
        expect(box.bottom).toBeLessThan(VIEWBOX_H);
        expect(box.left).toBeGreaterThan(0);
        expect(box.right).toBeLessThan(VIEWBOX_W);
      }
    }
  });

  it("항목이 200개여도 좌표가 뷰박스를 벗어나지 않는다", () => {
    // 서버 상한이 폐지돼 전량 온다. 상한을 넘겨도 레이아웃이 깨지면 안 된다.
    // 라벨이 뻗을 자리가 필요해 가장자리에서 여유를 둔다.
    const MARGIN = 90;
    const { branches } = buildGraphLayout(many("prefers", 200), "prefers");

    for (const node of [...branches, ...branches.flatMap((b) => b.leaves)]) {
      expect(node.x).toBeGreaterThan(MARGIN);
      expect(node.x).toBeLessThan(VIEWBOX_W - MARGIN);
      expect(node.y).toBeGreaterThan(MARGIN);
      expect(node.y).toBeLessThan(VIEWBOX_H - MARGIN);
    }
  });
});
