import type { Address } from "./types";

// 배송지 목 — 회원 배송지 API 계약 확정 전까지 사용.
export const PLACEHOLDER_ADDRESSES: Address[] = [
  {
    id: "home",
    label: "집",
    recipient: "김소이",
    phone: "010-1234-5678",
    address: "서울특별시 강남구 역삼동 테헤란로 123 101동 302호",
    isDefault: true,
  },
  {
    id: "office",
    label: "회사",
    recipient: "김소이",
    phone: "010-1234-5678",
    address: "서울특별시 성동구 왕십리로 50 센터포인트빌딩 8층",
  },
];

// 결제 수단 선택지.
export const PAYMENT_METHODS = [
  "신용 · 체크카드",
  "카카오페이",
  "네이버페이",
  "토스페이",
  "무통장 입금",
] as const;

// 모의 결제 실패 재현용 카드번호. 실제 PG 미연동이라 이 카드로만 실패를 재현한다.
// (PG 테스트 샌드박스의 "실패 카드" 관례를 따름.) 계약 후 실제 승인 응답으로 대체.
export const MOCK_FAIL_CARD = "4111 1111 1111 0000";
