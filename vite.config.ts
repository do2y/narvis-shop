import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// .env* 값은 process.env에 자동 주입되지 않으므로(import.meta.env는 클라이언트 전용)
// config에서 쓰려면 loadEnv로 직접 읽어야 한다
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), tailwindcss()],
    // 백엔드 CORS가 http://localhost:3000만 허용하므로 dev 서버 포트를 3000으로 고정
    server: {
      port: 3000,
      strictPort: true,
      proxy: {
        "/api": {
          target: env.VITE_API_PROXY_TARGET || "http://localhost:8080",
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
