"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "./useReducedMotion";

/**
 * 문서 표시 여부 구독 — 탭이 백그라운드면 데모를 쉬게 한다.
 *
 * 보이지 않는 화면에서 타이머가 도는 것은 배터리 낭비고, 돌아왔을 때 장면이
 * 엉뚱한 데 가 있다. `useSyncExternalStore`를 쓰는 이유는 `useReducedMotion`과
 * 같다 — 브라우저가 소유한 상태라 이펙트로 복제하면 첫 프레임이 어긋난다.
 */
function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function getVisibilitySnapshot(): boolean {
  return document.hidden;
}

function getVisibilityServerSnapshot(): boolean {
  return false;
}

/**
 * 자동 데모 시퀀서 — 장면을 0..n 단계로 진행시킨다.
 *
 * 두 랜딩 데모(구매자 대화, 판매자 분석)가 같은 규칙으로 돌아야 해서 한 곳에 둔다.
 *
 * ## 왜 setInterval이 아니라 재귀 setTimeout인가
 * 단계마다 필요한 체류 시간이 다르다 — 타이핑 중인 줄은 길게, 칩 하나 붙는 건 짧게.
 * 고정 간격이면 긴 문장을 읽기 전에 넘어가거나 짧은 장면에서 화면이 멈춘 것처럼 보인다.
 * `steps[i]`가 "그 장면을 얼마나 붙들지"를 직접 들고 있게 한다.
 *
 * ## 반복은 왜 "처음으로 튀지" 않는가
 * 마지막 장면 뒤에 `loopDelayMs`를 두고, 되감을 때 한 프레임 동안 `resetting`을
 * 켜서 컨테이너를 통째로 페이드아웃한다. 이게 없으면 완성된 화면(카드 4장·리포트)이
 * 갑자기 빈 화면으로 잘려 깜빡임으로 읽힌다.
 *
 * ## 모션 감소
 * 타이머를 아예 걸지 않고 **마지막 장면으로 고정**한다. 단계 진행 자체가 움직임이라
 * CSS `motion-reduce:`로는 못 끈다. 완성 상태에는 모든 정보가 들어 있어 정지 화면만
 * 봐도 기능을 이해할 수 있다. state를 바꾸지 않고 **반환값에서 덮어쓴다** —
 * 이펙트로 되돌리면 한 프레임 동안 0단계가 스치고 연쇄 렌더가 생긴다.
 */
export function useDemoSequence(
  /** 각 장면의 체류 시간(ms). 길이가 곧 장면 수다. */
  steps: readonly number[],
  options?: {
    /** 마지막 장면을 붙들 시간 — 결과를 읽을 여유. 기본 2.6초 */
    loopDelayMs?: number;
    /** 외부 정지 신호(예: 아직 화면에 안 들어옴, 사용자가 일시정지) */
    paused?: boolean;
  },
) {
  const { loopDelayMs = 2600, paused = false } = options ?? {};
  const reducedMotion = useReducedMotion();
  const docHidden = useSyncExternalStore(
    subscribeVisibility,
    getVisibilitySnapshot,
    getVisibilityServerSnapshot,
  );

  const lastStep = steps.length - 1;
  const [rawStep, setRawStep] = useState(0);
  /** 되감기 한 프레임 — 컨테이너를 페이드아웃해 "툭 끊김"을 막는다 */
  const [resetting, setResetting] = useState(false);

  const halted = paused || docHidden || reducedMotion;

  // 현재 장면의 체류 시간만 이펙트에 넘긴다. steps 배열은 호출부에서 리터럴로
  // 오는 경우가 많아 매 렌더 새 참조인데, 그대로 의존성에 넣으면 타이머가 매
  // 렌더 재설정돼 장면이 영영 안 넘어간다. 숫자 하나면 그 문제가 없다.
  const currentDelay = steps[rawStep] ?? 900;

  useEffect(() => {
    if (halted) return;

    const isLast = rawStep >= lastStep;
    const delay = isLast ? loopDelayMs : currentDelay;

    const timer = window.setTimeout(() => {
      if (!isLast) {
        setRawStep((s) => s + 1);
        return;
      }
      // 되감기: 페이드아웃 → 다음 프레임에 0단계로. 두 단계로 나눠야
      // 마지막 화면이 사라지는 것과 첫 화면이 나타나는 것이 겹치지 않는다.
      setResetting(true);
      window.setTimeout(() => {
        setRawStep(0);
        setResetting(false);
      }, 420);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [rawStep, lastStep, halted, currentDelay, loopDelayMs]);

  // 모션 감소면 완성 장면으로 고정 — state는 건드리지 않고 읽는 값만 바꾼다
  const step = reducedMotion ? lastStep : rawStep;

  return {
    /** 현재 장면 번호 */
    step,
    /** 되감는 중 — 컨테이너 opacity를 낮추는 데 쓴다 */
    resetting: reducedMotion ? false : resetting,
    reducedMotion,
    /** `step >= n`이면 그 장면까지 진행됨 — 누적 등장에 쓴다 */
    reached: (n: number) => step >= n,
  };
}
