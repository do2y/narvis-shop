import { api } from "./client";
import { ImageResizeError, resizeImageForUpload } from "@/shared/utils/resizeImage";

/**
 * 상품 등록용 이미지 업로드 (판매자) — S-6 `POST /api/seller/product-images/upload-url`.
 *
 * presigned URL 방식이다. 서버는 5분짜리 업로드 URL만 발급하고 **파일을 받지 않는다** —
 * 브라우저가 S3 에 직접 PUT 한다. 서버 메모리·대역폭 부담이 없고 nginx body 제한도 안 탄다.
 *
 * **URL 두 개를 구분하는 것이 핵심이다.**
 *  - uploadUrl : S3 PUT 전용. 서명·만료가 붙어 1,000자를 넘고 5분 뒤 죽는다. 쓰고 버린다
 *  - imageUrl  : 쿼리스트링 없는 canonical URL. 이것만 상품에 저장된다
 *                (image_url 이 VARCHAR(500) 이라 presigned 쪽은 애초에 들어가지도 않는다)
 * 서버가 두 값을 이름 붙여 내려주므로 FE 가 파싱해 만들지 않는다 — CDN 이 앞에 붙거나
 * 서명 방식이 바뀌면 파싱 규칙이 조용히 깨진다.
 */

/** S-6 응답 (envelope 는 인터셉터가 벗긴다) */
interface UploadUrlIssue {
  uploadUrl: string;
  imageUrl: string;
}

/**
 * 업로드 실패 사유.
 *
 * 코드를 나눠 받는 이유는 **판매자가 할 다음 행동이 다르기 때문**이다 —
 * 형식 오류는 같은 사진으로 재시도해도 소용이 없고, 크기 초과는 더 작은 사진이 필요하다.
 * S-6 가 IMAGE_TYPE_UNSUPPORTED·IMAGE_TOO_LARGE 를 따로 신설한 것도 같은 이유다.
 */
export class ProductImageUploadError extends Error {
  constructor(
    message: string,
    /** 같은 파일로 다시 시도할 만한 실패인지(네트워크·서버 오류·rate limit) */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProductImageUploadError";
  }
}

/** S-6 error.code → 화면 문구·재시도 여부 */
function toUploadError(code: string | undefined): ProductImageUploadError {
  switch (code) {
    case "IMAGE_TYPE_UNSUPPORTED":
      return new ProductImageUploadError(
        "JPG·PNG·WEBP 형식만 올릴 수 있어요.",
        false,
      );
    case "IMAGE_TOO_LARGE":
      return new ProductImageUploadError(
        "이미지 용량이 너무 커요. 더 작은 사진으로 시도해 주세요.",
        false,
      );
    case "RATE_LIMITED":
      return new ProductImageUploadError(
        "요청이 많아요. 잠시 후 다시 시도해 주세요.",
        true,
      );
    case "AUTH_FORBIDDEN":
    case "SELLER_BRAND_NOT_FOUND":
      return new ProductImageUploadError(
        "판매자 권한이 없어 이미지를 올릴 수 없어요.",
        false,
      );
    default:
      // 401 은 인터셉터가 재발급 후 재시도하므로 여기까지 오면 이미 복구 실패다
      return new ProductImageUploadError(
        "이미지를 올리지 못했어요. 잠시 후 다시 시도해 주세요.",
        true,
      );
  }
}

/** axios 에러에서 서버 error.code 를 꺼낸다 */
function errorCodeOf(e: unknown): string | undefined {
  if (typeof e !== "object" || e === null) return undefined;
  const res = (e as { response?: { data?: unknown } }).response?.data;
  if (typeof res !== "object" || res === null) return undefined;
  const err = (res as { error?: unknown }).error;
  if (typeof err !== "object" || err === null) return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/**
 * 파일 하나를 올리고 **저장용 URL** 을 돌려준다.
 *
 * 리사이즈 → 발급 → PUT 3단계다. 리사이즈에 실패하면 원본을 대신 보내지 않는다 —
 * 원본은 2MB 상한에 걸리기 쉽고, HEIC 면 올라가도 화면에 안 보인다(성공한 것처럼
 * 보이면서 상품 사진이 깨지는 쪽이 더 나쁘다).
 *
 * @throws ProductImageUploadError
 */
export async function uploadProductImage(file: File): Promise<string> {
  // ① 리사이즈 — 여기서 HEIC 가 WebP(미지원 브라우저는 JPEG)로 바뀌고
  //    파일명 확장자도 실제 출력 포맷에 맞춰진다
  let resized;
  try {
    resized = await resizeImageForUpload(file);
  } catch (e) {
    throw new ProductImageUploadError(
      e instanceof ImageResizeError
        ? e.message
        : "이미지를 처리하지 못했어요. 다른 사진을 선택해 주세요.",
      false,
    );
  }

  // ② 업로드 URL 발급 — 신원은 서버가 JWT 로 도출한다(클라이언트가 주장하지 않는다).
  //    size 를 함께 보내는 이유: presigned PUT 은 "이하"를 걸 수 없고 서명에 들어간
  //    Content-Length 가 일치 조건이라, 서버가 상한을 검사한 뒤 그 값을 서명에 박는다.
  let issued: UploadUrlIssue;
  try {
    const { data } = await api.post<UploadUrlIssue>(
      "/api/seller/product-images/upload-url",
      {
        filename: resized.filename,
        contentType: resized.contentType,
        size: resized.blob.size,
      },
    );
    issued = data;
  } catch (e) {
    throw toUploadError(errorCodeOf(e));
  }

  // ③ S3 에 직접 PUT — api 인스턴스를 쓰지 않는다.
  //    baseURL·인증 쿠키·에러 인터셉터가 전부 우리 서버용이라 S3 로 나가는 요청에
  //    붙으면 서명이 어긋나거나 불필요한 자격증명이 실린다.
  const res = await fetch(issued.uploadUrl, {
    method: "PUT",
    body: resized.blob,
    // 발급 시 서명에 박힌 값과 정확히 같아야 한다 — 다르면 S3 가 403 으로 거부한다
    headers: { "Content-Type": resized.contentType },
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
