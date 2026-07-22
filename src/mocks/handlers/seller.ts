import { http, HttpResponse } from "msw";
import { BASE, ok } from "../shared";
import type {
  SellerOrderStatus,
  SellerSummary,
} from "@/pages/seller/types";

// ── 판매자 페이지 목 (pages/seller/types.ts 계약) ──

const PAGE_SIZE = 7;

const SELLER_IMG_A =
  "https://image.msscdn.net/thumbnails/images/goods_img/20260415/6317871/6317871_17811631352969_big.jpg?w=1200";
const SELLER_IMG_B =
  "https://image.msscdn.net/thumbnails/images/goods_img/20251015/5593843/5593843_17652503983820_big.png?w=1200";

const MOCK_SELLER_ORDERS: {
  orderId: string;
  productName: string;
  productImageUrl: string;
  extraItemCount: number;
  ordererName: string;
  amount: number;
  payMethod: string;
  orderedAt: string;
  status: SellerOrderStatus;
}[] = [
  {
    orderId: "20260716-0342",
    productName: "벨티드 린넨 원피스",
    productImageUrl: SELLER_IMG_A,
    extraItemCount: 1,
    ordererName: "김서연",
    amount: 89000,
    payMethod: "카드",
    orderedAt: "07-16 09:42",
    status: "ORDERED",
  },
  {
    orderId: "20260716-0339",
    productName: "오버핏 코튼 블라우스",
    productImageUrl: SELLER_IMG_B,
    extraItemCount: 0,
    ordererName: "박지현",
    amount: 45000,
    payMethod: "네이버페이",
    orderedAt: "07-16 09:15",
    status: "ORDERED",
  },
  {
    orderId: "20260716-0331",
    productName: "화이트 코튼 셔츠",
    productImageUrl: SELLER_IMG_A,
    extraItemCount: 2,
    ordererName: "이민정",
    amount: 142000,
    payMethod: "카드",
    orderedAt: "07-16 08:57",
    status: "ORDERED",
  },
  {
    orderId: "20260715-0294",
    productName: "크롭 트위드 자켓",
    productImageUrl: SELLER_IMG_A,
    extraItemCount: 0,
    ordererName: "정하윤",
    amount: 128000,
    payMethod: "카드",
    orderedAt: "07-15 18:03",
    status: "SHIPPING",
  },
  {
    orderId: "20260713-0233",
    productName: "베이직 니트 가디건",
    productImageUrl: SELLER_IMG_B,
    extraItemCount: 1,
    ordererName: "임수아",
    amount: 54000,
    payMethod: "카드",
    orderedAt: "07-13 16:31",
    status: "SHIPPING",
  },
  {
    orderId: "20260714-0261",
    productName: "와이드 데님 팬츠",
    productImageUrl: SELLER_IMG_B,
    extraItemCount: 0,
    ordererName: "한지우",
    amount: 62000,
    payMethod: "토스페이",
    orderedAt: "07-14 15:22",
    status: "DELIVERED",
  },
  {
    orderId: "20260713-0219",
    productName: "린넨 셋업 자켓",
    productImageUrl: SELLER_IMG_A,
    extraItemCount: 0,
    ordererName: "오예린",
    amount: 134000,
    payMethod: "네이버페이",
    orderedAt: "07-13 10:12",
    status: "DELIVERED",
  },
  {
    orderId: "20260712-0198",
    productName: "플리츠 미디 스커트",
    productImageUrl: SELLER_IMG_B,
    extraItemCount: 0,
    ordererName: "최유진",
    amount: 58000,
    payMethod: "카카오페이",
    orderedAt: "07-12 22:40",
    status: "CONFIRMED",
  },
  {
    orderId: "20260714-0248",
    productName: "슬림 핏 원피스",
    productImageUrl: SELLER_IMG_A,
    extraItemCount: 0,
    ordererName: "송민서",
    amount: 76000,
    payMethod: "카드",
    orderedAt: "07-14 11:08",
    status: "CANCELLED",
  },
  {
    orderId: "20260711-0187",
    productName: "오버핏 코튼 블라우스",
    productImageUrl: SELLER_IMG_B,
    extraItemCount: 0,
    ordererName: "강도현",
    amount: 45000,
    payMethod: "카드",
    orderedAt: "07-11 14:20",
    status: "RETURNED",
  },
];

