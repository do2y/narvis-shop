import { z } from "zod";

// 배송지 입력 폼 — 백엔드 /api/addresses(M-8b·M-8c) 필드·길이 규칙과 일치.
// address2(상세주소)만 선택, 나머지는 필수.
//
// 길이 상한은 서버 값을 그대로 쓴다 — 상한이 없으면 초과 입력이 그대로 나가 서버 400 이 되고,
// 사용자는 어느 칸이 문제인지 모른 채 저장에 실패한다.
// phone·zipCode 의 형식 검사는 명세가 프론트에 맡긴 부분이라 현행 정규식을 유지한다.
export const addressSchema = z.object({
  label: z
    .string()
    .min(1, "배송지명을 입력해주세요")
    .max(50, "배송지명은 50자 이하여야 합니다"),
  recipient: z
    .string()
    .min(1, "받는 분을 입력해주세요")
    .max(50, "받는 분은 50자 이하여야 합니다"),
  phone: z
    .string()
    .min(1, "연락처를 입력해주세요")
    .regex(/^01[0-9]-?\d{3,4}-?\d{4}$/, "올바른 휴대폰 번호가 아닙니다"),
  zipCode: z
    .string()
    .min(1, "우편번호를 입력해주세요")
    .regex(/^\d{5}$/, "우편번호는 5자리 숫자예요"),
  address1: z
    .string()
    .min(1, "주소를 입력해주세요")
    .max(255, "주소는 255자 이하여야 합니다"),
  address2: z
    .string()
    .max(255, "상세주소는 255자 이하여야 합니다")
    .optional(),
});

export type AddressValues = z.infer<typeof addressSchema>;
