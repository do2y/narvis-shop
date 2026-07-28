import AuthPage from "@/features/auth";

// Suspense 불필요 — AuthPage는 useSearchParams를 쓰지 않는다(returnUrl은 제출 시점에 읽음).
export default function Page() {
  return <AuthPage />;
}
