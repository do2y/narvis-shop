import { describe, expect, it } from "vitest";
import { canSubmit, imageUrlsFor, type AttachState } from "./attachment";

/**
 * 이미지 첨부 전송 규칙 — 계약이 FE 에 위임한 두 가지를 고정한다.
 *
 *  1. imageUrls 는 **새로 첨부한 턴에만** 나간다.
 *     후속 턴에도 실으면 AI 가 매 턴 사진을 재분석해 상품명이 흔들린다.
 *     응답 자체는 그럴듯하게 오므로 화면만 보고는 알아채기 어렵다.
 *  2. 업로드가 끝나기 전에는 전송할 수 없다.
 *     통과시키면 URL 없이 요청이 나가 이미지 없는 초안이 만들어지는데,
 *     판매자는 사진을 올렸다고 믿는다.
 */

const idle: AttachState = { status: "idle" };
const uploading: AttachState = {
  status: "uploading",
  previewUrl: "blob:x",
  fileName: "shirt.jpg",
};
const ready: AttachState = {
  status: "ready",
  previewUrl: "blob:x",
  imageUrl: "https://bucket.s3.example/seller/7/a3f1.jpg",
  fileName: "shirt.jpg",
};
const failed: AttachState = {
  status: "failed",
  message: "이미지를 올리지 못했어요.",
  retryFile: null,
};

describe("imageUrlsFor", () => {
  it("ready 일 때만 URL 을 싣는다", () => {
    expect(imageUrlsFor(ready)).toEqual([
      "https://bucket.s3.example/seller/7/a3f1.jpg",
    ]);
  });

  it("첨부가 없으면 보내지 않는다 — 이게 후속 턴의 상태다", () => {
    // 전송 후 호출부가 idle 로 되돌리므로 다음 턴은 자동으로 undefined 가 된다.
    // 여기가 깨지면 매 턴 재분석이 돈다.
    expect(imageUrlsFor(idle)).toBeUndefined();
  });

  it("업로드 중에는 보내지 않는다 — URL 이 아직 없다", () => {
    expect(imageUrlsFor(uploading)).toBeUndefined();
  });

  it("업로드에 실패했으면 보내지 않는다", () => {
    expect(imageUrlsFor(failed)).toBeUndefined();
  });
});

describe("canSubmit", () => {
  it("업로드 중에는 막는다", () => {
    // 통과시키면 이미지 없는 초안이 만들어지고 판매자는 올렸다고 믿는다
    expect(canSubmit({ text: "이거 등록해줘", attach: uploading })).toBe(false);
  });

  it("업로드가 끝났으면 보낼 수 있다", () => {
    expect(canSubmit({ text: "이거 등록해줘", attach: ready })).toBe(true);
  });

  it("실패는 막지 않는다 — 이미지 없이 보낼지는 판매자가 정한다", () => {
    expect(canSubmit({ text: "그냥 보낼게", attach: failed })).toBe(true);
  });

  it("텍스트가 없어도 이미지가 준비됐으면 보낼 수 있다", () => {
    // 사진만 올리고 다음 턴에 가격·재고를 말하는 2턴 흐름이 계약에 있다.
    expect(canSubmit({ text: "", attach: ready })).toBe(true);
    expect(canSubmit({ text: "   ", attach: ready })).toBe(true);
  });

  it("텍스트도 이미지도 없으면 막는다", () => {
    expect(canSubmit({ text: "", attach: idle })).toBe(false);
    expect(canSubmit({ text: "   ", attach: idle })).toBe(false);
    // 실패한 첨부는 보낼 URL 이 없다 — 빈 요청이 나가면 400 이다
    expect(canSubmit({ text: "", attach: failed })).toBe(false);
  });

  it("스트리밍 중(disabled)에는 막는다", () => {
    expect(canSubmit({ text: "안녕", attach: idle, disabled: true })).toBe(
      false,
    );
  });
});
