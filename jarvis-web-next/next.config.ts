import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 이 앱은 원본 Vite 레포의 하위 폴더에 있다. 그대로 두면 Next가 상위 lockfile을
  // 보고 워크스페이스 루트를 부모 디렉토리로 추론한다(경고 + 잘못된 파일 추적).
  // 5단계에서 레포를 교체하면 이 설정은 제거한다.
  turbopack: {
    root: path.resolve(__dirname),
  },

  // 보안 헤더 — 원본 nginx.conf에서 이관 (5단계에서 nginx 제거 후 이 설정만 남는다)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
