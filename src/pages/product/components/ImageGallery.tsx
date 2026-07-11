import { useState } from "react";
import { cn } from "@/lib/utils";

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
      <div className="aspect-square w-full overflow-hidden rounded-xl bg-muted">
        {main && (
          <img src={main} alt={alt} className="size-full object-cover" />
        )}
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
                "aspect-square w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-colors",
                i === active ? "border-primary" : "border-transparent",
              )}
            >
              <img
                src={src}
                alt={`${alt} ${i + 1}`}
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
