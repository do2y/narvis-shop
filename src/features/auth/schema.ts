import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("올바른 이메일 형식이 아닙니다").min(1, "이메일을 입력해주세요"),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});

export type LoginValues = z.infer<typeof loginSchema>;

// 비밀번호 규칙은 백엔드 정책과 일치시킬 것.
// 성별·생년월일 포함 전 필드 필수 (시안 기준). 약관 동의는 가입 조건이며 API 전송값은 아님.
export const signupSchema = z
  .object({
    email: z.email("올바른 이메일 형식이 아닙니다").min(1, "이메일을 입력해주세요"),
    nickname: z
      .string()
      .min(2, "닉네임은 2자 이상이어야 합니다")
      .max(20, "닉네임은 20자 이하여야 합니다"),
    gender: z.enum(["MALE", "FEMALE"], { message: "성별을 선택해주세요" }),
    birthDate: z
      .string()
      .min(1, "생년월일을 입력해주세요")
      .refine((v) => {
        const d = new Date(v);
        return !Number.isNaN(d.getTime()) && d <= new Date();
      }, "올바른 생년월일이 아닙니다"),
    // 백엔드 정책과 일치: 8~64자, 영문·숫자 각 1자 이상 포함
    password: z
      .string()
      .min(8, "비밀번호는 8자 이상이어야 합니다")
      .max(64, "비밀번호는 64자 이하여야 합니다")
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
