"use client";

import {
  claimChatSession,
  openChatSession,
  openSellerSession,
  reissueTicket,
} from "./sessions";
import type { ChatChannel, ChatSession } from "@/shared/types/chat";

/**
 * 챗 세션 발급·재발급을 탭 전체에서 단일화한다.
 *
 * CH-1 은 멱등 발급이라 같은 신원·채널이면 서버가 같은 sessionId 를 돌려준다
 * (멀티탭이 서로를 축출하지 않는다). 그래서 이 모듈의 목적은 축출 방지가 아니라
 * 중복 호출 억제다 — 탭 N 개가 동시에 진입해도 CH-1 은 1회만 나간다.
 * 방(thread) 분리는 threadId.ts 몫이다.
 *
 * 락은 발급/재발급만 감싼다. 장시간 SSE 스트림까지 감싸면 그동안 다른 탭의 발급이 막힌다.
 */

/**
 * 승계(CH-7) 실패가 미해결인 상태에서 새 세션 발급이 필요해졌을 때 던진다.
 *
 * 자동으로 새 세션을 만들면 화면엔 이전 대화가 남았는데 AI 는 기억하지 못하는
 * 어긋남이 생긴다. 호출부가 이 에러를 잡아 "승계 실패" 안내를 띄우고,
 * 사용자가 재시도/새 대화를 고른 뒤에야 발급이 재개된다.
 */
export class SessionClaimPendingError extends Error {
  constructor() {
    super("chat session claim is pending user decision");
    this.name = "SessionClaimPendingError";
  }
}

/** 락·localStorage 키는 채널별로 분리 — SHOPPING 과 SELLER 는 서로 다른 접속이다. */
const keyFor = (channel: ChatChannel) => `jarvis:chat:session:${channel}`;

/**
 * 티켓 TTL(30~60초)보다 짧게 잡아 만료 직전 세션을 재사용하지 않게 한다.
 * 스트림 401 재발급 경로가 있으므로 보수적으로 잡아도 손해가 없다.
 */
const TICKET_TTL_MS = 25_000;

/** degrade 경로에서 다른 탭의 브로드캐스트를 기다리는 시간(이중 발급 회피) */
const ELECTION_WAIT_MS = 300;

interface CachedSession {
  session: ChatSession;
  /** 이 캐시를 쓴 시각(ms). 티켓 신선도 판정용 — 서버 시계가 아니라 로컬 기준이다. */
  storedAt: number;
}

/**
 * 탭 간 방송 메시지.
 *
 * session — 세션·티켓이 갱신됐다(발급·재발급). 받는 탭은 표시용 sessionId 만 맞춘다.
 * ownership — 세션의 주인이 게스트에서 회원으로 바뀌었다(다른 탭에서 로그인).
 *
 * 둘을 나누는 이유: 받는 쪽이 "티켓이 새로 왔다"와 "내 자격이 무효가 됐다"를
 * 구분할 수 있어야 한다. session 하나로만 알리면 후자를 판단할 수 없어,
 * 방송 도착 전에 시작된 전송이 구 게스트 티켓으로 나가 AI 에서 403 을 맞는다.
 */
type SessionBroadcast =
  | { type: "session"; channel: ChatChannel; session: ChatSession }
  | { type: "ownership"; channel: ChatChannel; sessionId: string };

// BroadcastChannel 미지원(구형 브라우저)이면 null — degrade 경로가 받는다.
const bc: BroadcastChannel | null =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("jarvis:chat")
    : null;

/**
 * localStorage 접근은 private mode 등에서 던질 수 있다. 캐시는 최적화일 뿐이고
 * 직렬화는 락+브로드캐스트가 담당하므로 실패는 조용히 흡수한다.
 */
function readCache(channel: ChatChannel): ChatSession | null {
  try {
    const raw = localStorage.getItem(keyFor(channel));
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedSession;
    if (Date.now() - cached.storedAt > TICKET_TTL_MS) return null;
    return cached.session;
  } catch {
    return null;
  }
}

function writeCache(channel: ChatChannel, session: ChatSession): void {
  try {
    const payload: CachedSession = { session, storedAt: Date.now() };
    localStorage.setItem(keyFor(channel), JSON.stringify(payload));
  } catch {
    // private mode — 락+브로드캐스트만으로도 동작한다
  }
}

