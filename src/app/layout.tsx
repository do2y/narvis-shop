import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),

  title: "Narvis",
  description: "AI 쇼핑 에이전트 Narvis — 대화로 찾는 쇼핑",

  icons: {
    icon: "/icon-32.png",
    apple: "/icon-180.png",
  },

  openGraph: {
    title: "Narvis | 대화로 찾는 AI 쇼핑",
    description: "AI 쇼핑 에이전트 Narvis — 대화로 찾는 쇼핑",
    url: "/",
    siteName: "Narvis",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Narvis AI 쇼핑 에이전트",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Narvis | 대화로 찾는 AI 쇼핑",
    description: "AI 쇼핑 에이전트 Narvis — 대화로 찾는 쇼핑",
    images: ["/og-image.png"],
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
