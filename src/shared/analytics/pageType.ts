import type { PageType } from "./types";

/**
 * 라우트 → pageType(E-1 어휘 14종) 판정.
 *
 * 라우트 경로를 그대로 싣지 않는 이유: 쿼리스트링에 검색어 등이 섞일 수 있고,
 * 경로가 바뀌면 집계가 끊긴다. 화면을 가리키는 이름은 이 어휘 하나로 통일한다.
 *
 * 판정 순서가 중요하다 — /seller/chat 이 /seller 보다 먼저 걸려야 하므로
 * 긴 경로부터 확인한다.
 */
export function toPageType(pathname: string): PageType | null {
  // 판매자 4종 — /seller 접두사가 겹치므로 구체적인 것부터
  if (pathname.startsWith("/seller/chat")) return "seller_chat";
  if (pathname.startsWith("/seller/orders")) return "seller_orders";
  if (pathname.startsWith("/seller/products")) return "seller_products";
  if (pathname.startsWith("/seller")) return "seller_dashboard";

  // 구매자
  // 쇼핑몰 홈은 /home 이다(2026-08-12 루트를 랜딩에 내주면서 이동).
  // ⚠️ 여기를 "/" 로 두면 랜딩이 home 으로 잡히고 정작 쇼핑몰 홈은 null 이 되어,
  // 에러 없이 집계만 뒤바뀐다. 루트(랜딩)는 아래 null 로 떨어진다 —
  // PageType 은 E-1 계약 어휘 14종이라 landing 항목이 없고, FE 가 임의로
  // 만들면 서버 화이트리스트 밖 값이 되어 그 건만 드롭된다.
  if (pathname === "/home" || pathname.startsWith("/home/")) return "home";
  if (pathname.startsWith("/products/")) return "product_detail";
  // 브랜드 홈은 카테고리 필터가 달린 목록 화면이라 category 로 본다(전용 어휘가 없다)
  if (pathname.startsWith("/brands/")) return "category";
  if (pathname.startsWith("/cart")) return "cart";
  // /checkout/complete 가 /checkout 보다 먼저
  if (pathname.startsWith("/checkout/complete")) return "order_complete";
  if (pathname.startsWith("/checkout")) return "checkout";
  if (pathname.startsWith("/chat")) return "chat";
  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) {
    return "auth";
  }
  // 찜은 마이페이지 밖 라우트지만 성격이 같다
  if (pathname.startsWith("/mypage") || pathname.startsWith("/wishlist")) {
    return "my";
  }

  // 어휘에 없는 화면(판매자 콘솔 등)은 발화하지 않는다 —
  // 미분류 값을 만들면 집계에서 정체 불명 행이 쌓인다.
  return null;
}