/** 세션이 죽었다(404)고 판명되면 캐시를 비워 다음 탭이 stale 세션을 물지 않게 한다. */
export function clearCachedSession(channel: ChatChannel): void {
  try {
    localStorage.removeItem(keyFor(channel));
  } catch {
    // 무시 — 캐시 제거 실패는 재발급으로 자연 복구된다
  }
}

function publish(channel: ChatChannel, session: ChatSession): void {
  writeCache(channel, session);
  bc?.postMessage({ type: "session", channel, session } satisfies SessionBroadcast);
}

/**
 * 다른 탭이 발급한 세션을 구독한다. 리더 탭이 티켓을 갱신하면 팔로워 탭도
 * 즉시 최신 세션을 알게 된다. 반환값은 구독 해제 함수(effect cleanup 필수).
 */
export function subscribeSession(
  channel: ChatChannel,
  cb: (session: ChatSession) => void,
): () => void {
  if (!bc) return () => {};
  const onMessage = (e: MessageEvent<SessionBroadcast>) => {
    if (e.data?.type === "session" && e.data.channel === channel) {
      cb(e.data.session);
    }
  };
  bc.addEventListener("message", onMessage);
  return () => bc.removeEventListener("message", onMessage);
}

/**
 * 다른 탭에서 세션 주인이 회원으로 바뀌었을 때, 이 탭에 남은 구 게스트 티켓을 버린다.
 *
 * 그 티켓으로 스트림을 열면 AI 가 403 으로 막으므로, 캐시를 비워 다음 전송의
 * ensureSession 이 회원 신원으로 재발급받게 한다 — 전송을 막는 대신 자연스럽게
 * 넘어가는 쪽이다(§16.2 Agency: 실패하지도 않은 흐름을 끊지 않는다).
 *
 * 무조건 비우지 않는 이유: claim 한 탭이 회원 티켓을 먼저 심으므로(publish),
 * 그냥 지우면 방금 심긴 유효한 티켓까지 날려 재발급이 한 번 더 난다.
 * 캐시에 든 세션이 승계된 그 세션이면 이미 회원 티켓이므로 그대로 둔다.
 */
export function subscribeOwnershipChange(channel: ChatChannel): () => void {
  if (!bc) return () => {};
  const onMessage = (e: MessageEvent<SessionBroadcast>) => {
    if (e.data?.type !== "ownership" || e.data.channel !== channel) return;
    const cached = readCache(channel);
    // 캐시가 없거나(이미 만료) 승계된 세션의 회원 티켓이면 건드릴 게 없다.
    if (!cached || cached.sessionId === e.data.sessionId) return;
    clearCachedSession(channel);
  };
  bc.addEventListener("message", onMessage);
  return () => bc.removeEventListener("message", onMessage);
}

/**
 * 발급 구간 상호배제. navigator.locks 가 있으면 그걸 쓰고,
 * 없으면 '짧게 대기 후 캐시 재확인'으로 저하한다(§5).
 *
 * degrade 경로에서 이중 발급이 나가면 BE 축출 → 404 가 재발하므로,
 * 대기 중 다른 탭의 브로드캐스트가 도착했는지 반드시 재확인한다.
 */
async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(name, { mode: "exclusive" }, fn) as Promise<T>;
  }
  // degrade: 리더가 먼저 발급해 브로드캐스트할 시간을 준다
  await new Promise((r) => setTimeout(r, ELECTION_WAIT_MS));
  return fn();
}

/** 채널별 세션 발급 엔드포인트 — SELLER 는 입구가 다르다(brandId 를 서버가 도출). */
function createSession(channel: ChatChannel): Promise<ChatSession> {
  return channel === "SELLER" ? openSellerSession() : openChatSession(channel);
}

/**
 * 유효한 세션을 확보한다 — CH-1/CH-6 의 유일한 호출 지점.
 *
 * 캐시가 신선하면 그대로 쓰고, 아니면 락 안에서 재발급한다.
 * 락 진입 후 캐시를 다시 확인하는 게 핵심이다(thundering herd 방지):
 * 여러 탭이 동시에 락을 기다렸다가 순서대로 들어와 각자 발급하면
 * 락을 쓴 의미가 없다.
 */
