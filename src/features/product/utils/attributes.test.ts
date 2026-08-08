import { describe, expect, it } from "vitest";
import { toSpecRows } from "./attributes";

describe("toSpecRows", () => {
  it("미기재 관용구를 제외한다", () => {
    const rows = toSpecRows({
      제조국: "미표기",
      소재: "표기없음",
      원산지: "표시없음",
      크기: "정보없음",
      브랜드: "카시오",
    });
    expect(rows).toEqual([{ label: "브랜드", value: "카시오" }]);
  });

  it("띄어쓰기만 다른 관용구도 같이 제외한다", () => {
    expect(toSpecRows({ a: "표기 없음", b: "표기없음" })).toEqual([]);
  });

  it('"상세설명참조" 계열은 상세 이미지를 보라는 안내라 남긴다', () => {
    const rows = toSpecRows({
      KC인증정보: "상세설명참조",
      제조국: "상세페이지 참조",
    });
    expect(rows).toHaveLength(2);
  });

  // 부분 일치로 거르면 사라지는 값들 — 진짜 속성이므로 반드시 남아야 한다.
  it('"없음"이 포함된 실제 속성값은 남긴다', () => {
    const rows = toSpecRows({
      안감: "안감없음",
      지퍼: "지퍼없음",
      장식: "큐빅없음",
      바퀴: "바퀴없음",
    });
    expect(rows).toHaveLength(4);
  });

  it('"해당없음"·"없음"은 유효한 확인값이라 남긴다', () => {
    const rows = toSpecRows({ 기능성: "해당없음", 부작용: "없음" });
    expect(rows).toEqual([
      { label: "기능성", value: "해당없음" },
      { label: "부작용", value: "없음" },
    ]);
  });

  it("null·빈 문자열·객체 값은 제외한다", () => {
    const rows = toSpecRows({
      성별: null,
      방수여부: "",
      메타: { foo: "bar" },
      색상: "블랙",
    });
    expect(rows).toEqual([{ label: "색상", value: "블랙" }]);
  });

  it("배열은 나열하되 원소의 미기재 관용구는 걸러낸다", () => {
    const rows = toSpecRows({
      구성품: ["정품박스", "미표기", "  ", "보증서"],
      부속품: ["정보없음"],
    });
    expect(rows).toEqual([{ label: "구성품", value: "정품박스, 보증서" }]);
  });

  it("옵션구성은 옵션 선택 UI가 따로 있어 표에서 뺀다", () => {
    expect(toSpecRows({ 옵션구성: "3종세트" })).toEqual([]);
  });

  it("attributes가 없으면 빈 배열", () => {
    expect(toSpecRows(undefined)).toEqual([]);
  });
});
