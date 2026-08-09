import { describe, expect, it } from "vitest";
import { parseSummary } from "./parseSummary";

// 인라인 조각에서 텍스트만 이어붙인다 — 강조 위치가 관심사가 아닌 검사용
function textOf(inlines: { text: string }[]): string {
  return inlines.map((i) => i.text).join("");
}

describe("parseSummary — 지원 문법", () => {
  it("제목을 레벨과 함께 읽는다", () => {
    expect(parseSummary("## 취향 요약")).toEqual([
      { type: "heading", level: 2, inlines: [{ text: "취향 요약", bold: false }] },
    ]);
  });

  it("#### 이상은 제목으로 보지 않는다 — 요약에 쓸 깊이가 아니다", () => {
    const [block] = parseSummary("#### 너무 깊은 제목");
    expect(block.type).toBe("paragraph");
  });

  it("연속된 목록 항목을 하나의 목록으로 묶는다", () => {
    const blocks = parseSummary("- 첫째\n- 둘째\n* 셋째");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("list");
    if (blocks[0].type === "list") {
      expect(blocks[0].items.map(textOf)).toEqual(["첫째", "둘째", "셋째"]);
    }
  });

  it("빈 줄로 끊기면 목록이 나뉜다", () => {
    const blocks = parseSummary("- 첫째\n\n- 둘째");
    expect(blocks.filter((b) => b.type === "list")).toHaveLength(2);
  });

  it("**강조**를 인라인으로 가른다", () => {
    const [block] = parseSummary("**3~5만원대** 무선 이어폰을 선호해요");
    expect(block.type).toBe("paragraph");
    if (block.type === "paragraph") {
      expect(block.inlines).toEqual([
        { text: "3~5만원대", bold: true },
        { text: " 무선 이어폰을 선호해요", bold: false },
      ]);
    }
  });

  it("짝이 맞지 않는 **는 평문으로 남긴다", () => {
    const [block] = parseSummary("**닫히지 않은 강조");
    if (block.type === "paragraph") {
      expect(block.inlines).toEqual([
        { text: "**닫히지 않은 강조", bold: false },
      ]);
    }
  });
});

describe("parseSummary — 신뢰 경계", () => {
  // LLM 생성 문자열이라 HTML이 섞여 올 수 있다. 파싱하지 않고 글자로 남겨야
  // 렌더 시점에 React가 이스케이프한다(dangerouslySetInnerHTML을 쓰지 않음).
  it("HTML 태그를 해석하지 않고 텍스트로 남긴다", () => {
    const [block] = parseSummary('<script>alert("xss")</script>');
    expect(block.type).toBe("paragraph");
    if (block.type === "paragraph") {
      expect(textOf(block.inlines)).toBe('<script>alert("xss")</script>');
    }
  });

  it("이미지·링크 문법도 평문이다 — 피싱 표면을 열지 않는다", () => {
    const [block] = parseSummary("[클릭](https://evil.example)");
    if (block.type === "paragraph") {
      expect(textOf(block.inlines)).toBe("[클릭](https://evil.example)");
    }
  });
});

describe("parseSummary — 빈 입력", () => {
  it("빈 문자열은 블록이 없다", () => {
    expect(parseSummary("")).toEqual([]);
  });

  it("공백뿐인 문자열도 블록이 없다", () => {
    expect(parseSummary("   \n\n  \n")).toEqual([]);
  });

  it("마커만 있고 내용이 없는 줄은 버린다", () => {
    expect(parseSummary("- \n#  ")).toEqual([]);
  });
});
