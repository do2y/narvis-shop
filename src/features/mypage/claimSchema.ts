import { z } from "zod";

// 반품 신청 폼 — 대상 아이템(orderItemId) + 사유(select) + 상세 설명(선택).
// 대상을 orderItemId로 잡는 이유: 같은 상품을 옵션만 다르게 담은 주문에서
// productId만으로는 어느 주문 줄인지 특정할 수 없다(API도 orderItemId 기준).
export const claimRequestSchema = z.object({
  // 문자열 그대로 다룬다 — orderItemId 는 BIGINT 라 number 로 coerce 하면
  // 끝자리가 조용히 바뀐다(2026-08-06 공통 규약). 폼 값도 원래 문자열이라
  // 변환할 이유가 없었고, 빈 값만 걸러내면 충분하다.
  orderItemId: z
    .string({ error: "신청할 상품을 선택해주세요." })
    .trim()
    .min(1, "신청할 상품을 선택해주세요."),
  reason: z.string().trim().min(1, "사유를 선택해주세요."),
  detail: z
    .string()
    .trim()
    .max(300, "상세 설명은 300자 이하여야 합니다.")
    .optional(),
});

// 입력·출력 모두 문자열이지만 optional/trim 차이가 있어 두 타입을 계속 구분해 둔다.
// RHF는 입력 타입으로, mutate 페이로드는 출력 타입으로 다룬다.
export type ClaimRequestFormInput = z.input<typeof claimRequestSchema>;
export type ClaimRequestFormValues = z.output<typeof claimRequestSchema>;
