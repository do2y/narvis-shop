import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 컨테이너 이미지에 필요한 파일만 담는다(node_modules 전체 설치 불필요).
  // .next/standalone에 server.js가 생성되며, public·.next/static은 자동 복사되지
  // 않으므로 Dockerfile에서 직접 넣는다.
  output: "standalone",

  // 보안 헤더 — nginx.conf에서 이관.
  // nginx는 앞단에 그대로 있지만(층2 LB·/internal 프록시), 헤더는 여기서만 붙인다.
  // 양쪽에서 붙이면 응답에 중복으로 실리고, 로컬(nginx 없음)에서도 동일하게 적용된다.
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
