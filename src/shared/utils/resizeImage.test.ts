import { describe, expect, it } from "vitest";
import { fitWithin, withExtension } from "./resizeImage";

/**
 * 업로드 전 리사이즈의 순수 계산부.
 *
 * 두 가지를 고정한다:
 *  1. 파일명 확장자 — S-6 는 확장자와 contentType 이 어긋나면 IMAGE_TYPE_UNSUPPORTED 로
 *     거부한다. 리사이즈 결과는 WebP(폴백 JPEG)이므로 이름도 거기 맞춰야 한다.
 *     photo.heic 를 그대로 보내면 heic + image/webp 조합이 되어 업로드가 통째로 막힌다.
 *  2. 크기 계산 — 기존 상품 이미지가 긴 변 1000px 이라 거기 맞춘다(실측 2026-08-09).
 */

describe("withExtension", () => {
  it("HEIC 를 .webp 로 바꾼다 — 이게 없으면 아이폰 사진이 전부 400", () => {
    expect(withExtension("photo.heic", "webp")).toBe("photo.webp");
  });

  it("png·jpg 도 출력 포맷으로 통일한다", () => {
    expect(withExtension("IMG_1234.PNG", "webp")).toBe("IMG_1234.webp");
    expect(withExtension("shot.jpg", "webp")).toBe("shot.webp");
  });

  it("JPEG 폴백이면 .jpg 를 붙인다 — 포맷과 이름이 함께 움직인다", () => {
    expect(withExtension("photo.heic", "jpg")).toBe("photo.jpg");
    expect(withExtension("shot.webp", "jpg")).toBe("shot.jpg");
  });

  it("이미 같은 확장자여도 그대로 둔다", () => {
    expect(withExtension("shirt.webp", "webp")).toBe("shirt.webp");
  });

  it("확장자가 없으면 붙인다", () => {
    expect(withExtension("scan", "webp")).toBe("scan.webp");
  });

  it("이름에 점이 여러 개면 마지막 것만 교체한다", () => {
    expect(withExtension("2026.08.09.한라봉.heic", "webp")).toBe(
      "2026.08.09.한라봉.webp",
    );
  });

  it("숨김파일처럼 이름이 비면 기본값을 쓴다 — 빈 확장자만 남기지 않는다", () => {
    expect(withExtension(".heic", "webp")).toBe("image.webp");
  });
});

describe("fitWithin", () => {
  it("가로가 길면 가로를 기준으로 맞춘다", () => {
    expect(fitWithin(4000, 3000, 1000)).toEqual({ w: 1000, h: 750 });
  });

  it("세로가 길면 세로를 기준으로 맞춘다", () => {
    expect(fitWithin(3000, 4000, 1000)).toEqual({ w: 750, h: 1000 });
  });

  it("정사각형은 그대로 정사각형 — 최대 픽셀 케이스다", () => {
    expect(fitWithin(2400, 2400, 1000)).toEqual({ w: 1000, h: 1000 });
  });

  it("원본이 더 작으면 확대하지 않는다", () => {
    // 800x600 을 1000 으로 늘리면 화질만 나빠지고 용량은 커진다
    expect(fitWithin(800, 600, 1000)).toEqual({ w: 800, h: 600 });
  });

  it("폴백 단계(800·500)에서도 비율이 유지된다", () => {
    expect(fitWithin(4000, 3000, 800)).toEqual({ w: 800, h: 600 });
    expect(fitWithin(4000, 3000, 500)).toEqual({ w: 500, h: 375 });
  });

  it("나누어떨어지지 않아도 정수로 떨어진다", () => {
    // 소수가 남으면 canvas 가 반올림하며 1px 씩 어긋난다
    const { w, h } = fitWithin(1333, 999, 1000);
    expect(Number.isInteger(w)).toBe(true);
    expect(Number.isInteger(h)).toBe(true);
    expect(w).toBe(1000);
  });
});
