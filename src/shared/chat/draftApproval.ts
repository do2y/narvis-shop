import { useAuthStore } from "@/shared/stores/authStore";
import type { ChatResult, DraftApproval, SellerDraft } from "@/shared/types/chat";
import { useChatStore, type UnresolvedApproval } from "./store";

/**
 * 판매자 승인의 초안별 상태.
 *
 * 말풍선이 아니라 초안(draftId)에 붙인다 — 마지막 말풍선으로 판단하면 무관한 턴의 실패와 섞인다.
 *
 * 현재 계약의 action 에는 draftId 가 없고 서버가 보내는지도 확인되지 않아, 어떤 이벤트도
 * "이 초안의 승인 성공"을 보장하지 못한다. 그래서 settled(성공)를 기록하지 않고 closed 로 둔다.
 * closed·unknown 은 실패가 아니라 "실행 여부를 모른다"는 뜻이다 — 같은 초안으로 다시 실행하지 않는다.
 */

/** 요청을 내보낸 뒤 실패했을 때의 안내 — 실행 여부를 단정하지 않는다 */
export const CONFIRM_UNKNOWN =
  "요청이 처리됐는지 확인하지 못했어요. 상품 목록에서 반영 여부를 확인한 뒤 다시 진행해 주세요.";

type DraftResult = Extract<ChatResult, { kind: "draft" }>;

export function draftResultOf(draftId: string): DraftResult | undefined {
  return useChatStore
    .getState()
    .results.find(
      (r): r is DraftResult => r.kind === "draft" && r.draft.draftId === draftId,
    );
}

/** 처리 여부가 불명확한 승인을 남긴다 — 초안이 교체·삭제돼도 다음 승인에서 경고하려고 */
export function recordUnresolved(draftId: string): void {
  const result = draftResultOf(draftId);
  if (!result) return;
  const { op, productId } = result.draft;
  useChatStore.getState().addUnresolvedApproval({
    draftId,
    op,
    productId,
    ownerId: useAuthStore.getState().user?.id ?? null,
  });
}

function finish(draftId: string, approval: Extract<DraftApproval, "unknown" | "closed">) {
  useChatStore.getState().setDraftApproval(draftId, approval);
  recordUnresolved(draftId);
}

/** 서버가 판정 가능한 근거 없이 응답을 끝냈다(action 이 있어도 이 초안의 성공을 보장하지 못한다) */
export function closeApproval(draftId: string): void {
  finish(draftId, "closed");
}

/**
 * 승인 턴이 끝날 때 아직 진행 중이면 결과를 정한다.
 * action 으로 이미 정해졌으면 건드리지 않는다.
 */
export function settleApproval(
  draftId: string,
  requestStarted: boolean,
  failed: boolean,
): void {
  if (draftResultOf(draftId)?.approval !== "pending") return;
  if (failed) {
    if (requestStarted) finish(draftId, "unknown");
    else useChatStore.getState().setDraftApproval(draftId, undefined);
    return;
  }
  closeApproval(draftId);
}

/** 이 초안을 승인하면 이전 승인과 중복될 수 있는가 — 같은 계정의 기록만 본다 */
export function hasDuplicateRisk(
  unresolved: UnresolvedApproval[],
  draft: SellerDraft,
  ownerId: string | null,
): boolean {
  return unresolved.some((u) => matches(u, draft, ownerId));
}

/** "확인했고 승인"을 고른 대상의 기록을 지운다. 사용자의 확인이지 서버 사실이 아니다 */
export function acknowledgeUnresolved(draft: SellerDraft): void {
  const ownerId = useAuthStore.getState().user?.id ?? null;
  const { unresolvedApprovals, removeUnresolvedApproval } = useChatStore.getState();
  unresolvedApprovals
    .filter((u) => matches(u, draft, ownerId))
    .forEach((u) => removeUnresolvedApproval(u.draftId));
}

function matches(
  unresolved: UnresolvedApproval,
  draft: SellerDraft,
  ownerId: string | null,
): boolean {
  if (unresolved.ownerId !== ownerId) return false;
  // 등록은 아직 상품 id 가 없어 같은 상품인지 판단할 수 없다 — 미해결 등록이면 경고한다
  if (draft.op === "create") return unresolved.op === "create";
  return unresolved.productId === draft.productId;
}
