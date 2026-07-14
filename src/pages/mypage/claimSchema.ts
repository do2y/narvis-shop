import { z } from "zod";

// 반품·교환 신청 폼 — 사유(select) + 상세 설명(선택).
// 사유 목록은 신청 종류(claimType)에 따라 UI에서 주입하되, 값 자체는 자유 문자열.
export const claimRequestSchema = z.object({
  productId: z.coerce
    .number({ invalid_type_error: "신청할 상품을 선택해주세요." })
    .int()
    .positive("신청할 상품을 선택해주세요."),
  reason: z.string().trim().min(1, "사유를 선택해주세요."),
  detail: z
    .string()
    .trim()
    .max(300, "상세 설명은 300자 이하여야 합니다.")
    .optional(),
});

export type ClaimRequestFormValues = z.infer<typeof claimRequestSchema>;