export async function ensureSession(
  channel: ChatChannel,
  /** 알고 있는 기존 sessionId — 있으면 세션·맥락을 유지한 채 티켓만 재발급한다. */
  knownSessionId?: string | null,
  /**
   * 세션이 없을 때 새로 만들지 여부(기본 true).
   *
   * false 면 새 세션을 만드는 대신 SessionClaimPendingError 를 던진다.
   * 승계 실패 직후가 그 경우다 — 여기서 조용히 새 세션을 만들면 화면엔 이전 대화가
   * 있는데 AI 는 기억하지 못하는 어긋남이 생긴다. 사용자가 재시도/새 대화를
   * 고르기 전까지는 발급을 막는다.
   */
  allowCreate = true,
): Promise<ChatSession> {
  const cached = readCache(channel);
  if (cached) return cached;

  return withLock(keyFor(channel), async () => {
    const again = readCache(channel);
    if (again) return again; // 락 안에서 재확인 — 대기 중 다른 탭이 발급했을 수 있다

    if (!knownSessionId && !allowCreate) throw new SessionClaimPendingError();

    const session = knownSessionId
      ? await reissueOrCreate(channel, knownSessionId, allowCreate)
      : await createSession(channel);

    publish(channel, session);
    return session;
  });
}

/**
 * 기존 sessionId 로 티켓만 재발급하되, 그 sessionId 가 더는 못 쓰는 상태면 새로 만든다.
 *
 * 두 실패 모두 "이 sessionId 로는 더 못 쓴다"는 뜻이라 새 세션으로 폴백한다.
 * CH-1 이 멱등이라 폴백이 다른 탭을 축출하지 않는다(활성 세션이 있으면 그걸 돌려받는다).
 * - 403 SESSION_FORBIDDEN — 로그인/로그아웃으로 신원이 바뀜(또는 신원 자체가 없음)
 * - 404 SESSION_NOT_FOUND — TTL 10분 만료. 명세 지시가 "CH-1 로 새 세션"이다(맥락은 끊김)
 */
async function reissueOrCreate(
  channel: ChatChannel,
  sessionId: string,
  /** false 면 폴백 대신 SessionClaimPendingError — 승계 실패 미해결 상태에서 쓴다. */
  allowCreate = true,
): Promise<ChatSession> {
  try {
    return await reissueTicket(sessionId);
  } catch (err) {
    if (
      isApiCode(err, "SESSION_FORBIDDEN") ||
      isApiCode(err, "SESSION_NOT_FOUND")
    ) {
      // 승계 실패 직후엔 조용히 새 세션을 만들지 않는다 — 맥락이 끊긴 사실을
      // 사용자가 모른 채 대화를 이어가게 되기 때문이다.
      if (!allowCreate) throw new SessionClaimPendingError();
      return createSession(channel);
    }
    throw err;
  }
}

/**
 * 스트림 401(티켓 만료) 후의 재발급 — 발급과 같은 락을 써서 여러 탭이
 * 동시에 갱신하지 않게 한다. 성공하면 다른 탭에도 즉시 전파한다.
 */
export async function refreshTicket(
  channel: ChatChannel,
  sessionId: string,
): Promise<ChatSession> {
  return withLock(keyFor(channel), async () => {
    const session = await reissueTicket(sessionId);
    publish(channel, session);
    return session;
  });
}

/**
 * 게스트 세션을 회원으로 승계한다(CH-7) — 채팅 화면에서 로그인·가입한 직후.
 *
 * 성공하면 회원 신원의 새 티켓이 오므로 캐시를 갈아끼우고 다른 탭에도 전파한다.
 * 구 게스트 티켓을 계속 쓰면 AI 가 403 으로 막는다.
 * 발급과 같은 락을 써서 승계 도중 다른 탭이 세션을 새로 발급하지 않게 한다.
 *
 * 실패는 그대로 던진다 — 호출부가 code 로 분기한다(409 2종의 후속 처리가 다르다).
 */
export async function claimSession(
  channel: ChatChannel,
  sessionId: string,
): Promise<ChatSession> {
  return withLock(keyFor(channel), async () => {
    const session = await claimChatSession(sessionId);
    // 회원 티켓을 먼저 심고(publish) 나서 주인이 바뀐 사실을 알린다.
    // 받는 쪽은 캐시가 이 sessionId 면 회원 티켓으로 보고 그대로 두므로,
    // publish 가 먼저여야 방금 심은 티켓이 살아남는다.
    publish(channel, session);
    bc?.postMessage({
      type: "ownership",
      channel,
      sessionId: session.sessionId,
    } satisfies SessionBroadcast);
    return session;
  });
}

/** ApiError 의 code 를 구조적으로 확인한다(순환 import 회피용 로컬 판정). */
function isApiCode(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === code
  );
}
