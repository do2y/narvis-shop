import { cachedGet, serverGet } from "@/shared/api/server";
import type { ProductDetail } from "./types";

/**
 * 상품 상세 — 서버 컴포넌트용.
 *
 * 클라이언트용 `api.ts`와 파일을 나눈 이유: 그쪽은 axios 인스턴스(인터셉터·authStore
 * 의존)를 쓰므로 서버에서 import되면 안 된다. 같은 파일에 두면 실수로 섞이기 쉽다.
 *
 * `cachedGet`으로 감싸 generateMetadata와 page가 같은 상품을 각각 불러도
 * 요청당 API 호출이 1회가 되게 한다.
 *
 * 캐시하지 않는다(revalidate 미지정 = no-store): 재고·가격·purchaseState가 실시간이어야
 * 하고, 상세 화면이 "품절인데 구매 가능"으로 보이면 안 된다.
 * ISR 전환은 갱신 빈도를 확인한 뒤 결정한다(계획서 6장 열린 질문).
 */
export const getProductDetail = cachedGet((id: string) =>
  serverGet<ProductDetail>(`/api/products/${id}`),
);
