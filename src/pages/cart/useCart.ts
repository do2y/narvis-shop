import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import {
  addCartItem,
  fetchCartRecommendations,
  removeCartItem,
  updateCartQuantity,
} from "./api";
import type { Cart } from "./types";

export { useCart, useCartItemCount } from "@/shared/hooks/useCart";

export function useCartRecommendations() {
  return useQuery({
    queryKey: ["cart", "recommendations"],
    queryFn: fetchCartRecommendations,
    staleTime: 5 * 60 * 1000,
  });
}

function toAddCartMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.message) return error.message;
    if (error.code === "CART_OPTION_REQUIRED") return "옵션을 선택해주세요.";
    if (error.code === "CART_OPTION_INVALID")
      return "선택한 옵션을 찾을 수 없어요.";
    if (error.code === "PRODUCT_NOT_FOUND") return "상품을 찾을 수 없어요.";
  }
  return "장바구니에 담지 못했어요. 잠시 후 다시 시도해주세요.";
}

export function useAddCartItem() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: addCartItem,
    retry: false,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  return {
    ...mutation,
    errorMessage: mutation.error ? toAddCartMessage(mutation.error) : null,
  };
}

export function useCartMutations() {
  const queryClient = useQueryClient();

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
