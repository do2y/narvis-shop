import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServerFetchError } from "@/shared/api/server";
import { getProductDetail } from "@/features/product/serverApi";
import ProductPage from "@/features/product";
import { formatPrice } from "@/shared/utils/formatPrice";
import { sharedOpenGraph, sharedTwitter } from "../../shared-metadata";

type Props = { params: Promise<{ productId: string }> };

// Next 16에서 params는 Promise다(동기 접근 제거됨).
//
// Number()로 바꾸지 않는다 — 서버 productId가 64비트라 숫자로 만드는 순간
// 끝자리가 조용히 바뀐다. URL의 문자열을 그대로 들고 다닌다.
// 형식 검증만 한다: 빈 값·숫자가 아닌 문자는 존재할 수 없는 id이므로 404.
async function resolveId(params: Props["params"]): Promise<string> {
  const { productId } = await params;
  if (!/^\d+$/.test(productId)) notFound();
  return productId;
}

/**
 * 검색 결과·공유 카드에 노출될 메타데이터.
 * getProductDetail은 cache()로 감싸여 있어 page와 중복 호출해도 API는 1회만 나간다.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = await resolveId(params);

  let product;
  try {
    product = await getProductDetail(id);
  } catch {
    // 메타데이터 생성 실패로 페이지를 막지 않는다 — 본문 렌더가 404를 판단한다.
    return { title: "상품" };
  }

  const title = `${product.name} | ${product.brand.name}`;
  // summary가 비어 있는 상품이 있어 가격·브랜드로 대체 문구를 만든다.
  const description =
    product.summary?.trim() ||
    `${product.brand.name} ${product.name} — ${formatPrice(product.price)}`;

  return {
    title,
    description,
    openGraph: {
      ...sharedOpenGraph,
      title,
      description,
      url: `/products/${id}`,
      images: product.imageUrl
        ? [{ url: product.imageUrl, alt: product.name }]
        : sharedOpenGraph.images,
    },
    twitter: {
      ...sharedTwitter,
      title,
      description,
      images: product.imageUrl ? [product.imageUrl] : sharedTwitter.images,
    },
    alternates: { canonical: `/products/${id}` },
  };
}

export default async function Page({ params }: Props) {
  const id = await resolveId(params);

  // try/catch는 데이터 조회만 감싼다 — JSX를 그 안에서 만들면 렌더 단계의 에러는
  // 어차피 잡히지 않으면서(React는 즉시 렌더하지 않음) 오해를 부른다.
  let detail;
  try {
    // 서버에서 상세를 받아 첫 HTML에 본문을 실어 보낸다(SEO·LCP).
    detail = await getProductDetail(id);
  } catch (error) {
    // 없는 상품(404 PRODUCT_NOT_FOUND)은 Next의 not-found로 넘긴다.
    if (error instanceof ServerFetchError && error.status === 404) notFound();
    // 그 외 장애(백엔드 다운 등)는 초기 데이터 없이 렌더해 클라이언트가 재조회하게 둔다.
    // 원본의 "상세 도착 전" 경로(스켈레톤 → 조회)와 같은 동작이 된다.
  }

  // 상호작용(옵션·장바구니·찜)은 넘겨받은 클라이언트 컴포넌트가 그대로 담당한다.
  return <ProductPage id={id} initialDetail={detail} />;
}
