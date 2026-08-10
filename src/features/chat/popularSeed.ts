/**
 * 우측 상품 패널을 인기상품으로 채울 시점인지 판정한다.
 *
 * 패널이 비는 경우가 실제로 여럿이라(첫 진입 / "새 대화" / 추천 없는 턴 종료)
 * 조건을 컴포넌트 안에 두면 어느 경로가 막혔는지 확인할 수 없어 분리했다.
 *
 * 스트리밍 중에 채우지 않는 이유: 결과 대기 스켈레톤이 인기상품으로 덮이고,
 * 곧 도착할 추천이 그걸 다시 덮어 화면이 두 번 튄다. 대신 스트림이 끝난 뒤
 * 다시 판정하면 "추천이 없던 턴"만 걸러져 인기상품이 채워진다.
 */
export function shouldSeedPopular(params: {
  hasResults: boolean;
  isStreaming: boolean;
  popularCount: number;
}): boolean {
  const { hasResults, isStreaming, popularCount } = params;
  return !hasResults && !isStreaming && popularCount > 0;
}
