# CLAUDE.md — jarvis-web-next (Next.js 이전 작업 중)

## 이 폴더의 정체
- 원본 `../` (Vite CSR 앱)을 Next.js로 **점진 이식**하는 대상. 이식이 끝나면 5단계에서 레포를 교체한다
- **원본 `../src/`는 읽기만 한다. 절대 수정하지 않는다** — 이식 중에도 원본 앱은 계속 배포·동작해야 한다
- 계획·단계·게이트는 `../docs/nextjs-migration.md`가 정본. 작업 전 반드시 읽을 것

## 최우선 원칙 — 1:1 이식, 리팩토링 금지
- 이식 단계의 목표는 **동작 동일성**이다. 옮기면서 구조 개선·이름 변경·"온 김에 정리"를 섞지 않는다
- Next가 강제하는 변경(라우터 API, `'use client'`, 서버/클라이언트 경계)만 허용
- 이유: 개선이 섞이면 원본과의 디프 검증이 불가능해지고, 버그가 났을 때 이식 실수인지 개선 실수인지 못 가린다
- 개선하고 싶은 걸 발견하면 코드가 아니라 메모에 남기고 이식 완료 후 별도로 처리한다

## Next.js 16 (주의: 학습 데이터와 다를 수 있음)
- 이 버전은 breaking change가 있다. **API를 쓰기 전에 `node_modules/next/dist/docs/`의 해당 문서를 읽을 것**
- 이미 확인된 것:
  - `middleware` → **`proxy`로 이름 변경**(deprecated). 이 프로젝트는 애초에 안 쓴다
  - `params`·`searchParams`·`cookies()`·`headers()`는 **전부 async**. 동기 접근 불가
  - Turbopack이 dev·build 기본값
  - `next lint` 제거됨 → `eslint` 직접 실행
  - `next start`는 기본 `compress: true` (dev에는 없음 — 스트리밍 검증은 dev만으로 불충분)

## 명령어
- `npm run dev` — 개발 서버 (**포트 3000 고정** — 백엔드 CORS가 `http://localhost:3000`만 허용)
- `npm run build` — 프로덕션 빌드. **이게 진짜 게이트다** (타입 검사 포함)
- `npm run start` — 프로덕션 서버 (포트 3000)
- `npm run typecheck` / `npm run lint`

## 아키텍처 결정 (바꾸지 말 것 — 배경은 계획서 참조)

### 인증
- **AT는 메모리에만 보관.** localStorage·쿠키에 넣지 않는다. 새로고침 시 RT 쿠키로 복원(`useRestoreSession`)
- **가드를 `proxy.ts`(구 middleware)로 옮기지 않는다** — AT가 메모리에만 있어 서버가 인증 상태를 알 수 없다. 클라이언트 가드 + 백엔드 최종 방어를 유지
- persist된 `user`는 신뢰 경계가 아니다. role 판정은 `/api/auth/me` 응답으로 덮어쓴다
- 인증 필요 쿼리의 `enabled`는 `selectIsAuthReady` 필수 (`user`로 판정하면 새로고침 직후 401)

### /api 프록시
- `src/app/api/[...path]/route.ts`가 **dev·prod 공용** 프록시. `rewrites()`는 쓰지 않는다
  - 이유: Route Handler는 파일시스템 라우트라 rewrites보다 먼저 매칭된다. 둘을 환경별로 나눠 쓸 수 없다
- dev에서만 Set-Cookie의 `Secure` 제거·`SameSite=Lax` 완화 — 로컬 http에서 Secure 쿠키가 저장되지 않아 refresh가 항상 401이 되는 것을 막는다
- 구현 요건: 전 HTTP 메서드 export / 요청 스트림 전달 시 `duplex: 'half'` / `force-dynamic` / **Set-Cookie는 `getSetCookie()`로 복수 처리**(합치면 쿠키가 깨진다) / 응답 body passthrough
- 환경변수 2종: `NEXT_PUBLIC_API_BASE_URL`(브라우저, 빌드 시점 주입) / `API_PROXY_TARGET`(서버가 실제로 때리는 주소)

### 챗봇 SSE
- **이 프록시를 타지 않는다.** 세션 발급(`POST /api/chat/sessions`)으로 받은 `llmSseUrl`(AI 서버 절대 URL)에 `streamChat`이 직접 fetch한다
- 따라서 AI 서버가 이 앱의 오리진에 CORS를 열어줘야 한다
- EventSource 금지(POST+body라서). 자동 재시도 금지(중복 담기 방지)

### 서버 컴포넌트 경계
- `shared/api/client.ts`(axios 인스턴스)는 **클라이언트 전용**이다 — authStore·`window.location`을 참조한다. 서버 컴포넌트에서 import하지 말 것
- SSR용 데이터 조회는 별도의 서버 fetch 헬퍼를 쓴다(2단계에서 추가 예정)

## 이식 치환 규칙 (계획서 3장 스니펫과 동일하게)
- `useNavigate()` → `useRouter()` + `.push()` (`next/navigation`)
- `<Link to>` → `<Link href>` (`next/link`)
- `NavLink` + `isActive` → `usePathname()`으로 직접 판정
- `useLocation().pathname` → `usePathname()` / `.search` → `useSearchParams()`
- `useSearchParams`는 **읽기 전용**이고 배열이 아니다. 쓰는 클라이언트 컴포넌트는 **Suspense 경계 필요**
- `navigate(path, { state })` → Next에 없다. sessionStorage 경유 (checkout 흐름 2곳)

## 원본에서 그대로 이어받는 규칙
디렉토리 응집도, 2계층 컴포넌트, 상태 구분(React Query/Zustand/RHF), Query Key 컨벤션, 디자인 토큰, 모바일 우선 반응형, 코딩 컨벤션은 **원본 `../CLAUDE.md`를 따른다**. 이 문서는 그 위에 Next 관련 사항만 덧붙인 것이다.
