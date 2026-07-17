import { z } from "zod";

// 반품 신청 폼 — 사유(select) + 상세 설명(선택).
// 사유 목록은 신청 종류(claimType)에 따라 UI에서 주입하되, 값 자체는 자유 문자열.
export const claimRequestSchema = z.object({
  productId: z.coerce
    .number({ error: "신청할 상품을 선택해주세요." })
    .int()
    .positive("신청할 상품을 선택해주세요."),
  reason: z.string().trim().min(1, "사유를 선택해주세요."),
  detail: z
    .string()
    .trim()
    .max(300, "상세 설명은 300자 이하여야 합니다.")
    .optional(),
});

// 입력(폼 필드는 문자열) vs 출력(coerce 후 productId: number)을 구분.
// RHF는 입력 타입으로, mutate 페이로드는 출력 타입으로 다룬다.
export type ClaimRequestFormInput = z.input<typeof claimRequestSchema>;
export type ClaimRequestFormValues = z.output<typeof claimRequestSchema>;