const MOCK_SELLER_PRODUCTS: {
  productId: number;
  name: string;
  imageUrl: string;
  code: string;
  price: number;
  stock: number;
  salesCount: number;
  status: "ON_SALE" | "SOLD_OUT" | "HIDDEN";
  categoryName: string;
  createdAt: string;
}[] = [
  {
    productId: 301,
    name: "벨티드 린넨 원피스",
    imageUrl: SELLER_IMG_A,
    code: "GLT-OP-0412",
    price: 89000,
    stock: 4,
    salesCount: 1204,
    status: "ON_SALE",
    categoryName: "원피스",
    createdAt: "2026-07-01",
  },
  {
    productId: 302,
    name: "오버핏 코튼 블라우스",
    imageUrl: SELLER_IMG_B,
    code: "GLT-BL-0398",
    price: 45000,
    stock: 7,
    salesCount: 986,
    status: "ON_SALE",
    categoryName: "블라우스",
    createdAt: "2026-06-24",
  },
  {
    productId: 303,
    name: "플리츠 미디 스커트",
    imageUrl: SELLER_IMG_A,
    code: "GLT-SK-0385",
    price: 58000,
    stock: 126,
    salesCount: 742,
    status: "ON_SALE",
    categoryName: "스커트",
    createdAt: "2026-06-18",
  },
  {
    productId: 304,
    name: "크롭 트위드 자켓",
    imageUrl: SELLER_IMG_B,
    code: "GLT-JK-0371",
    price: 128000,
    stock: 0,
    salesCount: 1532,
    status: "SOLD_OUT",
    categoryName: "아우터",
    createdAt: "2026-06-10",
  },
  {
    productId: 305,
    name: "와이드 데님 팬츠",
    imageUrl: SELLER_IMG_A,
    code: "GLT-PT-0362",
    price: 62000,
    stock: 88,
    salesCount: 1108,
    status: "ON_SALE",
    categoryName: "팬츠",
    createdAt: "2026-06-02",
  },
  {
    productId: 306,
    name: "슬림 핏 원피스",
    imageUrl: SELLER_IMG_B,
    code: "GLT-OP-0355",
    price: 76000,
    stock: 54,
    salesCount: 890,
    status: "ON_SALE",
    categoryName: "원피스",
    createdAt: "2026-05-27",
  },
  {
    productId: 307,
    name: "베이직 니트 가디건",
    imageUrl: SELLER_IMG_A,
    code: "GLT-KN-0341",
    price: 54000,
    stock: 37,
    salesCount: 312,
    status: "HIDDEN",
    categoryName: "니트",
    createdAt: "2026-05-14",
  },
  {
    productId: 308,
    name: "린넨 셋업 자켓",
    imageUrl: SELLER_IMG_B,
    code: "GLT-JK-0330",
    price: 134000,
    stock: 3,
    salesCount: 205,
    status: "ON_SALE",
    categoryName: "아우터",
    createdAt: "2026-05-02",
  },
];

// ── 대시보드 (S-1 GET /api/seller/summary, 2026-07-21 개정) ──
// 진입 1회 호출로 전 블록을 덮는다. 상태 카운트는 주문 목록에서 도출해 정합을 맞춘다.
const LOW_STOCK_THRESHOLD = 10;

function orderStatusCounts(): Record<SellerOrderStatus, number> {
  const counts: Record<SellerOrderStatus, number> = {
    ORDERED: 0,
    SHIPPING: 0,
    DELIVERED: 0,
    CONFIRMED: 0,
    CANCELLED: 0,
    RETURNED: 0,
  };
  for (const o of MOCK_SELLER_ORDERS) counts[o.status] += 1;
  // 목 주문은 표본이 적어 화면 수치가 빈약하므로, 활성 상태만 데모용으로 부풀린다.
  counts.ORDERED += 28;
  counts.SHIPPING += 173;
  counts.DELIVERED += 95;
  counts.CONFIRMED += 12;
  return counts;
}

