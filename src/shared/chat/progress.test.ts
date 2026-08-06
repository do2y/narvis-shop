import { describe, expect, it } from "vitest";
import {
  BUYER_PROGRESS_LABEL,
  KNOWN_BUYER_PROGRESS_STAGES,
} from "@/shared/types/chat";
import { resolveProgressText } from "./progress";
import { useChatStore } from "./store";

/**
 * 구매자 progress — 계약 CH-2 §progress (다단계화 2026-08-06, jarvis-ai#402·#407).
 *
 * 회귀 방지 대상은 계약이 FE 에 위임한 두 규약이다:
 *  1. 모르는 stage 는 무시한다 (어휘가 개방형 — retrying 등이 예고돼 있다)
 *  2. progress 는 다회 온다 — 덮어쓰기로 동작해야 한다
 * 어느 쪽이든 깨지면 AI 가 stage 를 추가할 때 FE 배포를 기다려야 하거나,
 * 진행 표시가 중간 단계에서 멈춘 채로 남는다.
 */
describe("resolveProgressText", () => {
  it("서버 message 가 있으면 그대로 쓴다 — 문구 정본은 AI 다", () => {
    expect(
      resolveProgressText({ stage: "searching", message: "상품 찾는 중" }),
    ).toBe("상품 찾는 중");
  });

  it("message 가 없으면 stage 로 자체 문구를 매핑한다(계약이 위임한 폴백)", () => {
    expect(resolveProgressText({ stage: "publishing" })).toBe(
      "추천 목록을 준비하고 있어요",
    );
  });

  it("알려진 7종 전부 폴백 문구를 갖는다 — 하나라도 비면 점 애니메이션만 남는다", () => {
    for (const stage of KNOWN_BUYER_PROGRESS_STAGES) {
      expect(resolveProgressText({ stage })).toBeTruthy();
    }
  });

  it("모르는 stage 는 무시한다 — 예외를 던지지 않고 null 로 흘려보낸다", () => {
    // retrying 은 후속 예고(jarvis-ai#406). 그 배포가 FE 보다 먼저 나가도 깨지지 않아야 한다.
    expect(resolveProgressText({ stage: "retrying" })).toBeNull();
    expect(resolveProgressText({ stage: "" })).toBeNull();
  });

  it("모르는 stage 여도 서버가 문구를 실었으면 표시한다 — 어휘를 몰라도 문구는 유효하다", () => {
    expect(
      resolveProgressText({ stage: "retrying", message: "다시 시도 중이에요" }),
    ).toBe("다시 시도 중이에요");
  });

  it("판매자 페이로드({text})는 자유 문자열 그대로 쓴다 — 구매자와 쉐이프가 다르다", () => {
    expect(resolveProgressText({ text: "매출 데이터를 모으는 중" })).toBe(
      "매출 데이터를 모으는 중",
    );
    expect(resolveProgressText({ text: "" })).toBeNull();
  });
});

describe("progress 다회 수신", () => {
  it("나중 단계가 앞 단계를 덮는다 — progress 는 스칼라 슬롯이다", () => {
    const { setProgress } = useChatStore.getState();

    for (const stage of KNOWN_BUYER_PROGRESS_STAGES) {
      const text = resolveProgressText({ stage });
      if (text) setProgress(text);
    }

    expect(useChatStore.getState().progress).toBe(
      BUYER_PROGRESS_LABEL.publishing,
    );
  });

  it("모르는 stage 는 직전 문구를 지우지 않는다 — 무시는 초기화가 아니다", () => {
    const { setProgress } = useChatStore.getState();

    const known = resolveProgressText({ stage: "searching" });
    if (known) setProgress(known);

    // 호출부(useChat)와 같은 방식 — null 이면 setProgress 를 부르지 않는다
    const unknown = resolveProgressText({ stage: "brand-new-stage" });
    if (unknown) setProgress(unknown);

    expect(useChatStore.getState().progress).toBe(
      BUYER_PROGRESS_LABEL.searching,
    );
  });
});
