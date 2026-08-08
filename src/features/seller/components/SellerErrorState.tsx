"use client";

import { cn } from "@/lib/utils";
import { hoverMuted, pressable } from "../interaction";
import { toSellerErrorView } from "../sellerError";

/**
 * 판매자 화면 조회 실패 표시 — 세 화면(대시보드·주문·상품)이 공유한다.
 * 원인에 따라 안내와 재시도 제공 여부가 달라지므로 판정은 toSellerErrorView 가 한다.
 */
export function SellerErrorState({
  error,
  fallbackMessage,
  onRetry,
}: {
  error: unknown;
  /** 코드로 분기되지 않는 실패에 쓸 문구(화면마다 대상이 다르다) */
  fallbackMessage: string;
  onRetry: () => void;
}) {
  const { message, retryable, hint } = toSellerErrorView(
    error,
    fallbackMessage,
  );

  return (
    <div className="flex flex-col items-center gap-3 rounded-sm border py-16 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {/* 재시도해도 같은 결과가 뻔한 실패(브랜드 미연결·파라미터 오류)엔 버튼을 주지 않는다 */}
      {retryable && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "h-11 rounded-full border px-5 text-sm font-medium",
            pressable,
            hoverMuted,
          )}
        >
          다시 시도
        </button>
      )}
    </div>
  );
}
