import { describe, expect, it } from "vitest";
import { shouldAttachSessionKey } from "./client";

/**
 * X-Session-Key 부착 대상 판정 (E-1).
 *
 * 붙는 곳이 곧 "서버가 행동 이벤트를 적재하는 지점"이라, 조건이 조용히 어긋나면
 * 결제·담기는 정상인데 이벤트만 빠져 퍼널이 빈다. 에러가 안 나는 종류라 테스트로 고정한다.
 */
describe("shouldAttachSessionKey", () => {
  it("담기·수량변경·삭제(C-2·C-3·C-4)에 붙는다", () => {
    expect(shouldAttachSessionKey("/api/cart/items", "post")).toBe(true);
    expect(shouldAttachSessionKey("/api/cart/items/55", "patch")).toBe(true);
    expect(shouldAttachSessionKey("/api/cart/items/55", "delete")).toBe(true);
  });

  // 2026-08-11 purchase_complete 서버 이관으로 추가된 대상.
  it("주문 생성(O-1)과 재결제(O-2)에 붙는다", () => {
    expect(shouldAttachSessionKey("/api/orders", "post")).toBe(true);
    expect(shouldAttachSessionKey("/api/orders/1001/retry-payment", "post")).toBe(
      true,
    );
  });

  // 적재 대상은 상태를 바꾸는 요청뿐이다.
  it("조회에는 붙이지 않는다", () => {
    expect(shouldAttachSessionKey("/api/cart", "get")).toBe(false);
    expect(shouldAttachSessionKey("/api/orders", "get")).toBe(false);
    expect(shouldAttachSessionKey("/api/orders/1001", "get")).toBe(false);
  });

  it("적재 지점이 아닌 변경 요청에는 붙이지 않는다", () => {
    expect(shouldAttachSessionKey("/api/wishlist", "post")).toBe(false);
    expect(shouldAttachSessionKey("/api/auth/login", "post")).toBe(false);
    expect(shouldAttachSessionKey("/api/addresses", "post")).toBe(false);
  });

  // GET 이 아닌 메서드는 대소문자로 들어와도 같게 판정돼야 한다(axios 는 소문자로 정규화하지만
  // 호출부가 대문자를 넘길 수 있다).
  it("메서드 대소문자를 가리지 않는다", () => {
    expect(shouldAttachSessionKey("/api/orders", "POST")).toBe(true);
    expect(shouldAttachSessionKey("/api/orders", "GET")).toBe(false);
  });
});
