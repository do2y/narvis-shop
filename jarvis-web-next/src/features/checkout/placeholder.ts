// 배송지 목은 M-8 연동으로 제거됨(GET /api/addresses 사용).

// 결제 수단 — 실제 PG 미연동(모의 결제).
// MOCK_FAIL은 무조건 실패, 그 외는 무조건 성공(랜덤 실패 없음 — 시연 재현용).
// 실패 흐름을 보여줄 수 있도록 "테스트: 결제 실패"를 선택지로 노출한다.
export const PAYMENT_METHODS = [
  { value: "MOCK_CARD", label: "신용 · 체크카드" },
  { value: "MOCK_FAIL", label: "테스트: 결제 실패" },
] as const;
