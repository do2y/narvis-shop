import { api } from "@/shared/api/client";
import type {
  Claim,
  CreateClaimRequest,
  CreateReviewRequest,
  Inquiry,
  Order,
  OrderDetail,
  RecentProduct,
  WishlistProduct,
} from "./types";

export async function fetchOrders(): Promise<Order[]> {
  const { data } = await api.get<{ orders: Order[] }>("/api/mypage/orders");
  return data.orders;
}

export async function fetchOrder(orderId: string): Promise<OrderDetail> {
  const { data } = await api.get<OrderDetail>(
    `/api/mypage/orders/${orderId}`,
  );
  return data;
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

// 반품 신청 접수 — 성공 시 훅에서 claims 캐시 무효화.
export async function createClaim(body: CreateClaimRequest): Promise<void> {
  await api.post("/api/mypage/claims", body);
}

export async function createReview(body: CreateReviewRequest): Promise<void> {
  await api.post("/api/reviews", body);
}

// 문의 내역 — 읽기 전용(문의 챗봇에서 접수). 답변은 관리자가 등록.
export async function fetchInquiries(): Promise<Inquiry[]> {
  const { data } = await api.get<{ inquiries: Inquiry[] }>(
    "/api/mypage/inquiries",
  );
  return data.inquiries;
}

// 배송지 관리는 결제 화면과 같은 /api/addresses를 쓴다 — shared/api/address.ts 참조.
// (기존 /api/mypage/addresses는 백엔드에 없는 경로였음)
