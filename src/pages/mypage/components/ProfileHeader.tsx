import { useAuthStore } from "@/shared/stores/authStore";

// 마이페이지 상단 프로필 요약 — 아바타(닉네임 첫 글자) + 이름 + 이메일·가입일
// 이메일/가입일은 authStore에 없어 목값으로 표시. 계약 후 회원 정보 API로 대체.
export function ProfileHeader() {
  const user = useAuthStore((s) => s.user);
  const nickname = user?.nickname ?? "회원";
  const initial = nickname.charAt(0);

  return (
    <section className="flex items-center justify-between gap-4 border-b pb-8">
      <div className="flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground sm:size-16">
          {initial}
        </span>
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-bold sm:text-2xl">{nickname}</h1>
          <p className="text-sm text-muted-foreground">
            soy@jarvis.ai · 2024.08 가입
          </p>
        </div>
      </div>
      {/* 계정 설정: 닉네임/비번 변경 없음(features.md) → 준비 중 진입점만 */}
      <button
        type="button"
        className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
      >
        계정 설정
      </button>
    </section>
  );
}
