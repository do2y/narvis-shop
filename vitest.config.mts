import { defineConfig } from "vitest/config";

/**
 * 유닛 테스트 설정 (Next 공식 가이드: docs/01-app/02-guides/testing/vitest.md).
 *
 * 이 앱은 Turbopack 으로 빌드하지만 Vitest 는 실행 시점에만 자체 변환기를 쓰므로
 * 빌드 파이프라인과 무관하다.
 *
 * .mts 확장자인 이유: 이 프로젝트는 package.json 에 type:module 이 없어
 * .ts 설정 파일이 CommonJS 로 로드돼 경고가 난다.
 *
 * @vitejs/plugin-react 는 넣지 않았다 — babel 8 을 요구해 기존 의존성과 충돌하고,
 * 지금 테스트 대상이 전부 순수 모듈이라 JSX 변환이 필요 없다.
 * 컴포넌트 렌더 테스트가 필요해지면 그때 플러그인과 @testing-library/react 를 함께 도입한다.
 */
export default defineConfig({
  resolve: {
    // tsconfig 의 @/* 별칭을 그대로 쓴다(Vite 내장 — 별도 플러그인 불필요)
    tsconfigPaths: true,
  },
  test: {
    // localStorage·sessionStorage·window 이벤트를 쓰는 모듈이 대상이라 DOM 환경이 필요하다
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    // 테스트 간 mock 이 새는 것을 막는다
    restoreMocks: true,
  },
});
