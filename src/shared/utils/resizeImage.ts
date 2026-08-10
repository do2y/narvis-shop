/**
 * 업로드 전 브라우저 리사이즈 — canvas 로 축소하고 WebP(미지원 시 JPEG)로 통일한다.
 *
 * 세 가지를 한 번에 해결한다:
 *  1. HEIC — iPhone 기본 촬영 포맷인데 Chrome 이 렌더링하지 못한다. 그대로 올리면
 *     업로드는 성공하는데 화면에 안 보인다(더 나쁜 실패다). canvas 를 통과했다는 것
 *     자체가 "브라우저가 읽을 수 있는 이미지"라는 검증이다.
 *  2. 용량 — S-6 상한이 2MB 다. 원본은 4MB 를 넘기도 한다.
 *     같은 화질에서 WebP 가 JPEG 보다 25~35% 작아 상한에 걸릴 일이 더 줄었다.
 *  3. 규격 — 기존 상품 이미지가 전부 긴 변 1000px 이라 거기 맞춘다(실측 2026-08-09).
 *     1200px 로 올리면 새 상품만 커져 목록에서 통일감이 깨진다.
 */

/** 긴 변 목표치. 앞에서부터 시도하고 실패하면 다음으로 내려간다(iOS 폴백) */
const MAX_SIDES = [1000, 800, 500] as const;

/** 품질 — 육안 차이가 거의 없으면서 용량이 크게 준다. WebP·JPEG 모두 적용된다 */
const QUALITY = 0.85;

/**
 * 출력 포맷 후보. WebP 우선, 미지원 브라우저는 JPEG.
 *
 * **`toBlob` 은 지원하지 않는 타입을 받아도 예외를 던지지 않는다** — 명세상 조용히
 * PNG 로 폴백한다. 그러면 내용은 PNG 인데 `image/webp` 라고 선언한 파일이 올라가고,
 * S-6 의 확장자·contentType 검사도 통과해버린다. 그래서 요청한 타입이 아니라
 * **돌아온 `blob.type` 을 믿고** 다음 후보로 내려간다.
 */
const FORMATS = [
  { contentType: "image/webp", ext: "webp" },
  { contentType: "image/jpeg", ext: "jpg" },
] as const;

/**
 * 결과가 이보다 작으면 실패로 본다.
 * iOS Safari 는 canvas 메모리 한계를 넘어도 **에러를 던지지 않고 빈 이미지를 반환한다** —
 * 그대로 올리면 흰 사각형이 상품 사진으로 등록되고 아무도 알아채지 못한다.
 */
const MIN_VALID_BYTES = 1024;

/** 리사이즈 결과 — 파일명·타입이 내용과 일치하도록 함께 돌려준다 */
export interface ResizedImage {
  blob: Blob;
  /** image/webp 또는 image/jpeg — 실제로 인코딩된 타입이다(요청한 타입이 아니다) */
  contentType: string;
  /**
   * 확장자를 실제 출력 포맷에 맞춘 파일명(.webp 또는 .jpg).
   * S-6 는 확장자와 contentType 이 어긋나면 IMAGE_TYPE_UNSUPPORTED 로 막는다 —
   * photo.heic 를 그대로 보내면 heic + image/webp 조합이 되어 거부된다.
   */
  filename: string;
}

export class ImageResizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageResizeError";
  }
}

/**
 * 파일명의 확장자를 출력 포맷의 것으로 교체 (확장자가 없으면 붙인다).
 * export 는 테스트용 — S-6 가 확장자·contentType 불일치를 막으므로 회귀가 나면 안 된다.
 */
export function withExtension(name: string, ext: string): string {
  const base = name.replace(/\.[^./\\]+$/, "");
  // 확장자를 떼고 나면 빈 문자열일 수 있다(".heic" 같은 이름)
  return `${base || "image"}.${ext}`;
}

/**
 * 원본 비율을 지키면서 긴 변을 maxSide 로 맞춘 크기 (원본이 더 작으면 그대로).
 * export 는 테스트용.
 */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number,
): { w: number; h: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { w: width, h: height };
  const ratio = maxSide / longest;
  // 소수점이 남으면 canvas 가 반올림하며 1px 씩 어긋난다 — 미리 정수로 만든다
  return { w: Math.round(width * ratio), h: Math.round(height * ratio) };
}

/** createImageBitmap 우선, 미지원 브라우저는 <img> 로 폴백 */
async function loadImage(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // HEIC 등 디코딩 실패 — 아래 <img> 경로에서 한 번 더 시도한다
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () =>
        reject(new ImageResizeError("이미지를 읽지 못했어요."));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function drawToBlob(
  source: CanvasImageSource,
  w: number,
  h: number,
  contentType: string,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);

  // 투명 PNG 를 그대로 두면 배경이 비쳐 목록에서 튄다 — WebP 는 투명도를 지원하지만
  // 상품 사진은 흰 배경으로 통일한다(JPEG 시절과 같은 결과를 유지한다)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);

  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), contentType, QUALITY),
  );
}

/**
 * 업로드용으로 리사이즈한다.
 *
 * 폴백이 2단이다:
 *  - 포맷(바깥) — WebP 로 인코딩되지 않으면 JPEG 로 내려간다. 브라우저 지원 여부를
 *    미리 묻지 않고 **실제 결과의 타입으로 판정한다**(`toBlob` 이 조용히 PNG 를
 *    돌려주는 경우까지 한 번에 걸러진다)
 *  - 크기(안쪽) — iOS Safari 의 canvas 메모리 한계는 기기마다 달라서, 1000px 이
 *    실패해도 500px 은 통과하는 경우가 있다. 화질이 조금 떨어져도 아예 못 올리는
 *    것보다 낫다(상품 카드는 300px 남짓으로 표시된다)
 *
 * 크기가 안쪽인 이유: WebP 를 지원하는 브라우저가 메모리 한계 때문에 JPEG 로
 * 떨어지면 용량 이득을 통째로 잃는다. 포맷을 먼저 지키고 크기를 양보한다.
 *
 * @throws ImageResizeError 모든 단계가 실패한 경우
 */
export async function resizeImageForUpload(file: File): Promise<ResizedImage> {
  const { source, width, height, release } = await loadImage(file);

  try {
    if (!width || !height) {
      throw new ImageResizeError("이미지를 읽지 못했어요.");
    }

    for (const format of FORMATS) {
      for (const maxSide of MAX_SIDES) {
        const { w, h } = fitWithin(width, height, maxSide);
        const blob = await drawToBlob(source, w, h, format.contentType);

        // 빈 이미지는 예외 없이 조용히 나온다 — 크기로 판정할 수밖에 없다
        if (!blob || blob.size < MIN_VALID_BYTES) continue;

        // 요청한 타입으로 인코딩됐는지 확인한다. 아니면 이 포맷은 미지원이므로
        // 크기를 더 줄여봐야 소용없다 — 곧장 다음 포맷으로 넘어간다
        if (blob.type !== format.contentType) break;

        return {
          blob,
          contentType: format.contentType,
          filename: withExtension(file.name, format.ext),
        };
      }
    }

    throw new ImageResizeError(
      "이미지를 처리하지 못했어요. 다른 사진을 선택하거나 사진 앱에서 크기를 줄여 다시 시도해 주세요.",
    );
  } finally {
    release();
  }
}
