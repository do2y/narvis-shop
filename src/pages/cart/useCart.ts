import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchCart,
  fetchCartRecommendations,
  removeCartItem,
  updateCartQuantity,
} from "./api";
import type { Cart } from "./types";

// 장바구니 — 서버 원본. 수량·구성이 자주 바뀌어 staleTime 0 (CLAUDE.md 규칙).
export function useCart() {
  return useQuery({
    queryKey: ["cart"],
    queryFn: fetchCart,
    staleTime: 0,
  });
}

export function useCartRecommendations() {
  return useQuery({
    queryKey: ["cart", "recommendations"],
    queryFn: fetchCartRecommendations,
    staleTime: 5 * 60 * 1000,
  });
}

// 수량·삭제 뮤테이션 — 낙관적 반영 후 실패 시 롤백. 성공/실패 후 ['cart'] 재동기화.
// (헤더 뱃지 전역 동기화도 같은 키로 이뤄짐)
export function useCartMutations() {
  const queryClient = useQueryClient();

  // 낙관적 반영은 items만 건드린다. 합계는 서버 계산값이라 FE가 다시 셈하지 않고,
  // onSettled의 invalidate로 갱신된 합계를 받는다(그 사이 짧게 이전 합계가 보임).
  const setQuantity = useMutation({
    mutationFn: (args: { cartItemId: number; quantity: number }) =>
      updateCartQuantity(args.cartItemId, args.quantity),
    retry: false,
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey: ["cart"] });
      const previous = queryClient.getQueryData<Cart>(["cart"]);
      if (previous) {
        queryClient.setQueryData<Cart>(["cart"], {
          ...previous,
          items: previous.items.map((it) =>
            it.cartItemId === args.cartItemId
              ? { ...it, quantity: args.quantity }
              : it,
          ),
        });
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["cart"], ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const remove = useMutation({
    mutationFn: (cartItemId: number) => removeCartItem(cartItemId),
    retry: false,
    onMutate: async (cartItemId) => {
      await queryClient.cancelQueries({ queryKey: ["cart"] });
      const previous = queryClient.getQueryData<Cart>(["cart"]);
      if (previous) {
        queryClient.setQueryData<Cart>(["cart"], {
          ...previous,
          items: previous.items.filter((it) => it.cartItemId !== cartItemId),
        });
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["cart"], ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  return { setQuantity, remove };
}
