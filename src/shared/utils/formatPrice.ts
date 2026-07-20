// 원화 포맷. cart·home·mypage 3개 페이지가 쓰므로 shared로 승격.
export function formatPrice(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}
