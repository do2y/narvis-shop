"use client";

import { openChatSession, openSellerSession, reissueTicket } from "./sessions";
import type { ChatChannel, ChatSession } from "@/shared/types/chat";

/**
 * 챗 세션 조정자 — 세션 발급·재발급을 **탭 전체에서 단일화**한다.
 *
 * 문제: 탭마다 독립적으로 세션을 발급하면 BE 가 이전 접속을 축출해
 * 먼저 열린 탭이 404 SESSION_NOT_FOUND 로 죽는다(멀티탭 버그).
 * 해결: Web Locks 로 발급을 접속당 1회로 강제하고, 결과를 localStorage(부팅 생존)와
 * BroadcastChannel(실시간 전파)로 다른 탭에 나눠준다.
 *
 * 락은 **발급/재발급만** 감싼다. 장시간 SSE 스트림을 감싸면 그동안 다른 탭의
 * 발급이 막혀 교착처럼 보인다.
 */

/** 락·localStorage 키는 채널별로 분리 — SHOPPING 과 SELLER 는 서로 다른 접속이다. */
const keyFor = (channel: ChatChannel) => `jarvis:chat:session:${channel}`;

/**
 * 티켓 TTL(30~60초)보다 짧게 잡아 만료 직전 세션을 재사용하지 않게 한다.
 * 스트림 401 재발급 경로가 있으므로 보수적으로 잡아도 손해가 없다.
 */
const TICKET_TTL_MS = 25_000;

/** degrade 경로에서 리더의 브로드캐스트를 기다리는 시간(§5-3, 이중 발급 회피) */
const ELECTION_WAIT_MS = 300;

interface CachedSession {
  session: ChatSession;
  /** 이 캐시를 쓴 시각(ms). 티켓 신선도 판정용 — 서버 시계가 아니라 로컬 기준이다. */
  storedAt: number;
}

interface SessionBroadcast {
  type: "session";
  channel: ChatChannel;
  session: ChatSession;
}

// BroadcastChannel 미지원(구형 브라우저)이면 null — degrade 경로가 받는다.
const bc: BroadcastChannel | null =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("jarvis:chat")
    : null;

/**
 * localStorage 접근은 private mode 등에서 던질 수 있다. 캐시는 **최적화일 뿐**이고
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
 * 유효한 세션을 확보한다 — **CH-1/CH-6 의 유일한 호출 지점.**
 *
 * 캐시가 신선하면 그대로 쓰고, 아니면 락 안에서 재발급한다.
 * 락 진입 후 캐시를 **다시** 확인하는 게 핵심이다(thundering herd 방지):
 * 여러 탭이 동시에 락을 기다렸다가 순서대로 들어와 각자 발급하면
 * 락을 쓴 의미가 없다.
 */
export async function ensureSession(
  channel: ChatChannel,
  /** 알고 있는 기존 sessionId — 있으면 세션·맥락을 유지한 채 티켓만 재발급한다. */
  knownSessionId?: string | null,
): Promise<ChatSession> {
  const cached = readCache(channel);
  if (cached) return cached;

  return withLock(keyFor(channel), async () => {
    const again = readCache(channel);
    if (again) return again; // ★ 락 안 재확인 — 다른 탭이 방금 발급했다

    const session = knownSessionId
      ? await reissueOrCreate(channel, knownSessionId)
      : await createSession(channel);

    publish(channel, session);
    return session;
  });
}

/**
 * 기존 sessionId 로 티켓만 재발급하되, 그 sessionId 가 더는 못 쓰는 상태면 새로 만든다.
 *
 * 403 SESSION_FORBIDDEN(요청 신원 ≠ 세션 소유자)은 로그인/로그아웃으로 신원이 바뀐
 * 정상 상황이라 새 세션으로 조용히 폴백한다.
 * 404 SESSION_NOT_FOUND 는 **폴백하지 않는다** — 다른 탭/기기가 세션을 축출했다는
 * 뜻이고, 여기서 자동 재발급하면 서로 축출하는 탭 전쟁이 된다. 호출부가 안내 + 수동 재시작으로 처리한다.
 */
async function reissueOrCreate(
  channel: ChatChannel,
  sessionId: string,
): Promise<ChatSession> {
  try {
    return await reissueTicket(sessionId);
  } catch (err) {
    if (isApiCode(err, "SESSION_FORBIDDEN")) {
      return createSession(channel);
    }
    throw err;
  }
}

/**
 * 스트림 401(티켓 만료) 후의 재발급 — 발급과 **같은 락**을 써서 여러 탭이
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
 * "새 대화" 등으로 세션을 명시적으로 새로 만들 때(수동 재시작 포함).
 * 캐시를 비우고 락 안에서 새로 발급한다.
 */
export async function restartSession(channel: ChatChannel): Promise<ChatSession> {
  clearCachedSession(channel);
  return withLock(keyFor(channel), async () => {
    const session = await createSession(channel);
    publish(channel, session);
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