function buildSummary(): SellerSummary {
  const counts = orderStatusCounts();
  const activeTotal =
    counts.ORDERED + counts.SHIPPING + counts.DELIVERED + counts.CONFIRMED;

  // 재고 부족 = 남아있지만 곧 소진될 것. 재고 0은 '품절'이라 상품 목록이 다루므로 제외. 재고 오름차순.
  const lowStockItems = MOCK_SELLER_PRODUCTS.filter(
    (p) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD,
  )
    .sort((a, b) => a.stock - b.stock)
    .map((p) => ({
      productId: p.productId,
      name: p.name,
      imageUrl: p.imageUrl,
      stockQuantity: p.stock,
    }));

  const points = [
    { date: "2026-07-15", sales: 7120000 },
    { date: "2026-07-16", sales: 8340000 },
    { date: "2026-07-17", sales: 7980000 },
    { date: "2026-07-18", sales: 9450000 },
    { date: "2026-07-19", sales: 8870000 },
    { date: "2026-07-20", sales: 10240000 },
    { date: "2026-07-21", sales: 12480000 },
  ];

  return {
    period: { from: "2026-07-21", to: "2026-07-21" },
    orderStatus: {
      counts,
      activeTotal,
      avgDeliveryDays: 1.8,
    },
    today: {
      sales: 12480000,
      orderCount: 342,
      avgOrderValue: 36500,
      activeVisitors: 1284,
      salesChangeRate: 8.2,
      orderCountChangeRate: 5.1,
      avgOrderValueChangeRate: 2.9,
    },
    salesTrend: {
      total: points.reduce((sum, p) => sum + p.sales, 0),
      points,
    },
    lowStock: {
      threshold: LOW_STOCK_THRESHOLD,
      count: lowStockItems.length,
      items: lowStockItems,
    },
    products: MOCK_SELLER_PRODUCTS.map((p) => ({
      productId: p.productId,
      name: p.name,
      viewCount: p.salesCount * 25,
      cartCount: Math.round(p.salesCount * 1.5),
      salesCount: p.salesCount,
    })),
  };
}

export const sellerHandlers = [
  http.get(`${BASE}/api/seller/summary`, () =>
    HttpResponse.json(ok(buildSummary())),
  ),

  // 주문 목록 — 상태 탭 필터 + 페이지네이션 동작(검색·정렬은 UI만, 계약 확정 후 연결)
  http.get(`${BASE}/api/seller/orders`, ({ request }) => {
    const url = new URL(request.url);
    const status = (url.searchParams.get("status") ?? "ALL") as
      | SellerOrderStatus
      | "ALL";
    const page = Number(url.searchParams.get("page") ?? 1);

    const filtered =
      status === "ALL"
        ? MOCK_SELLER_ORDERS
        : MOCK_SELLER_ORDERS.filter((o) => o.status === status);

    const counts = { ALL: MOCK_SELLER_ORDERS.length } as Record<string, number>;
    const STATUSES: SellerOrderStatus[] = [
      "ORDERED",
      "SHIPPING",
      "DELIVERED",
      "CONFIRMED",
      "CANCELLED",
      "RETURNED",
    ];
    for (const s of STATUSES) {
      counts[s] = MOCK_SELLER_ORDERS.filter((o) => o.status === s).length;
    }

    return HttpResponse.json(
      ok({
        orders: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        page,
        totalPages: Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
        counts,
      }),
    );
  }),

  // 상품 목록 — 상태 탭 필터 + 페이지네이션 동작
  http.get(`${BASE}/api/seller/products`, ({ request }) => {
    const url = new URL(request.url);
    const tab = url.searchParams.get("tab") ?? "ALL";
    const page = Number(url.searchParams.get("page") ?? 1);

    const filtered =
      tab === "ALL"
        ? MOCK_SELLER_PRODUCTS
        : MOCK_SELLER_PRODUCTS.filter((p) => p.status === tab);

    return HttpResponse.json(
      ok({
        products: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        page,
        totalPages: Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
        counts: {
          ALL: MOCK_SELLER_PRODUCTS.length,
          ON_SALE: MOCK_SELLER_PRODUCTS.filter((p) => p.status === "ON_SALE")
            .length,
          SOLD_OUT: MOCK_SELLER_PRODUCTS.filter((p) => p.status === "SOLD_OUT")
            .length,
          HIDDEN: MOCK_SELLER_PRODUCTS.filter((p) => p.status === "HIDDEN")
            .length,
        },
      }),
    );
  }),
];
