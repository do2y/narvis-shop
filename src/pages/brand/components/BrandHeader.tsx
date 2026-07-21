import type { Brand } from "../types";

// 브랜드 소개 영역 — 로고·이름·소개 문단.
// logoUrl이 비어 있으면 이름 첫 글자로 대체한다.
export function BrandHeader({
  brand,
  productCount,
}: {
  brand: Brand;
  productCount: number;
}) {
  return (
    <header className="flex flex-col gap-6">
      <div className="flex items-center gap-4 sm:gap-5">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-sm border bg-background sm:size-20">
          {brand.logoUrl ? (
            <img
              src={brand.logoUrl}
              alt={`${brand.name} 로고`}
              className="size-full object-cover"
            />
          ) : (
            <span className="text-xl font-bold sm:text-2xl">
              {brand.name.slice(0, 1)}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          {/* 큰 텍스트일수록 tracking을 좁힌다(apple-design §15) — 기존 PageTitle과 동일 값 */}
          <h1 className="text-xl font-bold leading-tight tracking-[-0.02em] sm:text-2xl">
            {brand.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            상품 {productCount.toLocaleString("ko-KR")}개
          </p>
        </div>
      </div>

      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {brand.description}
      </p>
    </header>
  );
}
