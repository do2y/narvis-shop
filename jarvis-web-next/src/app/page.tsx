import { AppHeader } from "@/shared/ui/AppHeader";

// 1단계 게이트용 임시 화면 — 헤더 렌더·세션 복원 확인만 한다.
// 실제 홈은 3단계에서 원본 src/pages/home을 SSR로 이식하며 대체한다.
export default function Page() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">
          1단계 셋업 확인 화면
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          공통 계층 이식 검증용입니다. 헤더가 보이고, 로그인 후 새로고침해도 로그인
          상태가 유지되면 통과입니다.
        </p>
      </main>
    </>
  );
}
