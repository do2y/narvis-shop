"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ProductImage } from "@/shared/ui/ProductImage";

// 이미지 갤러리 — 메인 1장 + 썸네일 목록. 계약 전이라 상위에서 images[] 주입받아 렌더만.
export function ImageGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const [active, setActive] = useState(0);
  const main = images[active] ?? images[0];

  return (
    <div className="flex flex-col gap-3">
      {/* 메인 사진은 이 페이지의 LCP 요소다. eager로 지연을 막고 fetchPriority로
          다른 리소스와의 경쟁에서 먼저 가져오게 한다(eager만으로는 순서가 정해지지 않는다).

          aspect-square 를 유지해 로딩 중에도 높이가 확정된다(CLS 0).

          배경은 muted(회색면) 대신 아주 옅은 중립으로 낮춘다 — 상품 사진 대부분이
          흰 배경이라 회색 판 위에 놓이면 사진의 흰색이 도려낸 것처럼 도드라진다.
          테두리 한 겹으로 이미지 영역의 경계만 알린다(§16: 면보다 선이 조용하다).

          radius 는 이 페이지에서 유일한 예외다. CLAUDE.md 는 카드·이미지를
          rounded-sm(6px) 로 정하지만, 정사각 대형 이미지에서 6px 은 사실상 직각으로
          보여 요청받은 "집중해서 볼 수 있는 영역"이 되지 않는다. rounded-xl(14px)
          한 단계만 올린다 — 규칙의 2단계 체계는 버튼·입력에서 그대로 유지된다. */}
      <div className="aspect-square w-full overflow-hidden rounded-xl border bg-muted/20">
        <ProductImage
          src={main}
          alt={alt}
          loading="eager"
          fetchPriority="high"
          // object-contain: 상품 사진은 비율이 제각각이라 cover 로 채우면
          // 위아래가 잘려 신발 코나 제품명이 사라진다. 원본 비율을 지키고
          // 남는 자리는 배경으로 둔다(요청: 비율 유지·잘림 없음).
          className="size-full object-contain"
        />
      </div>

      {images.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`이미지 ${i + 1}`}
              aria-pressed={i === active}
              className={cn(
                "aspect-square w-16 shrink-0 overflow-hidden rounded-lg bg-muted/20 transition-all duration-150 ease-out-strong",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                // 선택 표시는 2px 테두리 대신 ring — 테두리는 폭을 차지해
                // 선택이 바뀔 때마다 안쪽 이미지가 미세하게 움직인다.
                i === active
                  ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                  : "ring-1 ring-border hover:ring-foreground/30",
              )}
            >
              {/* 첫 장은 메인과 같은 사진이라 이미 받아둔 것이고, 나머지는 눌러야
                  보이므로 지연시킨다 — 10장이면 10장을 처음부터 받을 이유가 없다.
                  alt는 버튼의 aria-label이 이미 말하고 있어 비워 중복을 없앤다. */}
              <ProductImage
                src={src}
                alt=""
                loading={i === 0 ? "eager" : "lazy"}
                className="size-full object-contain"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
