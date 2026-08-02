import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("올바른 이메일 형식이 아닙니다").min(1, "이메일을 입력해주세요"),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});

export type LoginValues = z.infer<typeof loginSchema>;

// 규칙은 서버(A-1)와 일치시킨다 — 프론트가 더 좁으면 서버가 받아주는 값을 부당하게 막고,
// 더 넓으면 통과시킨 뒤 서버 400 으로 튕긴다.
// 성별·생년월일 포함 전 필드 필수 (시안 기준). 약관 동의는 가입 조건이며 API 전송값은 아님.
export const signupSchema = z
  .object({
    email: z.email("올바른 이메일 형식이 아닙니다").min(1, "이메일을 입력해주세요"),
    // 서버는 1~50자. 중복도 허용된다(식별자는 이메일).
    nickname: z
      .string()
      .min(1, "닉네임을 입력해주세요")
      .max(50, "닉네임은 50자 이하여야 합니다"),
    gender: z.enum(["MALE", "FEMALE"], { message: "성별을 선택해주세요" }),
    // 서버는 과거만 허용한다 — 오늘 날짜는 400 이다.
    birthDate: z
      .string()
      .min(1, "생년월일을 입력해주세요")
      .refine((v) => {
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return false;
        // 오늘 0시를 기준으로 비교한다 — 입력값은 시각이 없어 0시로 파싱되므로
        // new Date()(현재 시각)와 비교하면 오늘 날짜가 통과해 버린다.
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return d < today;
      }, "올바른 생년월일이 아닙니다"),
    // 서버는 8자 이상(상한 없음). 영문·숫자 조합은 프론트 정책으로 유지한다.
    password: z
      .string()
      .min(8, "비밀번호는 8자 이상이어야 합니다")
      .regex(/[A-Za-z]/, "영문을 포함해야 합니다")
      .regex(/[0-9]/, "숫자를 포함해야 합니다"),
    passwordConfirm: z.string(),
    // boolean으로 받고 refine으로 true 강제 — false 기본값 허용(체크 전 상태) 위해 literal(true) 대신 사용
    agreeTerms: z.boolean().refine((v) => v, "이용약관에 동의해주세요"),
    agreePrivacy: z
      .boolean()
      .refine((v) => v, "개인정보처리방침에 동의해주세요"),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "비밀번호가 일치하지 않습니다",
  });

export type SignupValues = z.infer<typeof signupSchema>;
