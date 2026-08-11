import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./markdown";

/** 인라인 조각에서 텍스트만 이어붙인다 — 강조 위치가 관심사가 아닌 검사용 */
function textOf(inlines: { text: string }[]): string {
  return inlines.map((i) => i.text).join("");
}

/** 챗 말풍선 설정 — AI팀과 합의한 4종만 */
const CHAT = { headings: false, danglingEmphasis: true } as const;

describe("parseMarkdown — 합의된 4종 문법", () => {
  it("불릿 목록을 하나로 묶는다", () => {
    const blocks = parseMarkdown("- 블랙 / M\n- 화이트 / L", CHAT);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "list", ordered: false, start: 1 });
  });

  it("번호 목록을 순서 있는 목록으로 읽는다", () => {
    const blocks = parseMarkdown("1. 블랙 / M\n2. 화이트 / L", CHAT);
    expect(blocks).toHaveLength(1);
    if (blocks[0].type === "list") {
      expect(blocks[0].ordered).toBe(true);
      expect(blocks[0].items.map(textOf)).toEqual(["블랙 / M", "화이트 / L"]);
    }
  });

  it("원문의 첫 번호를 start로 보존한다 — 사용자가 부를 번호와 어긋나면 안 된다", () => {
    const [block] = parseMarkdown("3. 세 번째\n4. 네 번째", CHAT);
    expect(block).toMatchObject({ type: "list", ordered: true, start: 3 });
  });

  it("불릿과 번호가 섞이면 별개의 목록으로 나눈다", () => {
    const blocks = parseMarkdown("- 하나\n1. 둘", CHAT);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ ordered: false });
    expect(blocks[1]).toMatchObject({ ordered: true });
  });

  it("**강조**를 인라인으로 가른다", () => {
    const [block] = parseMarkdown("발견 **3건**을 정리했어요", CHAT);
    if (block.type === "paragraph") {
      expect(block.inlines).toEqual([
        { text: "발견 ", bold: false },
        { text: "3건", bold: true },
        { text: "을 정리했어요", bold: false },
      ]);
    }
  });

  it("줄바꿈으로 문단을 나눈다", () => {
    const blocks = parseMarkdown("첫 줄\n둘째 줄", CHAT);
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "paragraph"]);
  });
});

describe("parseMarkdown — 범위 밖 문법은 평문", () => {
  // AI팀이 안 보내기로 했지만, 새면 화면에 마커째 드러나 회귀가 눈에 띄어야 한다.
  it.each([
    ["제목", "# 발견 사항"],
    ["링크", "[클릭](https://evil.example)"],
    ["이미지", "![alt](https://evil.example/x.png)"],
    ["인용", "> 인용문"],
    ["코드블록", "```js"],
    ["인라인 코드", "`code`"],
    ["수평선", "---"],
    ["표", "| 열 | 열 |"],
  ])("%s은 글자 그대로 남는다", (_, input) => {
    const [block] = parseMarkdown(input, CHAT);
    expect(block.type).toBe("paragraph");
    if (block.type === "paragraph") {
      expect(textOf(block.inlines)).toBe(input);
    }
  });

  it("중첩 목록은 평평해진다 — 들여쓰기는 트림되어 한 단계 목록이 된다", () => {
    const blocks = parseMarkdown("- 부모\n  - 자식", CHAT);
    expect(blocks).toHaveLength(1);
    if (blocks[0].type === "list") {
      expect(blocks[0].items.map(textOf)).toEqual(["부모", "자식"]);
    }
  });
});

describe("parseMarkdown — 신뢰 경계", () => {
  // token.text 에는 사용자 발화와 판매자가 등록한 상품·옵션명이 그대로 실린다.
  // 파서가 HTML을 해석하지 않으므로 렌더 시점에 React가 이스케이프한다.
  it("HTML 태그를 해석하지 않고 텍스트로 남긴다", () => {
    const input = '<img src=x onerror="alert(1)">';
    const [block] = parseMarkdown(input, CHAT);
    if (block.type === "paragraph") {
      expect(textOf(block.inlines)).toBe(input);
    }
  });

  it("상품명에 섞인 script 태그도 평문이다", () => {
    const input = '반팔티 <script>alert("xss")</script> 블랙';
    const [block] = parseMarkdown(input, CHAT);
    if (block.type === "paragraph") {
      expect(textOf(block.inlines)).toBe(input);
    }
  });

  it("javascript: 링크는 문법을 열지 않아 경로 자체가 없다", () => {
    const input = "[클릭](javascript:alert(1))";
    const [block] = parseMarkdown(input, CHAT);
    if (block.type === "paragraph") {
      expect(textOf(block.inlines)).toBe(input);
    }
  });
});

describe("parseMarkdown — 스트리밍 중간 상태", () => {
  // 토큰이 한 글자씩 도착하는 동안의 프레임들. 별표가 깜빡였다 사라지면 안 된다.
  it("닫히지 않은 **부터는 미리 강조로 렌더한다", () => {
    const [block] = parseMarkdown("발견 **3건", CHAT);
    if (block.type === "paragraph") {
      expect(block.inlines).toEqual([
        { text: "발견 ", bold: false },
        { text: "3건", bold: true },
      ]);
    }
  });

  it("** 만 도착한 순간에는 굵힐 내용이 없어 조각을 만들지 않는다", () => {
    const [block] = parseMarkdown("발견 **", CHAT);
    if (block.type === "paragraph") {
      expect(block.inlines).toEqual([{ text: "발견 ", bold: false }]);
    }
  });

  it("닫는 **가 도착해도 굵기가 그대로라 글자가 튀지 않는다", () => {
    const frames = ["발견 **3", "발견 **3건", "발견 **3건**"];
    for (const frame of frames) {
      const [block] = parseMarkdown(frame, CHAT);
      if (block.type === "paragraph") {
        // 어느 프레임에서도 별표가 화면 글자로 새지 않는다
        expect(textOf(block.inlines)).not.toContain("*");
        expect(block.inlines.at(-1)?.bold).toBe(true);
      }
    }
  });

  it("정적 문서(danglingEmphasis off)에서는 짝 없는 **가 평문이다", () => {
    const [block] = parseMarkdown("**닫히지 않은 강조", { headings: true });
    if (block.type === "paragraph") {
      expect(block.inlines).toEqual([
        { text: "**닫히지 않은 강조", bold: false },
      ]);
    }
  });
});

describe("parseMarkdown — 빈 입력", () => {
  it("빈 문자열은 블록이 없다", () => {
    expect(parseMarkdown("", CHAT)).toEqual([]);
  });

  it("공백뿐인 문자열도 블록이 없다", () => {
    expect(parseMarkdown("   \n\n  \n", CHAT)).toEqual([]);
  });

  it("마커만 있고 내용이 없는 줄은 버린다", () => {
    expect(parseMarkdown("- \n1. \n#  ", CHAT)).toEqual([]);
  });
});
