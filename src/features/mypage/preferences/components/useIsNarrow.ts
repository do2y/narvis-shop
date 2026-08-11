"use client";

import { useEffect, useState } from "react";

/**
 * 데스크톱 방사형 대신 모바일 축약 그래프로 바꿔야 하는 폭.
 *
 * CSS로 두 뷰를 겹쳐 숨기지 않고 상태로 판정하는 이유: 데스크톱 SVG는 좌표 계산이
 * 있고, 모바일 축약 그래프는 DOM 구조가 전혀 다르다. 좁은 화면에선 모바일 전용
 * 컴포넌트만 그린다.
 */
const GRAPH_MIN_WIDTH = 768;

/**
 * 데스크톱 방사형 대신 모바일 축약 그래프를 써야 하는가.
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
