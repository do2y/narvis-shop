import { useEffect, useState } from "react";

interface Options {
  /** 롤링 간격(ms). 기본 3000 */
  intervalMs?: number;
  /** true면 롤링 멈춤 (포커스·입력 중 등) */
  paused?: boolean;
}

// 무한 루프 슬라이드용 인덱스 훅.
// index는 0..count 까지 raw로 증가한다(count = "첫 항목 복제" 위치).
// index === count 슬라이드가 끝나면 onSlideEnd()를 호출해 transition 없이 0으로 되돌린다.
// animate 플래그로 리셋 순간에만 transition을 꺼 역주행을 숨긴다.
export function useRotatingIndex(
  count: number,
  { intervalMs = 3000, paused = false }: Options = {},
) {
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    if (paused || count <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i >= count ? i : i + 1));
    }, intervalMs);
    return () => clearInterval(id);
  }, [paused, intervalMs, count]);

  // 복제 항목까지 슬라이드가 끝난 시점에 호출 → transition 끄고 0으로 순간이동,
  // 다음 프레임에 transition 복구
  const onSlideEnd = () => {
    if (index !== count) return;
    setAnimate(false);
    setIndex(0);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimate(true));
    });
  };

  return { index, animate, onSlideEnd };
}
