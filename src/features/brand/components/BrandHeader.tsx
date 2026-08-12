"use client";

import type { Brand } from "../types";

/**
 * 브랜드 소개 — 로고·이름·상품 수를 한 덩어리로 묶은 compact header.
 *
 * 종전에는 로고 줄 아래에 소개 문단이 따로 붙어 세로로 길었다. 그런데 이 브랜드
 * 데이터에는 description 이 비어 오는 경우가 많아, 실제로는 큰 빈 hero 만 남았다.
 * 있을 때만 그리고, 없으면 자리도 만들지 않는다(§16: 요소는 제 자리를 벌어야 한다).
 *
 * 로고는 monogram avatar 로 둔다 — 테두리 친 큰 사각형은 "이미지가 아직 안 온"
 * placeholder 로 읽힌다. 면색을 옅게 깔고 테두리를 없애면 그 자체로 완성된 마크가 된다.
 */
export function BrandHeader({
  brand,
  productCount,
}: {
  brand: Brand;
  productCount: number;
}) {
  // 공백만 있는 문자열도 없는 것으로 친다 — 그대로 그리면 빈 줄만 남는다.
  const description = brand.description?.trim();

  return (
    <header className="flex items-center gap-4 sm:gap-5">
      {/* 72~80px. rounded-[18px] — 원형은 로고 마크로, 각진 사각형은 미완성으로
          읽힌다. 그 사이의 squircle 이 브랜드 심볼로 가장 자연스럽다. */}
      <div className="flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-muted/60 sm:size-20">
        {brand.logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- brand logos come from runtime URLs and should render without next/image config coupling */
          <img
            src={brand.logoUrl}
            alt={`${brand.name} 로고`}
            className="size-full object-cover"
          />
        ) : (
          // 머리글자 — 글자·숫자가 아닌 문자는 건너뛴다. 브랜드명이 "(BD-2959)"
          // 처럼 오는 데이터가 있어(상품 상세에서 실제로 겪음) 그냥 첫 글자를 쓰면
          // "(" 만 남아 고장난 것처럼 보인다.
          <span
            aria-hidden
            className="text-2xl font-semibold text-muted-foreground sm:text-[28px]"
          >
            {[...brand.name].find((ch) => /[\p{L}\p{N}]/u.test(ch)) ?? "·"}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        {/* 이 페이지에서 가장 강한 제목. 큰 텍스트일수록 tracking 을 좁힌다(§15) */}
        <h1 className="truncate text-[22px] font-semibold leading-tight tracking-[-0.02em] sm:text-[26px]">
          {brand.name}
        </h1>
        <p className="text-sm text-muted-foreground tabular-nums">
          상품 {productCount.toLocaleString("ko-KR")}개
        </p>
        {/* 소개는 있을 때만. 2줄로 제한해 헤더 높이가 브랜드마다 들쭉날쭉해지지 않게 한다 */}
        {description && (
          <p className="mt-1 line-clamp-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </header>
  );
}
