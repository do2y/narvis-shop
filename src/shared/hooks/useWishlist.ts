"use client";

import { createElement } from "react";
import { HeartOff } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addWishlistItem,
  fetchWishlist,
  removeWishlistItem,
} from "@/shared/api/wishlist";
import { ApiError } from "@/shared/api/client";
import { useRequireLogin } from "@/shared/hooks/useRequireLogin";
import { selectIsAuthReady, useAuthStore } from "@/shared/stores/authStore";
import type { WishlistProduct } from "@/shared/types/wishlist";

// 찜한 상품 — 서버 원본. 찜 추가·해제로 자주 바뀌어 staleTime 0.
// 게스트는 401이라 아예 호출하지 않는다(찜은 로그인 필요).
// 복원 완료 전에도 보내면 안 된다 — AT 없이 나가 401 → 로그인으로 튕긴다.
export function useWishlist() {
  const isAuthReady = useAuthStore(selectIsAuthReady);

  return useQuery({
    queryKey: ["wishlist"],
    queryFn: fetchWishlist,
    staleTime: 0,
    enabled: isAuthReady,
  });
}

// 특정 상품이 찜 상태인지 — 목록에서 파생한다.
// 별도 조회 API가 없어 목록을 기준으로 삼는다(목록이 없으면 false).
export function useIsWished(productId: string): boolean {
  const { data } = useWishlist();
  return !!data?.some((p) => p.productId === productId);
}

/**
 * 낙관적 추가에 쓸 카드 데이터.
 *
 * 호출부가 이미 화면에 그리고 있는 값이라 그대로 넘기면 된다. 넘기지 않으면
 * 추가 쪽 낙관적 반영은 생략되고 서버 재조회로만 확정된다(종전 동작).
 */
export type WishlistSeed = Omit<WishlistProduct, "productId">;

/**
 * 낙관적 목록 갱신 — 훅 밖에 두어 테스트로 고정한다.
 *
 * 경계 조건이 셋이라 인라인으로 두면 검증할 수가 없다:
 *  - 목록 캐시가 아직 없으면(undefined) 만들지 않는다. 빈 배열을 세우면
 *    "찜이 이것뿐"이라고 단정하는 셈이라 찜 목록 화면이 잘못 그려진다
 *  - 이미 있는 상품은 중복 삽입하지 않는다(연타·중복 이벤트)
 *  - 추가인데 seed 가 없으면 건드리지 않는다 — 서버 재조회에 맡긴다
 */
export function applyWishlistToggle(
  old: WishlistProduct[] | undefined,
  productId: string,
  wished: boolean,
  seed?: WishlistSeed,
): WishlistProduct[] | undefined {
  if (wished) return old?.filter((p) => p.productId !== productId);
  if (!old || !seed) return old;
  if (old.some((p) => p.productId === productId)) return old;
  // 찜 목록이 최신순이라 맨 앞에 넣어야 재조회 결과와 순서가 어긋나지 않는다.
  return [{ productId, ...seed }, ...old];
}

/**
 * 찜 실패 안내 문구 (담기의 toAddCartMessage 와 같은 역할).
 *
 * WISHLIST_DUPLICATE·WISHLIST_NOT_FOUND 는 여기서 다루지 않는다 — 원하는 상태에
 * 이미 도달해 있어 사용자에겐 실패가 아니고, onError 가 서버 기준으로 맞춘다.
 */
/**
 * 성공 토스트 문구.
 *
 * 인자는 **요청 당시** 찜 상태다 — 완료 시점의 서버 상태로 판정하면
 * 재조회가 먼저 끝났을 때 "해제했어요"가 떠야 할 자리에 반대 문구가 나간다.
 */
export function wishlistSuccessMessage(wishedBefore: boolean): string {
  return wishedBefore ? "찜을 해제했어요." : "찜에 담았어요.";
}

export function toWishlistMessage(error: unknown): string | null {
  if (error instanceof ApiError) {
    if (
      error.code === "WISHLIST_DUPLICATE" ||
      error.code === "WISHLIST_NOT_FOUND"
    ) {
      return null;
    }
    if (error.code === "PRODUCT_NOT_FOUND") return "상품을 찾을 수 없어요.";
    if (error.displayMessage) return error.displayMessage;
  }
  return "잠시 후 다시 시도해주세요.";
}

