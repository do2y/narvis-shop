import { useQuery } from "@tanstack/react-query";
import { fetchCart } from "@/shared/api/cart";

// 장바구니 — 서버 원본. 수량·구성이 자주 바뀌어 staleTime 0 (CLAUDE.md 규칙).
// 헤더 뱃지와 장바구니 페이지가 같은 ['cart'] 키를 공유하므로,
// 담기·수량변경·삭제 후 invalidateQueries(['cart'])로 함께 갱신된다.
export function useCart() {
  return useQuery({
    queryKey: ["cart"],
    queryFn: fetchCart,
    staleTime: 0,
  });
}

// 헤더 뱃지용 총 수량. 구매 불가(purchasable=false) 항목도 장바구니에 담겨 있으므로
// 개수에는 포함한다(합계 금액에서만 서버가 제외).
export function useCartItemCount(): number {
  const { data } = useCart();
  return data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
}
