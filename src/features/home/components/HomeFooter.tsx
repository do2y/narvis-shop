"use client";

export function HomeFooter() {
  return (
    <footer className="border-t px-6 py-10 md:py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 text-sm text-muted-foreground sm:flex-row sm:gap-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-wordmark">Narvis</span>
          <span className="hidden sm:inline">AI Shopping Agent</span>
        </div>

        <p>© 2026 Narvis. All rights reserved.</p>

        <nav className="flex items-center gap-4">
          {/* TODO: 각 정책 페이지 라우트 확정 시 연결 */}
          <button type="button" className="hover:text-foreground">
            서비스 소개
          </button>
          <button type="button" className="hover:text-foreground">
            개인정보처리방침
          </button>
          <button type="button" className="hover:text-foreground">
            이용약관
          </button>
        </nav>
      </div>
    </footer>
  );
}
