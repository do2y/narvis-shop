"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 상품 이미지 — 로드 실패 시 대체 화면으로 바꾼다.
 *
 * 실패는 상시 일어난다: 이미지가 지워졌거나, 스토리지 URL이 잘못 내려오거나(실제로
 * 버킷명이 어긋나 전 상품이 깨진 적 있음), 오프라인이거나. 대체 화면이 없으면
 * 브라우저 기본 깨진 아이콘이 뜨는데, 카드 레이아웃이 그대로 무너져 보인다.
 *
 * 도메인을 모르는 순수 UI다 — 상품 객체가 아니라 src·alt만 받는다.
 * 카드마다 따로 처리하면 화면별로 실패 모습이 갈리므로 여기 하나로 모은다.
 */
export function ProductImage({
  src,
  alt,
  className,
  loading = "lazy",
  fetchPriority,
}: {
  src?: string | null;
  alt: string;
  /** 이미지 자체에 붙일 클래스 — 카드마다 object-cover·hover 확대 등이 다르다 */
  className?: string;
  loading?: "lazy" | "eager";
  /**
   * LCP 이미지에만 "high"를 준다(상품 상세의 메인 사진 등).
   * loading="eager"는 "지연하지 말라"일 뿐 순서를 정하지 않아, 같이 대기 중인
   * 다른 리소스와 경쟁한다. 이 값이 그 경쟁에서 먼저 가져올 것을 지정한다.
   * 남용하면 서로 밀어내 의미가 없어지므로 화면당 한 장만.
   */
  fetchPriority?: "high" | "low" | "auto";
}) {
  const [failed, setFailed] = useState(false);

  // src가 아예 없는 경우도 실패와 같이 취급한다 — 빈 문자열을 넣으면
  // 브라우저가 현재 페이지를 다시 요청해 불필요한 트래픽이 생긴다.
  if (!src || failed) {
    return (
      <div
        // alt=""는 장식용(옆에 상품명이 이미 있음)이라는 뜻이므로 대체 화면도
        // 스크린리더에서 숨긴다 — 이름을 두 번 읽히지 않게.
        {...(alt
          ? { role: "img", "aria-label": `${alt} (이미지 없음)` }
          : { "aria-hidden": true })}
        className={cn(
          "flex size-full items-center justify-center bg-muted",
          className,
        )}
      >
        <ImageOff className="size-6 text-muted-foreground/50" aria-hidden />
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element -- runtime product URLs need native img fallback handling and may not match next/image remote config */
    <img
      src={src}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
