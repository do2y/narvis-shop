import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Narvis",
  description: "AI 쇼핑 에이전트 Narvis — 대화로 찾는 쇼핑",
  // 파비콘은 로고의 흰 원 배경을 뺀 마크만 쓴다 — 원째로 넣으면 밝은 탭 배경에
  // 흰 원이 묻혀 형태가 안 읽힌다(16px 에서 확인).
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
