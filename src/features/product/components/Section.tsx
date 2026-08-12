"use client";

import { cn } from "@/lib/utils";

/**
 * 상세 페이지의 섹션 껍데기 — 제목 크기·굵기·제목↔본문 간격을 한 곳에서 정한다.
 *
 * 종전에는 상품 정보·상세 설명·리뷰가 각자 `<section className="flex flex-col gap-4">`
 * 에 `<h2 className="text-lg font-bold">` 를 들고 있었다. 값이 같아도 세 벌로
 * 흩어져 있으면 한 곳만 고쳐져 어긋나기 시작하고, 실제로 리뷰만 gap-6 이었다.
 *
 * 제목을 text-base 로 내린 이유(종전 text-lg): 이 페이지에서 가장 큰 글자는
 * 상품명과 판매가여야 한다. 섹션 제목이 그만큼 크면 스크롤할 때 제목이 상품보다
 * 먼저 읽혀 위계가 뒤집힌다. 굵기(semibold)와 tracking 으로 충분히 구분된다.
 */
export function Section({
  title,
  /** 제목 오른쪽 보조 컨트롤(리뷰 정렬 등). 없으면 제목만. */
  aside,
  children,
  className,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-5", className)}>
      {/* min-h-9: aside 유무에 따라 제목 줄 높이가 달라지면 섹션마다 제목↔본문
          간격이 미묘하게 어긋난다. 버튼이 들어갈 높이를 미리 잡아 고정한다. */}
      <div className="flex min-h-9 items-center justify-between gap-4">
        <h2 className="text-base font-semibold tracking-[-0.01em]">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
