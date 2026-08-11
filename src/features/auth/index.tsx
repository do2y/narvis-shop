"use client";

import { usePathname, useRouter } from "next/navigation";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";
import { AppHeader } from "@/shared/ui/AppHeader";
import { LoginForm } from "./components/LoginForm";
import { SignupForm } from "./components/SignupForm";

type AuthTab = "login" | "signup";

export default function AuthPage() {
  const pathname = usePathname();
  const router = useRouter();

  // 경로(/login·/signup)로 초기 탭 결정, 탭 전환 시 URL도 동기화(뒤로가기·공유 대응)
  const tab: AuthTab = pathname === "/signup" ? "signup" : "login";
  const setTab = (next: string) => {
    const path = next === "signup" ? "/signup" : "/login";
    if (path !== pathname) {
      // returnUrl 등 쿼리를 유지한 채 경로만 바꾼다(원본 search 승계와 동일).
      // useSearchParams를 쓰지 않는 이유: 그 훅은 이 컴포넌트를 Suspense 경계에
      // 묶어 SSR에서 화면 전체가 비워진다. 여기서는 클릭 시점 값만 필요하므로
      // 렌더와 무관한 window에서 직접 읽는다(이 함수는 클라이언트에서만 실행됨).
      const qs = window.location.search;
      router.push(`${path}${qs}`);
    }
  };

  return (
    <div className="min-h-screen bg-muted/40">
      {/* 로그인/회원가입 화면엔 우측 로그인·시작하기 메뉴 숨김 (이미 이 화면에 폼이 있어 중복) */}
      <AppHeader showMenu={false} />

      <main className="flex min-h-[calc(100vh-4rem)] items-start justify-center px-4 pt-8 pb-10 sm:items-center sm:pt-12 sm:pb-24">
        <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-sm sm:p-8">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-18 w-full">
              <TabsTrigger value="login">로그인</TabsTrigger>
              <TabsTrigger value="signup">회원가입</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="pt-8">
              <LoginForm onSwitchToSignup={() => setTab("signup")} />
            </TabsContent>

            <TabsContent value="signup" className="pt-8">
              <SignupForm onSwitchToLogin={() => setTab("login")} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
