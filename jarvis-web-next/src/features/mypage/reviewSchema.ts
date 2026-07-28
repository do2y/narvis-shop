import { z } from "zod";

// 후기 작성 폼 검증 — 백엔드 계약과 일치(rating 1~5 정수, content 최대 2000자).
// 최소 10자는 프론트 정책(내용 없는 후기 방지)이라 백엔드보다 엄격하다.
export const reviewSchema = z.object({
  rating: z
    .number()
    .int()
    .min(1, "별점을 선택해주세요.")
    .max(5),
  content: z
    .string()
    .trim()
    .min(10, "후기를 10자 이상 입력해주세요.")
    .max(2000, "후기는 2000자까지 입력할 수 있어요."),
});

export type ReviewValues = z.infer<typeof reviewSchema>;
