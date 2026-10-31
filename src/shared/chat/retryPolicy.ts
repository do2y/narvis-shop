import type { ChatMessage, Resend } from "./store";

/**
 * 재시도 가능 여부 — 훅의 retry · 말풍선 버튼 · 판매자 등록 카드 버튼이 **같은 판정**을 쓴다.
 *
 * 셋이 따로 판단하면 "버튼은 보이는데 눌러도 아무 일 없는" 상태가 생긴다(I-4).
 * 버튼을 그릴지와 눌렀을 때 실제로 다시 보낼지를 한 함수로 묶는다.
 */
export function canRetry(
  messages: ChatMessage[],
  isStreaming: boolean,
  messageId: string | undefined,
): boolean {
  // 턴이 아직 열려 있으면(실패 표시 뒤 카드 조회 대기 등) 그 턴의 결과가 확정되지 않았다
  if (isStreaming) return false;
  const last = messages[messages.length - 1];
  // 대상은 마지막 말풍선뿐 — 위쪽 실패는 사실만 남긴다(대상 오인으로 다른 질문이 나가던 B4)
  if (!last || last.id !== messageId || last.role !== "assistant") return false;
  if (!last.error || last.retryable === false) return false;
  // 다시 보낼 것이 있어야 한다. 말풍선 없는 턴은 재전송 정보, 일반 발화는 바로 앞 user 말풍선
  if (isResend(last.resend)) return true;
  return messages[messages.length - 2]?.role === "user";
}

/**
 * 저장소에서 복원된 값은 형식을 보장할 수 없다(loadChat 은 메시지를 검증 없이 돌려준다).
 * 형식이 다르면 재전송 정보가 없는 것으로 본다 — 엉뚱한 요청을 만들지 않게.
 */
export function isResend(value: unknown): value is Resend {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { kind?: unknown; draftId?: unknown; actions?: unknown };
  if (v.kind === "confirm") {
    return typeof v.draftId === "string" && v.draftId.length > 0;
  }
  if (v.kind === "conditions") {
    return (
      Array.isArray(v.actions) &&
      v.actions.length > 0 &&
      v.actions.every(isRemoveAction)
    );
  }
  return false;
}

function isRemoveAction(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const a = value as { op?: unknown; field?: unknown; value?: unknown };
  return (
    a.op === "remove" &&
    typeof a.field === "string" &&
    (a.value === undefined ||
      typeof a.value === "string" ||
      typeof a.value === "number")
  );
}
