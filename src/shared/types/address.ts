// 배송지 — 백엔드 /api/addresses 계약과 1:1 (M-8).
// 결제(주문서)와 마이페이지(배송지 관리)가 함께 쓰므로 shared에 둔다.
export interface Address {
  addressId: number;
  label: string; // "집", "회사" 등 표시명
  recipient: string;
  phone: string;
  zipCode: string;
  address1: string; // 도로명 기본주소
  address2?: string | null; // 상세주소 — 선택. 미입력 시 서버가 null 또는 ""로 저장
  isDefault?: boolean;
}

// 배송지 추가 입력. addressId는 서버 발급.
// isDefault: true로 보내면 기존 기본 배송지는 서버가 같은 트랜잭션에서 해제한다.
export type AddressInput = Omit<Address, "addressId" | "isDefault"> & {
  isDefault?: boolean;
};

// 배송지 수정 입력 — PATCH라 수정할 필드만 부분 전송한다.
// 기본 배송지 지정도 이 API로: { isDefault: true }
export type AddressPatch = Partial<AddressInput>;
