import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { resolveMetadataBase, sharedOpenGraph, sharedTwitter } from "./shared-metadata";

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),

  title: "Narvis",
  description: "AI 쇼핑 에이전트 Narvis — 대화로 찾는 쇼핑",

  icons: {
    icon: "/icon-32.png",
    apple: "/icon-180.png",
  },

  openGraph: {
    ...sharedOpenGraph,
    title: "Narvis | 대화로 찾는 AI 쇼핑",
    description: "AI 쇼핑 에이전트 Narvis — 대화로 찾는 쇼핑",
  },

  twitter: {
    ...sharedTwitter,
    title: "Narvis | 대화로 찾는 AI 쇼핑",
    description: "AI 쇼핑 에이전트 Narvis — 대화로 찾는 쇼핑",
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
