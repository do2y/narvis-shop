import { describe, expect, it } from "vitest";
import { withJosa } from "./josa";

describe("withJosa", () => {
  it("한글 받침 유무로 조사를 고른다", () => {
    expect(withJosa("맨투맨", "은")).toBe("맨투맨은"); // ㄴ 받침
    expect(withJosa("셔츠", "은")).toBe("셔츠는"); // 받침 없음
    expect(withJosa("바지", "이")).toBe("바지가");
    expect(withJosa("양말", "이")).toBe("양말이"); // ㄹ 받침
    expect(withJosa("모자", "을")).toBe("모자를");
    expect(withJosa("가방", "을")).toBe("가방을");
  });

  it("영문으로 끝나면 알파벳 이름의 받침을 따른다", () => {
    expect(withJosa("코튼 팬츠 XL", "은")).toBe("코튼 팬츠 XL은"); // 엘
    expect(withJosa("티셔츠 M", "은")).toBe("티셔츠 M은"); // 엠
    expect(withJosa("가디건 S", "은")).toBe("가디건 S는"); // 에스
    expect(withJosa("후디 V2 A", "은")).toBe("후디 V2 A는"); // 에이
  });

  it("숫자로 끝나면 읽는 소리의 받침을 따른다", () => {
    expect(withJosa("나이키 에어맥스 1", "은")).toBe("나이키 에어맥스 1은"); // 일
    expect(withJosa("버전 2", "은")).toBe("버전 2는"); // 이
    expect(withJosa("모델 3", "은")).toBe("모델 3은"); // 삼
    expect(withJosa("사이즈 5", "은")).toBe("사이즈 5는"); // 오
    expect(withJosa("제품 10", "은")).toBe("제품 10은"); // 십(영)
  });

  it("판별할 수 없는 문자로 끝나면 병기로 물러난다", () => {
    // 기호·이모지 등 — 틀린 조사를 붙이느니 "은(는)"으로 남긴다
    expect(withJosa("한정판!", "은")).toBe("한정판!은(는)");
    expect(withJosa("", "은")).toBe("은(는)");
  });

  it("상품명이 '외 N개'로 접힌 형태에도 맞는다", () => {
    // 주문 실패 문구는 상품이 많으면 "A, B 외 2개"로 접는다 — 조사는 '개'에 붙는다
    expect(withJosa("린넨 셔츠, 코튼 팬츠 외 2개", "은")).toBe(
      "린넨 셔츠, 코튼 팬츠 외 2개는",
    );
  });
});
