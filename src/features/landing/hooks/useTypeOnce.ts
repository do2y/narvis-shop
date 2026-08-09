"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * 주어진 문장을 한 번만 타이핑한다(지우지 않는다).
 *
 * `home/hooks/useTypingText`를 쓰지 않는 이유: 그쪽은 여러 문장을 **입력→삭제→다음**
 * 으로 순환시키는 placeholder 전용이다. 데모의 질문은 한 문장이 끝까지 남아 있어야
 * 다음 장면(조건 분석·추천)과 인과가 이어진다 — 지워지면 "무엇에 대한 답인지"가 사라진다.
 *
 * 글자 단위는 코드 포인트로 센다(`[...text]`). 한글은 BMP 안이라 `.length`로도 맞지만,
 * 이모지가 섞이면 서로게이트 쌍이 반쪽만 잘려 깨진 글자가 한 프레임 보인다.
 * ref가 아니라 useMemo로 두는 이유: 렌더 중 ref를 쓰면 컴파일러가 순수성을 보장할 수
 * 없다(react-hooks 규칙). 이 값은 text에서만 나오는 파생값이라 memo가 정확한 도구다.
 */
export function useTypeOnce(
  text: string,
  options?: { charMs?: number; startDelayMs?: number; enabled?: boolean },
) {
  const { charMs = 45, startDelayMs = 220, enabled = true } = options ?? {};

  const chars = useMemo(() => [...text], [text]);
  const total = chars.length;

  /**
   * 진행 글자 수.
   *
   * 문장이나 재생 여부가 바뀌면 처음부터 다시 쳐야 하는데, 그걸 이펙트의
   * setState로 되돌리면 한 프레임 동안 이전 문장의 잔상이 남는다(그리고 컴파일러가
   * 연쇄 렌더로 경고한다). 대신 **렌더 중에 키를 비교해 즉시 리셋한다** —
   * React가 공식적으로 권하는 "props 변화에 따라 state 조정하기" 패턴이다.
   */
  const resetKey = `${text}|${enabled}`;
  const [state, setState] = useState({ key: resetKey, count: 0 });
  const count = state.key === resetKey ? state.count : 0;
  if (state.key !== resetKey) {
    // 렌더 중 setState — 같은 컴포넌트의 즉시 재렌더라 DOM에 잔상이 남지 않는다
    setState({ key: resetKey, count: 0 });
  }

  useEffect(() => {
    if (!enabled) return;
    if (count >= total) return;

    // 첫 글자만 살짝 늦춘다 — 장면이 바뀌자마자 글자가 쏟아지면
    // 사용자가 "누가 무엇을 묻는지" 인지하기 전에 문장이 끝난다.
    const delay = count === 0 ? startDelayMs : charMs;
    const timer = window.setTimeout(
      () =>
        setState((s) =>
          // 타이머가 걸린 뒤 문장이 바뀌었으면 그 결과를 버린다 —
          // 안 그러면 새 문장의 진행 수에 옛 증가분이 더해진다
          s.key === resetKey ? { key: s.key, count: s.count + 1 } : s,
        ),
      delay,
    );
    return () => window.clearTimeout(timer);
  }, [count, total, enabled, charMs, startDelayMs, resetKey]);

  return {
    text: chars.slice(0, enabled ? count : total).join(""),
    done: !enabled || count >= total,
  };
}
