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
          다른 리소스와의 경쟁에서 먼저 가져오게 한다(eager만으로는 순서가 정해지지 않는다). */}
      <div className="aspect-square w-full overflow-hidden rounded-sm bg-muted">
        <ProductImage
          src={main}
          alt={alt}
          loading="eager"
          fetchPriority="high"
          className="size-full object-cover"
        />
      </div>

      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`이미지 ${i + 1}`}
              aria-pressed={i === active}
              className={cn(
                "aspect-square w-20 shrink-0 overflow-hidden rounded-sm border-2 transition-colors",
                i === active ? "border-primary" : "border-transparent",
              )}
            >
              {/* 첫 장은 메인과 같은 사진이라 이미 받아둔 것이고, 나머지는 눌러야
                  보이므로 지연시킨다 — 10장이면 10장을 처음부터 받을 이유가 없다.
                  alt는 버튼의 aria-label이 이미 말하고 있어 비워 중복을 없앤다. */}
              <ProductImage
                src={src}
                alt=""
                loading={i === 0 ? "eager" : "lazy"}
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
