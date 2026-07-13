import { z } from "zod";

// 배송지 입력 폼 — 검증 규칙은 배송지 API 계약 확정 후 백엔드 필드와 일치시킬 것.
// 상세주소(detail)는 저장 시 기본주소 뒤에 이어붙여 address 한 필드로 보관.
export const addressSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "배송지명을 입력해주세요.")
    .max(20, "배송지명은 20자 이하여야 합니다."),
  recipient: z.string().trim().min(1, "받는 분을 입력해주세요."),
  phone: z
    .string()
    .trim()
    .regex(/^01[0-9]-?\d{3,4}-?\d{4}$/, "올바른 휴대폰 번호가 아니에요."),
  zipCode: z.string().trim().regex(/^\d{5}$/, "우편번호 5자리를 입력해주세요."),
  address: z.string().trim().min(1, "주소를 입력해주세요."),
  detail: z.string().trim().optional(),
});

export type AddressFormValues = z.infer<typeof addressSchema>;
