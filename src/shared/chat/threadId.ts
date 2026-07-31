"use client";

import type { ChatChannel } from "@/shared/types/chat";

/**
 * thread_id — 대화 방(탭) 식별자.
 *
 * session_id 는 탭 간 공유되므로(sessionCoordinator) 방 구분은 이쪽이 맡는다.
 * 보관도 localStorage 가 아니라 sessionStorage(탭 단위)다 — 탭마다 고유해야
 * 여러 탭이 각자 독립 대화를 한다.
 *
 * 스토어에 두지 않는 이유: reset()(새 대화)이 initial 을 통째로 뿌려서 방 id 를
 * 지켜낼 수 없다. "새 대화"는 방을 새로 만드는 것이지 방 개념을 잃는 게 아니다.
 */

const keyFor = (channel: ChatChannel) => `jarvis:chat:thread:${channel}`;

/**
 * sessionStorage 도 private mode 에서 던질 수 있다. 실패하면 메모리 폴백을 쓴다 —
 * 새로고침 시 방이 바뀌지만 대화 자체는 성립한다(스토어도 어차피 persist 안 함).
 */
const memoryFallback = new Map<ChatChannel, string>();

function read(channel: ChatChannel): string | null {
  try {
    return sessionStorage.getItem(keyFor(channel));
  } catch {
    return memoryFallback.get(channel) ?? null;
  }
}

function write(channel: ChatChannel, id: string): void {
  try {
    sessionStorage.setItem(keyFor(channel), id);
  } catch {
    memoryFallback.set(channel, id);
  }
}

/** 이 탭의 현재 방 id — 없으면 1회 생성해 고정한다. */
export function getThreadId(channel: ChatChannel): string {
  const existing = read(channel);
  if (existing) return existing;
  const id = crypto.randomUUID();
  write(channel, id);
  return id;
}

/** "새 대화" — 방만 새로 판다. 세션은 그대로 유지된다(CH-1 호출 없음). */
export function newThreadId(channel: ChatChannel): string {
  const id = crypto.randomUUID();
  write(channel, id);
  return id;
}
