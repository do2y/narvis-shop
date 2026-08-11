"use client";

import { useAuthStore } from "@/shared/stores/authStore";

export function ProfileHeader() {
  const user = useAuthStore((s) => s.user);
  const nickname = user?.nickname ?? "회원";
  const initial = nickname.charAt(0);

  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/28 px-3.5 py-3 sm:gap-3.5 sm:rounded-sm sm:bg-muted/40 sm:px-4 sm:py-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground sm:size-11 sm:text-lg">
        {initial}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold leading-tight tracking-tight">
          {nickname}
        </span>
        {/* 복원 전에는 user 가 null 이라 자리만 비운다 — 임의 값을 넣으면
            남의 계정으로 로그인한 것처럼 보인다(실제로 고정 이메일이 박혀 있었다). */}
        {user?.email && (
          <span className="truncate text-[13px] leading-tight text-muted-foreground">
            {user.email}
          </span>
        )}
      </div>
    </div>
  );
}
