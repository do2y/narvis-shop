"use client";

import { useAuthStore } from "@/shared/stores/authStore";

/**
 * 랜딩 CTA의 실제 목적지 — 기존 라우팅·가드 정책을 그대로 따른다.
 *
 * 여기서 새 정책을 만들지 않는다. 판정 근거는 전부 이미 코드에 있다:
 *  - 구매자 채팅(/chat)은 게스트도 쓴다 → 로그인을 요구하지 않는다(CLAUDE.md 게스트 정책)
 *  - 판매자 채팅(/seller/chat)은 `RequireRole role="SELLER"` 아래다(app/seller/layout.tsx)
 *  - 미인증 접근은 `?returnUrl=`을 붙여 /login으로(shared/auth/guards.tsx)
 *  - 로그인 후 SELLER는 returnUrl이 /seller 밖이면 무시된다(auth/useAuthForm.ts postLoginDest)
 *
 * 판매자 계정 **생성 방식은 미정**이라(CLAUDE.md 미확정 항목) 가입 경로를 만들지 않는다.
 * 일반 회원에게는 "판매자 계정으로 로그인해 주세요"까지만 알린다 — 없는 흐름을
 * 있는 것처럼 안내하면 사용자가 막다른 길에 도달한다.
 */

const BUYER_CHAT_PATH = "/chat";
const SELLER_CHAT_PATH = "/seller/chat";

type SellerCtaMode =
  /** 바로 판매자 채팅으로 (SELLER 계정) */
  | "go"
  /** 로그인 필요 — returnUrl 로 판매자 채팅을 지정 */
  | "login"
  /** 로그인은 했지만 판매자 계정이 아님 — 안내만 하고 보내지 않는다 */
  | "wrongRole";

export interface SellerCta {
  mode: SellerCtaMode;
  href: string;
  /** 역할이 맞지 않을 때 버튼 아래에 덧붙일 설명. 그 외에는 null */
  notice: string | null;
}

/**
 * 판매자 CTA의 목적지·안내 문구.
 *
 * 세션 복원 중(isRestoring)에는 아직 역할을 모른다. 이때 "로그인하세요"를 보여주면
 * 이미 판매자로 로그인한 사용자에게 한 프레임 잘못된 문구가 스친다 — 복원이 끝날
 * 때까지는 로그인 경로로 두되 안내 문구는 띄우지 않는다(문구가 더 눈에 띈다).
 */
export function useSellerCta(): SellerCta {
  const user = useAuthStore((s) => s.user);
  const isRestoring = useAuthStore((s) => s.isRestoring);

  const loginHref = `/login?returnUrl=${encodeURIComponent(SELLER_CHAT_PATH)}`;

  if (isRestoring || !user) {
    return { mode: "login", href: loginHref, notice: null };
  }

  if (user.role === "SELLER") {
    return { mode: "go", href: SELLER_CHAT_PATH, notice: null };
  }

  // MEMBER·ADMIN — 가드가 /로 돌려보내므로 보내지 않고 이유를 말한다.
  return {
    mode: "wrongRole",
    href: loginHref,
    notice: "판매자 계정으로 로그인하면 이용할 수 있어요.",
  };
}

/**
 * 구매자 CTA — 게스트도 그대로 통과한다.
 *
 * 단, 판매자 계정은 쇼핑몰 라우트에서 격리되므로(SellerIsolation) /chat으로 보내면
 * /seller로 튕긴다. 그 경우엔 판매자 채팅을 가리켜 헛걸음을 없앤다.
 */
export function useBuyerCtaHref(): string {
  const user = useAuthStore((s) => s.user);
  return user?.role === "SELLER" ? SELLER_CHAT_PATH : BUYER_CHAT_PATH;
}
