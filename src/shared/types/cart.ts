// 장바구니 데이터 계약 — 백엔드 GET /api/cart 명세와 1:1.
// 헤더 뱃지·장바구니 페이지·상품 상세(담기)에서 함께 쓰므로 shared에 둔다.

// 장바구니 항목. 결제 이동을 위해 카드 수준 데이터를 포함.
export interface CartItem {
  cartItemId: number; // 장바구니 라인 식별(같은 상품 다른 옵션 구분)
  productId: number;
  name: string;
  brandId: number;
  brandName: string;
  imageUrl: string;
  optionId: number | null; // 옵션 없는 상품은 null
  optionName: string | null; // "화이트/M" — 슬래시로 구분. 옵션 없는 상품은 null
  quantity: number;
  price: number; // 현재가(담은 시점 가격 아님)
  originalPrice: number; // 정가 — 할인 표시·합산용
  purchasable: boolean; // HIDDEN 상품은 false — 목록 유지하되 합계·주문에서 제외
}

// 장바구니 전체 — 합계는 서버 계산값을 그대로 쓴다(FE 계산 금지).
export interface Cart {
  items: CartItem[];
  totalOriginal: number;
  totalSale: number;
  discount: number;
}
