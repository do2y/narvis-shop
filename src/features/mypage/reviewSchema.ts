import { z } from "zod";

// 후기 작성 폼 검증 — 백엔드 계약과 일치(rating 1~5 정수, content 최대 2000자).
//
// 내용은 선택이다: 별점만으로도 등록할 수 있다. 최소 글자수를 강제하면
// "좋아요" 한마디면 충분한 사람에게 억지로 글자를 채우게 만들고, 그렇게 채운
// 문장은 다른 구매자에게 도움이 되지 않는다. 별점만 남기는 것도 유효한 평가다.
//
// 최대 2000자는 남긴다 — 백엔드 계약이라 지우면 다 쓴 뒤 서버에서 거부된다.
export const reviewSchema = z.object({
  rating: z
    .number()
    .int()
    .min(1, "별점을 선택해주세요.")
    .max(5),
  content: z
    .string()
    .trim()
    .max(2000, "후기는 2000자까지 입력할 수 있어요."),
});

export type ReviewValues = z.infer<typeof reviewSchema>;
