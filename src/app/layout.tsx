import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Narvis",
  description: "AI 쇼핑 에이전트 Narvis — 대화로 찾는 쇼핑",
  // 파비콘은 헤더와 같은 로고 마크를 쓴다 — 탭과 헤더가 같은 그림이라야
  // 어느 탭이 이 서비스인지 바로 이어진다.
  // 32/180 두 벌: 탭용과 iOS 홈화면 추가용으로 요구 크기가 다르다.
  icons: {
    icon: "/icon-32.png",
    apple: "/icon-180.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 폰트는 globals.css에서 로드한다(Pretendard CDN + @fontsource Geist) — 원본과 동일.
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
