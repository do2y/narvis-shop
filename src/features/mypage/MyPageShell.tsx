"use client";

import { AppHeader } from "@/shared/ui/AppHeader";
import { ProfileHeader } from "./components/ProfileHeader";
import { MyPageNav } from "./components/MyPageNav";

/**
 * 마이페이지 공통 껍데기 — 원본 `pages/mypage/index.tsx`의 레이아웃 부분.
 * 원본은 이 안에 <Routes>로 하위 화면을 그렸지만, App Router에서는
 * `app/mypage/layout.tsx`가 이 껍데기를 두르고 각 폴더의 page.tsx가 children이 된다.
 */
export function MyPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 pb-20 pt-6 sm:px-6 sm:pb-28 sm:pt-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-12">
          <div className="flex flex-col gap-2.5 lg:w-56 lg:shrink-0 lg:gap-3">
            <div className="px-4 sm:px-0">
              <ProfileHeader />
            </div>
            <MyPageNav />
          </div>
          <div className="min-w-0 flex-1 px-4 sm:px-0">{children}</div>
        </div>
      </main>
    </div>
  );
}
