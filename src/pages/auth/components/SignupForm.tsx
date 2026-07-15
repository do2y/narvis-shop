import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { signupSchema, type SignupValues } from "../schema";
import { useSignup } from "../useAuthForm";

interface SignupFormProps {
  onSwitchToLogin: () => void;
}

const GENDERS = [
  { value: "M", label: "남성" },
  { value: "F", label: "여성" },
] as const;

export function SignupForm({ onSwitchToLogin }: SignupFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      nickname: "",
      birthDate: "",
      password: "",
      passwordConfirm: "",
      agreeTerms: false,
      agreePrivacy: false,
    },
  });
  const { mutate, isPending, errorMessage } = useSignup();

  const onSubmit = handleSubmit((v) =>
    mutate({
      email: v.email,
      password: v.password,
      nickname: v.nickname,
      gender: v.gender,
      birthDate: v.birthDate,
    }),
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-7" noValidate>
      {/* 이메일 */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="signup-email">이메일</Label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          aria-invalid={!!errors.email}
          className="h-11 rounded-sm"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      {/* 닉네임 */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="signup-nickname">닉네임</Label>
        <Input
          id="signup-nickname"
          autoComplete="nickname"
          placeholder="홈화면에 표시될 이름"
          aria-invalid={!!errors.nickname}
          className="h-11 rounded-sm"
          {...register("nickname")}
        />
        {errors.nickname && (
          <p className="text-sm text-destructive">{errors.nickname.message}</p>
        )}
      </div>

      {/* 성별 */}
      <div className="flex flex-col gap-2">
        <Label>성별</Label>
        <Controller
          control={control}
          name="gender"
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {GENDERS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => field.onChange(g.value)}
                  aria-pressed={field.value === g.value}
                  className={cn(
                    "h-11 rounded-sm border text-sm font-medium transition-colors",
                    field.value === g.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-muted",
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}
        />
        {errors.gender && (
          <p className="text-sm text-destructive">{errors.gender.message}</p>
        )}
      </div>

      {/* 생년월일 */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="signup-birth">생년월일</Label>
        <Input
          id="signup-birth"
          type="date"
          aria-invalid={!!errors.birthDate}
          className="h-11 rounded-sm"
          {...register("birthDate")}
        />
        {errors.birthDate && (
          <p className="text-sm text-destructive">{errors.birthDate.message}</p>
        )}
      </div>

      {/* 비밀번호 (눈 토글 내장) */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="signup-password">비밀번호</Label>
        <div className="relative">
          <Input
            id="signup-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="8자 이상"
            aria-invalid={!!errors.password}
            className="h-11 rounded-sm pr-11"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff className="size-5" />
            ) : (
              <Eye className="size-5" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      {/* 비밀번호 확인 (같은 토글 상태 공유) */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="signup-password-confirm">비밀번호 확인</Label>
        <Input
          id="signup-password-confirm"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="••••••••"
          aria-invalid={!!errors.passwordConfirm}
          className="h-11 rounded-sm"
          {...register("passwordConfirm")}
        />
        {errors.passwordConfirm && (
          <p className="text-sm text-destructive">
            {errors.passwordConfirm.message}
          </p>
        )}
      </div>

      {/* 약관 동의 */}
      <div className="flex flex-col gap-3 border-t pt-4">
        <AgreementRow
          id="agree-terms"
          label="[필수] 이용약관 동의"
          error={errors.agreeTerms?.message}
          {...register("agreeTerms")}
        />
        <AgreementRow
          id="agree-privacy"
          label="[필수] 개인정보처리방침 동의"
          error={errors.agreePrivacy?.message}
          {...register("agreePrivacy")}
        />
      </div>

      {errorMessage && (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="h-12 rounded-full text-base"
      >
        {isPending ? "가입 중…" : "가입하기"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        이미 계정이 있으신가요?{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-semibold text-foreground hover:underline"
        >
          로그인
        </button>
      </p>
    </form>
  );
}

interface AgreementRowProps extends React.ComponentProps<"input"> {
  id: string;
  label: string;
  error?: string;
}

// 약관 링크(보기)는 페이지 미정 → 지금은 표시만. 라우트 확정 시 연결
function AgreementRow({ id, label, error, ...checkbox }: AgreementRowProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="flex items-center gap-2 text-sm">
          <input
            id={id}
            type="checkbox"
            className="size-4 rounded border-input accent-primary"
            {...checkbox}
          />
          {label}
        </label>
        <button
          type="button"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          보기
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}
