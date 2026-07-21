import { useAuthStore } from '@/shared/stores/authStore';
import type { ChatEvent, ChatRequest } from '@/shared/types/chat';

/**
 * 채팅 SSE 스트림 소비 유틸.
 * POST + JSON body이므로 EventSource가 아닌 fetch 스트리밍으로 파싱한다.
 * 자동 재시도 금지(중복 담기 방지) — 실패 시 호출부에서 재시도 버튼 제공.
 */
export async function streamChat(
  req: ChatRequest,
  onEvent: (e: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = useAuthStore.getState().accessToken;

  // TODO: 엔드포인트는 백엔드 확정 시 반영
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(req),
    signal,
  });

  if (!res.ok || !res.body) throw new Error(`chat request failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE는 \r\n을 허용하므로 정규화 후 빈 줄로 이벤트를 가른다.
      buffer = buffer.replace(/\r\n/g, '\n');
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() ?? ''; // 미완성 조각 보류

      for (const chunk of chunks) emit(chunk, onEvent);
    }

    // 마지막 이벤트 뒤에 빈 줄이 없을 수 있어 잔여 버퍼도 처리한다.
    if (buffer.trim()) emit(buffer, onEvent);
  } finally {
    // 중도 이탈(abort·예외) 시 커넥션이 남지 않도록 항상 해제한다.
    reader.cancel().catch(() => {});
  }
}

/**
 * 이벤트 1건 파싱 후 통지.
 * 깨진 JSON 하나가 스트림 전체를 죽이지 않도록 여기서 삼킨다 —
 * 자동 재시도 금지(CLAUDE.md)라 예외가 올라가면 사용자가 재시도 버튼을 누를 때까지
 * 대화가 끊긴다. token 한 조각 손실이 대화 중단보다 낫다.
 */
function emit(chunk: string, onEvent: (e: ChatEvent) => void): void {
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of chunk.split('\n')) {
    if (line.startsWith(':')) continue; // 주석/keep-alive
    if (line.startsWith('event:')) event = line.slice(6).trim();
    // SSE 규격상 여러 data: 줄은 \n으로 이어야 한다.
    // trim()으로 붙이면 줄바꿈 포함 토큰이 손상된다(선행 공백 1칸만 제거).
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
  }

  if (dataLines.length === 0) return;
  const data = dataLines.join('\n');
  if (!data.trim()) return;

  try {
    onEvent({ event, data: JSON.parse(data) } as ChatEvent);
  } catch {
    // 파싱 실패 이벤트만 건너뛴다.
  }
}
