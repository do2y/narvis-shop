"use client";

import { useEffect, useState } from "react";

/**
 * 방사형이 성립하지 않는 폭. 라벨이 겹쳐 아무것도 안 읽힌다.
 *
 * CSS로 숨기지 않고 상태로 판정하는 이유: SVG를 그려놓고 display:none 하면
 * 좌표 계산만 낭비된다. 좁은 화면에서는 아예 그리지 않는다.
 */
const GRAPH_MIN_WIDTH = 768;

/**
 * 그래프를 그릴 수 없을 만큼 좁은 화면인가.
 *
 * 원래 `ViewToggle.tsx`에 있던 훅이다. 그래프 ⇄ 목록 전환 컨트롤을 없애면서
 * (둘이 한 화면에 함께 있으므로 전환할 것이 없다) 그 파일에서 쓰이는 것이
 * 이 훅뿐이 되어 옮겼다.
 */
export function useIsNarrow(): boolean {
  // SSR·첫 페인트에서는 false로 시작한다. 이 화면은 클라이언트 렌더라
  // 하이드레이션 불일치가 없고, 첫 프레임에 잘못된 뷰가 잠깐 보이지도 않는다
  // (데이터 로딩 중이라 스켈레톤이 떠 있다).
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${GRAPH_MIN_WIDTH - 1}px)`);
    const sync = () => setIsNarrow(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return isNarrow;
}