// 찜 추가·해제 토글.
// 게스트가 누르면 로그인 유도 모달을 띄운다 — 이동은 사용자가 [로그인하기]를 고른
// 뒤에만 일어난다(returnUrl로 복귀).
// 낙관적 업데이트 — 하트가 즉시 반응해야 하므로. 실패 시 롤백.
export function useToggleWishlist() {
  const queryClient = useQueryClient();
  const requireLogin = useRequireLogin();
  // 여기선 "로그인 화면으로 보낼지"를 판단하므로 user 기준이다.
  // AT(=isAuthReady)로 보면 복원 중인 로그인 사용자를 게스트로 오인해 로그인으로 보낸다.
  const isAuthed = useAuthStore((s) => s.user !== null);

  const mutation = useMutation({
    mutationFn: ({
      productId,
      wished,
    }: {
      productId: string;
      wished: boolean;
      /** 낙관적 삽입용. 서버 요청에는 쓰지 않는다(productId 만 보낸다). */
      seed?: WishlistSeed;
    }) => (wished ? removeWishlistItem(productId) : addWishlistItem(productId)),

    onMutate: async ({ productId, wished, seed }) => {
      await queryClient.cancelQueries({ queryKey: ["wishlist"] });
      const previous = queryClient.getQueryData<WishlistProduct[]>(["wishlist"]);

      // 하트는 목록에서 파생되므로(useIsWished) 이 갱신이 없으면 서버 응답이
      // 올 때까지 눌러도 아무 반응이 없다 — 눌렸는지조차 알 수 없었다.
      queryClient.setQueryData<WishlistProduct[]>(["wishlist"], (old) =>
        applyWishlistToggle(old, productId, wished, seed),
      );
      return { previous };
    },

    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["wishlist"], context.previous);
      }
      // 이미 찜함(409 WISHLIST_DUPLICATE)·이미 해제됨(404 WISHLIST_NOT_FOUND)은
      // 사용자 입장에선 실패가 아니다. 원하는 상태에 이미 도달해 있으므로
      // 롤백을 되돌리고 서버 기준으로 맞춘다.
      // (onSettled가 어차피 재조회하지만, 롤백된 하트가 잠깐 보이는 것을 막는다)
      // status 404로 뭉치면 안 된다 — 찜 추가의 PRODUCT_NOT_FOUND(없는 상품)도 404라
      // 진짜 실패를 성공으로 오인해 하트가 켜진 채 남는다(M-5·M-6).
      if (
        error instanceof ApiError &&
        (error.code === "WISHLIST_DUPLICATE" ||
          error.code === "WISHLIST_NOT_FOUND")
      ) {
        queryClient.invalidateQueries({ queryKey: ["wishlist"] });
        return;
      }

      // 성공 토스트와 같은 이유로 콜백에서 띄운다(이펙트 관찰은 재조회와 경쟁한다).
      const message = toWishlistMessage(error);
      if (message) toast.error(message);
    },

    onSuccess: (_data, { wished }) => {
      // 토스트를 여기서 띄운다. mutation 상태(isSuccess)를 이펙트로 관찰하면
      // onSettled 의 재조회가 리렌더를 유발해 상태가 갈아엎히고, 이펙트가
      // 읽기 전에 사라져 토스트가 안 뜨는 경쟁이 생긴다.
      //
      // 담기와 해제를 같은 모양으로 알리지 않는다(apple-design §16 피드백 4종):
      //  - 담기는 완료(completion) — 체크 아이콘으로 "됐다"를 확인해 준다
      //  - 해제는 상태 변화(status) — 되돌린 것이라 성공 체크가 붙으면 어색하다.
      //    하트 아이콘으로 무엇이 바뀌었는지만 보여준다.
      if (wished) {
        toast(wishlistSuccessMessage(true), {
          icon: createElement(HeartOff, { className: "size-4" }),
        });
        return;
      }
      toast.success(wishlistSuccessMessage(false));
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });

  // seed 는 추가 시 낙관적 반영에만 쓴다 — 해제 경로에는 필요 없다.
  const toggle = (
    productId: string,
    wished: boolean,
    seed?: WishlistSeed,
  ) => {
    if (!isAuthed) {
      // 복귀 경로는 생략 — 찜 버튼은 상세·챗 카드·브랜드 카드 여러 곳에 있어
      // 지금 보고 있는 화면(기본값)이 곧 돌아올 자리다.
      requireLogin(
        undefined,
        "찜하려면 로그인이 필요해요.",
        "로그인하면 이 화면으로 돌아와요. 찜은 다시 눌러주세요.",
      );
      return;
    }
    mutation.mutate({ productId, wished, seed });
  };

  /**
   * 요청이 도는 동안 "이렇게 될 것"인 찜 상태.
   *
   * 목록 캐시에서 파생하는 useIsWished 만으로는 부족하다 — 찜 목록을 아직 한 번도
   * 받지 않았으면(챗 화면 첫 방문) 낙관적 삽입이 생략되고, 하트가 서버 응답까지
   * 아무 반응을 안 한다. 그 구간을 mutation 변수로 메운다.
   *
   * pending 이 끝나면 undefined 가 되어 서버 파생 상태(useIsWished)로 돌아간다.
   */
  const pendingWished = mutation.isPending
    ? !mutation.variables.wished
    : undefined;

  // 결과 안내(토스트)는 mutation 콜백이 직접 띄운다 — 상태로 노출해 호출부가
  // 이펙트로 관찰하면 onSettled 재조회와 경쟁해 발화가 누락된다.
  return { toggle, isPending: mutation.isPending, pendingWished };
}

/**
 * 찜 토글 + 결과 토스트.
 *
 * 찜 버튼이 챗봇 카드·브랜드 카드·상품 상세 세 곳에 있어, 발화 규칙을 각자
 * useEffect 로 베끼면 문구와 타이밍이 화면마다 갈린다. 여기 한 번만 둔다.
 *
 * 하트 상태(optimisticWished)까지 함께 돌려주는 이유: 호출부가 useIsWished 와
 * pendingWished 를 매번 조합해야 하는데, 그 조합을 빠뜨리면 "목록 캐시가 없을 때
 * 하트가 안 움직이는" 원래 증상이 그대로 재현된다.
 */
export function useWishlistToggleWithToast(productId: string) {
  const wished = useIsWished(productId);
  const { toggle, isPending, pendingWished } = useToggleWishlist();

  // 요청 중에는 의도한 상태를 먼저 보여준다. 목록 캐시가 있으면 낙관적 삽입으로
  // wished 가 이미 뒤집혀 있고, 없으면 pendingWished 가 그 자리를 메운다.
  const optimisticWished = pendingWished ?? wished;

  // 토스트는 mutation 콜백(onSuccess·onError)이 띄운다 — 여기서 상태를 관찰하면
  // onSettled 재조회와 경쟁해 발화가 누락된다.

  return {
    wished: optimisticWished,
    isPending,
    /** seed 를 넘기면 목록 캐시에 낙관적으로 끼워 하트가 즉시 반응한다. */
    toggle: (seed?: WishlistSeed) => toggle(productId, wished, seed),
  };
}