import { api } from "./client";

/**
 * 상품 등록용 이미지 업로드 (판매자).
 *
 * presigned URL 방식이다 — 서버는 5분짜리 업로드 URL만 발급하고, 파일은 브라우저가
 * S3 에 직접 PUT 한다. 서버가 파일을 들고 있지 않아 메모리·대역폭 부담이 없고
 * nginx body 크기 제한도 타지 않는다.
 *
 * **URL 두 개를 구분하는 것이 이 모듈의 핵심이다.**
 *  - uploadUrl : S3 PUT 전용. 서명·만료 파라미터가 붙어 1,000자를 넘고 5분 뒤 죽는다.
 *                쓰고 버린다. 저장하거나 AI 에 넘기면 안 된다.
 *  - imageUrl  : 쿼리스트링 없는 canonical URL. 이것만 상품에 저장된다
 *                (image_url 컬럼이 VARCHAR(500) 이라 애초에 들어가지도 않는다).
 * 서버가 두 값을 이름 붙여 내려주므로 FE 가 파싱해 만들지 않는다 — S3 앞에 CDN 이
 * 붙거나 서명 방식이 바뀌면 파싱 규칙이 조용히 깨진다.
 */

/** 발급 응답 — BE 계약 확정 전 잠정. 확정되면 이 타입만 맞추면 된다. */
export interface UploadUrlIssue {
  uploadUrl: string;
  imageUrl: string;
}

/** 화면에서 거르는 1차 방어선. 서버도 발급 시점에 같은 검사를 한다(우회 가능하므로) */
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** 사용자에게 보일 실패 사유 — 원인마다 다음 행동이 다르다 */
export class ProductImageUploadError extends Error {
  constructor(
    message: string,
    /** 재시도로 풀릴 수 있는 실패인지(네트워크·서버 오류). 형식 오류는 재시도해도 같다 */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProductImageUploadError";
  }
}

/**
 * 파일 하나를 올리고 저장용 URL을 돌려준다.
 *
 * @throws ProductImageUploadError 형식 위반·발급 실패·PUT 실패
 */
export async function uploadProductImage(file: File): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    throw new ProductImageUploadError(
      "JPG·PNG·WEBP 형식만 올릴 수 있어요.",
      false,
    );
  }

  // ① 업로드 URL 발급 — 신원·brandId 는 서버가 JWT 로 도출한다(클라이언트가 주장하지 않는다)
  let issued: UploadUrlIssue;
  try {
    const { data } = await api.post<UploadUrlIssue>(
      "/api/seller/product-images/upload-url",
      { filename: file.name, contentType: file.type },
    );
    issued = data;
  } catch {
    throw new ProductImageUploadError(
      "이미지를 올리지 못했어요. 잠시 후 다시 시도해 주세요.",
      true,
    );
  }

  // ② S3 에 직접 PUT — api 인스턴스를 쓰지 않는다.
  //    baseURL·인증 쿠키·에러 인터셉터가 전부 우리 서버용이라, S3 로 나가는 요청에
  //    붙으면 서명이 어긋나거나 불필요한 자격증명이 실린다.
  const res = await fetch(issued.uploadUrl, {
    method: "PUT",
    body: file,
    // 발급 시 서명에 박힌 값과 정확히 같아야 한다 — 다르면 S3 가 403 으로 거부한다
    headers: { "Content-Type": file.type },
  }).catch(() => null);

  if (!res?.ok) {
    throw new ProductImageUploadError(
      "이미지를 올리지 못했어요. 잠시 후 다시 시도해 주세요.",
      true,
    );
  }

  // 저장·전송에는 짧은 쪽만 쓴다
  return issued.imageUrl;
}
