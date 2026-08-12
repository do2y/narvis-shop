import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServerFetchError } from "@/shared/api/server";
import { getBrandHome } from "@/features/brand/serverApi";
import BrandPage from "@/features/brand";
import type { BrandQuery, BrandSort } from "@/features/brand/types";
import { sharedOpenGraph, sharedTwitter } from "../../shared-metadata";

type Props = {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SORTS: BrandSort[] = ["popular", "latest", "price_asc", "price_desc"];

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** URL 쿼리 → API 쿼리. 잘못된 값은 무시하고 기본값으로 되돌린다. */
function toQuery(sp: Record<string, string | string[] | undefined>): BrandQuery {
  const categoryRaw = one(sp.category);
  const sortRaw = one(sp.sort);
  const pageRaw = one(sp.page);

  // category 는 문자열 그대로 다룬다 — brandId 와 같은 64비트 id라 Number() 를
  // 거치면 끝자리가 조용히 바뀌고, Number.isFinite 는 뭉개진 값도 통과시킨다
  // (아래 resolveId 주석과 같은 사유). 형식 검증만 정규식으로 한다.
  const category =
    categoryRaw && /^\d+$/.test(categoryRaw) ? categoryRaw : undefined;
  const page = pageRaw ? Number(pageRaw) : undefined;

  return {
    ...(category !== undefined ? { category } : {}),
    ...(sortRaw && SORTS.includes(sortRaw as BrandSort)
      ? { sort: sortRaw as BrandSort }
      : {}),
    ...(page !== undefined && Number.isFinite(page) && page > 0 ? { page } : {}),
  };
}

// 문자열이다. brandId도 productId와 같은 64비트라 Number()로 바꾸는 순간
// 끝자리가 조용히 바뀐다(503922368982002241 → 503922368982002000).
// Number.isFinite 검사는 뭉개진 값도 통과시키므로, 존재하는 브랜드인데 404가 났다.
// number로 되돌리지 말 것 — 경고 없이 값만 틀어진다.
async function resolveId(params: Props["params"]): Promise<string> {
  const { brandId } = await params;
  if (!/^\d+$/.test(brandId)) notFound();
  return brandId;
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const id = await resolveId(params);
  const query = toQuery(await searchParams);

  let home;
  try {
    home = await getBrandHome(id, query);
  } catch {
    return { title: "브랜드" };
  }

  const { brand, products } = home;
  const title = `${brand.name} | Narvis`;
  const description =
    brand.description?.trim() ||
    `${brand.name}의 상품 ${products.totalElements.toLocaleString("ko-KR")}개를 만나보세요.`;

  return {
    title,
    description,
    openGraph: {
      ...sharedOpenGraph,
      title,
      description,
      url: `/brands/${id}`,
      images: brand.logoUrl
        ? [{ url: brand.logoUrl, alt: `${brand.name} 로고` }]
        : sharedOpenGraph.images,
    },
    twitter: {
      ...sharedTwitter,
      title,
      description,
      images: brand.logoUrl ? [brand.logoUrl] : sharedTwitter.images,
    },
    // 필터·정렬·페이지 조합이 전부 별도 URL이 되므로, 색인은 기본 화면 하나로 모은다.
    // (같은 상품 목록이 정렬만 다른 URL로 중복 색인되는 것을 막는다)
    alternates: { canonical: `/brands/${id}` },
  };
}

export default async function Page({ params, searchParams }: Props) {
  const id = await resolveId(params);
  const query = toQuery(await searchParams);

  let initialData;
  try {
    initialData = await getBrandHome(id, query);
  } catch (error) {
    if (error instanceof ServerFetchError) {
      // 없는 브랜드(BRAND_NOT_FOUND)는 404로. 그 외 장애는 초기 데이터 없이 렌더해
      // 클라이언트가 재조회하도록 둔다(원본 스켈레톤 → 조회 경로와 동일).
      if (error.status === 404 || error.code === "BRAND_NOT_FOUND") notFound();
    }
  }

  return (
    // BrandPage가 useSearchParams를 쓰므로 Suspense 경계가 필요하다.
    // 없으면 빌드가 실패하거나 페이지 전체가 CSR로 강등된다.
    <Suspense fallback={null}>
      {/* serverQuery: initialData가 어떤 조합의 결과인지 알려준다.
          이게 없으면 정렬을 바꿔도 옛 데이터가 초기값으로 들어가 화면이 안 바뀐다. */}
      <BrandPage id={id} initialData={initialData} serverQuery={query} />
    </Suspense>
  );
}
