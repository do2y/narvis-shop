import { api } from "@/shared/api/client";
import type {
  Address,
  AddressInput,
  Claim,
  CreateReviewRequest,
  Order,
  RecentProduct,
  WishlistProduct,
} from "./types";

export async function fetchOrders(): Promise<Order[]> {
  const { data } = await api.get<{ orders: Order[] }>("/api/mypage/orders");
  return data.orders;
}

export async function fetchRecentProducts(): Promise<RecentProduct[]> {
  const { data } = await api.get<{ products: RecentProduct[] }>(
    "/api/mypage/recent-products",
  );
  return data.products;
}

export async function fetchWishlist(): Promise<WishlistProduct[]> {
  const { data } = await api.get<{ products: WishlistProduct[] }>(
    "/api/wishlist",
  );
  return data.products;
}

export async function removeWishlistItem(productId: number): Promise<void> {
  await api.delete(`/api/wishlist/${productId}`);
}

export async function fetchClaims(): Promise<Claim[]> {
  const { data } = await api.get<{ claims: Claim[] }>("/api/mypage/claims");
  return data.claims;
}

export async function createReview(body: CreateReviewRequest): Promise<void> {
  await api.post("/api/reviews", body);
}

// ── 배송지 관리 ──
export async function fetchAddresses(): Promise<Address[]> {
  const { data } = await api.get<{ addresses: Address[] }>(
    "/api/mypage/addresses",
  );
  return data.addresses;
}

export async function addAddress(input: AddressInput): Promise<void> {
  await api.post("/api/mypage/addresses", input);
}

export async function updateAddress(
  addressId: string,
  input: AddressInput,
): Promise<void> {
  await api.put(`/api/mypage/addresses/${addressId}`, input);
}

export async function removeAddress(addressId: string): Promise<void> {
  await api.delete(`/api/mypage/addresses/${addressId}`);
}

export async function setDefaultAddress(addressId: string): Promise<void> {
  await api.patch(`/api/mypage/addresses/${addressId}/default`);
}
