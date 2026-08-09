import { describe, expect, it } from "vitest";
import { fitWithin, toJpegFilename } from "./resizeImage";

/**
 * 업로드 전 리사이즈의 순수 계산부.
 *
 * 두 가지를 고정한다:
 *  1. 파일명 확장자 — S-6 는 확장자와 contentType 이 어긋나면 IMAGE_TYPE_UNSUPPORTED 로
 *     거부한다. 리사이즈 결과는 항상 JPEG 이므로 이름도 .jpg 여야 한다.
 *     photo.heic 를 그대로 보내면 heic + image/jpeg 조합이 되어 업로드가 통째로 막힌다.
 *  2. 크기 계산 — 기존 상품 이미지가 긴 변 1000px 이라 거기 맞춘다(실측 2026-08-09).
 */

describe("toJpegFilename", () => {
  it("HEIC 를 .jpg 로 바꾼다 — 이게 없으면 아이폰 사진이 전부 400", () => {
    expect(toJpegFilename("photo.heic")).toBe("photo.jpg");
  });

  it("png·webp 도 .jpg 로 통일한다", () => {
    expect(toJpegFilename("IMG_1234.PNG")).toBe("IMG_1234.jpg");
    expect(toJpegFilename("shot.webp")).toBe("shot.jpg");
  });

  it("이미 jpg 여도 그대로 둔다", () => {
    expect(toJpegFilename("shirt.jpg")).toBe("shirt.jpg");
  });

  it("확장자가 없으면 붙인다", () => {
    expect(toJpegFilename("scan")).toBe("scan.jpg");
  });

  it("이름에 점이 여러 개면 마지막 것만 교체한다", () => {
    expect(toJpegFilename("2026.08.09.한라봉.heic")).toBe(
      "2026.08.09.한라봉.jpg",
    );
  });

  it("숨김파일처럼 이름이 비면 기본값을 쓴다 — 빈 확장자만 남기지 않는다", () => {
    expect(toJpegFilename(".heic")).toBe("image.jpg");
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
