# CLAUDE.md — jarvis-web (프론트엔드)

## 프로젝트
- AI Shopping Agent "Jarvis"의 프론트엔드. 자연어 채팅으로 상품을 탐색·추천받는 쇼핑몰
- 부트캠프 최종 프로젝트, **프론트 1인 체제** — 단순함과 일관성이 최우선
- 백엔드는 Spring Boot로 분리. 프론트는 **Next.js(App Router)** 이며, SEO가 필요한 공개 페이지만 SSR하고 나머지는 클라이언트 렌더
- 챗봇 3개(상품 추천 / 문의 / 판매자 분석)는 단일 채팅 API를 공유하는 공통 모듈로 구현

## 명령어
- `npm run dev` — 개발 서버 (**포트 3000 고정** — 백엔드 CORS가 `http://localhost:3000`만 허용)
- `npm run build` — 프로덕션 빌드. **이게 진짜 게이트다** (타입 검사 포함)
- `npm run start` — 프로덕션 서버 / `npm run lint`
> 변경 후 검증: `npm run build`. tsc만으로는 놓치는 에러가 있다

## 기능 명세
- 페이지별 목적·핵심 기능은 `docs/features.md` 참조. 페이지 작업 시 해당 섹션을 먼저 읽고, 이번 세션에서 만들 범위는 프롬프트로 별도 지정받는다

## 기술 스택
- Next.js 16(App Router) · React Query · Zustand · RHF+Zod · Tailwind v4
- **새 라이브러리 추가는 먼저 제안하고 승인받을 것**

## ⚠️ Next.js 16 — 학습 데이터와 다를 수 있음
API를 쓰기 전에 `node_modules/next/dist/docs/`의 해당 문서를 읽을 것. 확인된 것:
- `middleware` → **`proxy`로 이름 변경**(deprecated). 이 프로젝트는 안 쓴다
- `params`·`searchParams`·`cookies()`·`headers()`는 **전부 async**
- Turbopack이 dev·build 기본값 / `next lint` 제거됨 → `eslint` 직접 실행
- `next start`는 기본 `compress: true` (dev에는 없음)

## 디렉토리
- `src/app/` — 라우트(App Router). 화면 구현체는 담지 않고 `features`를 조합만 한다
- `src/features/<page>/{components,hooks,utils}` — 페이지 화면 구현. 그 페이지에서만 쓰는 것
  - **`src/pages/`는 쓰지 않는다** — Next의 Pages Router 예약 디렉토리라, 그 이름을 쓰면
    안의 파일이 클라이언트 번들 대상이 되어 `server-only` import 시 빌드가 깨진다
- `src/shared/`(ui·chat·address·api·auth·hooks·stores·types·utils) — **2개 이상 페이지가 쓰는 것만 승격**
- `src/mocks/` — MSW. 현재 미사용(백엔드 연동 완료). 필요해지면 복구
- **원칙**: 같이 수정될 것들은 같이 둔다. 페이지 전용은 페이지 폴더에, 공용이 된 순간에만 shared로 옮긴다

## 컴포넌트 (2계층)
- **순수 UI (shared/ui)**: 도메인을 모른다. 도메인 객체 대신 원시값/노드만 받는다.
  `<PriceText value={n}>` O / `<PriceText product={p}>` X. 도메인을 아는 공용 모듈은 `shared/<도메인>/`(chat·address)
- **도메인·페이지 컴포넌트**: 도메인 상태를 props로 내려받지 않고 도메인 훅(`useCart()`, `useProduct(id)`)으로 직접 접근한다.
  이유: 호출 위치가 자주 바뀌므로 props 드릴링은 중간 컴포넌트 연쇄 수정을 부른다
- **컴포넌트에서 axios 직접 호출 금지.** 반드시 shared/api 함수 → 도메인 훅 경유

## 상태 구분
- **서버 원본 데이터**(상품/장바구니/주문/찜/문의) → React Query. useState로 복제 금지
- **클라이언트 상태** → Zustand: 인증(authStore — user만 localStorage persist, AT는 메모리 전용), 현재 챗봇 대화(sessionStorage에 탭 단위 저장 — `chatPersistence`), UI 상태
  - 챗 대화를 **탭 단위**로 잡은 이유: 서버 맥락 TTL이 10분(sliding)이라 그보다 오래 남기면
    화면엔 대화가 있는데 AI는 기억 못 하는 어긋난 상태가 길어진다. 탭 수명이 세션 수명과
    대체로 겹쳐 그 간극이 가장 작다. "새 대화"는 저장소도 함께 비운다
- **폼** → React Hook Form + Zod. 검증 규칙은 백엔드 필드 정의와 일치시킬 것

## React Query 규칙
- Query Key 배열 컨벤션(소문자 세그먼트): `['cart']` `['orders', {status}]` `['categories']` `['addresses']` `['products', 'recent']`
- 상품 키는 2벌: `['products', id]`(카드 시딩) / `['products', id, 'detail']`(상세) — 응답 구조가 달라 분리
- staleTime: 정적 데이터(카테고리·브랜드) 30분 / 상품 상세 5분 / 장바구니·주문 0
- 장바구니 변경 성공 시 `invalidateQueries(['cart'])` — **챗봇 CART_ADDED 수신 시에도 동일**
- **캐시 승계**: 카드 → 상세 진입은 `useGoToProduct()`(shared/hooks) 경유
- 목록/상세/브랜드는 스피너 단독 금지 → 스켈레톤 기본
- **⚠️ SSR `initialData`는 "서버가 렌더한 그 조합"에만 넣는다.** 모든 쿼리 키에 그대로 주면
  필터를 바꿔 새 키가 생겼을 때도 옛 데이터가 초기값으로 들어가고, staleTime 때문에
  **재조회조차 하지 않는다**(브랜드 필터에서 실제로 겪음 — `useBrandHome`의 `serverQuery` 참조)

## SSR 경계
- **SSR하는 것**: 상품 상세·브랜드·홈 — 전부 공개 라우트라 인증 없이 서버에서 조회 가능
- **하지 않는 것**: mypage·checkout·seller — 인증이 필요하고, AT가 메모리에만 있어 서버가 알 수 없다
- `shared/api/client.ts`(axios)는 **클라이언트 전용** — authStore·`window.location`을 참조한다.
  서버 컴포넌트는 `shared/api/server.ts`(`server-only`, 인증 없는 공개 API 전용)를 쓴다
- 서버 fetch에는 5초 타임아웃이 있다 — 없으면 백엔드에 못 닿는 CI에서 빌드가 무한정 매달린다

## 인증/권한 (구현: src/shared/auth/guards.tsx, src/shared/api/client.ts, src/shared/stores/authStore.ts)
- 계정 3종: MEMBER / SELLER / ADMIN. 라우트 가드에서 역할별 접근 제어 (RequireAuth, RequireRole)
- 게스트: 탐색·챗봇·**장바구니 담기**까지 가능(횟수 제한 없음, 개인화만 미적용). 구매·찜·마이페이지는 로그인 필요
- **게스트 승계는 `guest_id` 쿠키로 서버가 자동 처리** — FE는 `withCredentials`로 쿠키가 실리는 것만 보장
- 미인증 접근 → `?returnUrl=` 붙여 /login, 로그인 후 복귀
- 토큰: 인터셉터에서 자동 첨부, 401 → refresh 1회 재시도 → 실패 시 clearAuth + 로그인 이동. **이 로직은 shared/api에만 존재**
- **AT는 메모리에만 보관**(persist 제외). 새로고침 시 `useRestoreSession`(app/providers.tsx)이 refresh → `/api/auth/me`로 복원
- **가드를 `proxy.ts`(구 middleware)로 옮기지 않는다** — AT가 메모리에만 있어 서버가 인증 상태를 모른다. 클라이언트 가드 + 백엔드 최종 방어를 유지
- **persist된 user는 신뢰 경계가 아님** — role 판정은 `me` 응답으로 덮어쓴다
- 복원 중(`isRestoring`)에는 가드가 판정을 보류 — 없으면 새로고침마다 로그인으로 튕긴다
- **인증 필요 쿼리의 `enabled`는 `selectIsAuthReady`(복원완료+AT보유) 필수**
- 복원 경로의 401은 리다이렉트 대상이 아님 — `fetchMe`는 `NO_AUTH_REDIRECT`로 호출
- 상세 배경은 `docs/auth-token-strategy.md`

## 배포 구조 (03 D-분산4)
```
ALB → nginx(80) ─ /api/**, /internal/**, /.well-known/**, /actuator/** → spring:8080
                 ─ 그 외                                                → next:3000 (SSR)
```
- **nginx는 앱 티어의 층2 LB.** 프론트 컨테이너에 nginx + node 2프로세스가 함께 돈다(`docker-entrypoint.sh`)
- Next는 `127.0.0.1:3000`만 바인딩 — 외부 노출은 nginx의 80뿐
- 보안 헤더는 **Next(`next.config.ts`)에서만** 붙인다 — nginx에서도 붙이면 응답에 중복으로 실린다
- `src/app/api/[...path]/route.ts`는 **로컬 개발 전용** — 배포에서는 nginx가 `/api`를 처리해 여기까지 오지 않는다.
  로컬에는 nginx가 없어 이 핸들러가 그 역할을 대신하고, dev에서 Set-Cookie의 `Secure`를 떼어
  로컬 http에서도 refresh가 되게 한다
- 환경변수: `NEXT_PUBLIC_API_BASE_URL`(브라우저, 빌드 시점 주입·빈 값=상대경로) / `API_PROXY_TARGET`(로컬 프록시 대상)

## 챗봇 공통 모듈 (src/shared/chat, 타입: src/shared/types/chat.ts)
- 3개 챗봇은 단일 API를 `channel`(SHOPPING|CS|SELLER)만 바꿔 공유. 공통 모듈 + 채널별 렌더러 주입
- 응답은 **SSE 이벤트 6종** `token`(append) / `conditions`(제거 가능 칩) / `products`(카드) / `action`(CART_ADDED 등) / `done` / `error` + **판매자 전용 4종**
- **SSE는 nginx·Next를 타지 않는다** — 세션 발급(`POST /api/chat/sessions`)으로 받은 `llmSseUrl`(AI 서버 절대 URL)에 `streamChat`이 직접 fetch한다. AI 서버가 이 앱 오리진에 CORS를 열어줘야 한다
- **EventSource 금지** — POST+body이므로 `streamChat`의 fetch 스트리밍으로 파싱
- 조건 칩 X 제거 = 후속 메시지 `"[조건 제거] <조건명>"` 전송 (별도 API 없음)
- 카드는 완전한 데이터 포함 → 상세 캐시 시딩용. 카드 표시 위한 재조회 금지
- **자동 재시도 금지**(중복 담기 방지) — 실패 시 재시도 버튼 제공
- sessionId: 백엔드 발급, 10분 sliding TTL

## 라우팅 규칙 (Next 전환 시 정한 것)
- `useRouter().push()`(`next/navigation`) / `<Link href>`(`next/link`)
- 활성 표시는 `usePathname()`으로 직접 판정 (react-router `NavLink`의 `isActive` 대체)
- **화면 내 쿼리 갱신은 `window.history.pushState`** — `router.push`는 페이지 이동이라
  주소창이 즉시 반영되지 않는다(Next 문서가 "목록 정렬" 사례에 pushState를 안내).
  쓰기가 필요하면 `useQueryParams`(shared/hooks) 사용
- `navigate(path, { state })` → Next에 없다. sessionStorage 경유(`shared/utils/checkoutHandoff.ts`).
  결제 성사 시 `clearCheckoutState()`로 비운다 — 안 그러면 나중에 `/checkout` 직접 진입 시 산 상품이 다시 뜬다

### ⚠️ `useSearchParams`와 Suspense — SSR을 죽이는 함정
그 훅을 쓰는 컴포넌트는 Suspense 경계에 묶이고, **경계 안 전체가 SSR에서 빈 HTML로 나간다.**
페이지 껍데기째 감싸면 헤더까지 사라진다(`/login`이 9KB로 나왔던 적 있음).

**판단 기준**: 쿼리값이 *렌더*에 필요한가, *이벤트/이펙트 시점*에만 필요한가.
- 이벤트·이펙트 시점이면 → 그 시점에 `window.location.search`를 읽는다(콜백은 클라이언트에서만 실행)
- 렌더에 필요하면 → Suspense를 쓰되 **경계를 최소 범위로** 좁힌다
- **가드에서는 특히 주의** — 보호된 페이지 전부가 빈 HTML이 된다

## 디자인 시스템 (Figma 시안 기준, 디자인은 개발자 본인이 담당)
- 범용 부품은 shadcn/ui를 shared/ui로 가져와 토큰에 맞게 수정. 같은 부품 새로 만들지 말 것
- 도메인 컴포넌트(상품 카드·별점·리뷰 분포 바·이미지 갤러리·스펙 표)는 Tailwind 직접 구현
- **토큰은 tailwind 테마 값만 사용, 임의 값 금지**:
  - 색상: primary(검정)/배경(흰색)/회색 2~3단/포인트(할인 빨강·별점 노랑)/brand(청록 `--brand` — AI 기능 강조 전용) 외 금지
  - radius: 버튼·칩 `rounded-full`, 카드·이미지·입력 `rounded-sm` (이 2단계 외 금지)
  - 폰트: Pretendard / 간격: 정의된 스케일만 (임의 px 금지)
- 시안에 없는 상태(로딩/에러/빈 상태)는 기존 페이지 패턴을 따라 통일

## 반응형 (모바일 우선)
- **모든 페이지는 모바일(≥360px)부터 데스크탑까지 대응.** 시안이 데스크탑 기준이어도 좁은 화면에서 깨지지 않게 구현
- 기본값은 모바일, 넓어질 때 `sm:`/`md:`/`lg:`로 확장. breakpoint는 Tailwind 기본값 사용
- 컨테이너 폭은 `w-full` + `max-w-*`로 좁은 화면에선 꽉 차고 넓은 화면에선 상한을 둔다
- 여백은 모바일에서 과하지 않게 반응형으로: 예 `p-6 sm:p-8`, `py-10 sm:py-20`
- 가로 스크롤 금지. 넘칠 수 있는 요소는 `overflow-x-auto`로 자체 스크롤
- 터치 타겟은 최소 높이 확보(대략 `h-11` 이상), 화면 가장자리에 요소가 붙지 않게 좌우 여백 유지

## 코딩 컨벤션
- 함수형 컴포넌트+훅만 (클래스 금지)
- 파일명: 컴포넌트 `PascalCase.tsx`, 훅 `useXxx.ts`, 그 외 `camelCase.ts`
- `any` 금지 (불가피하면 `unknown` + 좁히기)
- Tailwind 유틸리티만 사용, 별도 CSS/CSS-in-JS 금지
- 주석은 "왜"가 필요한 곳에만

## Claude 작업 지침
- 새 컴포넌트 전, shared/ui와 해당 페이지 components/에 유사한 것이 있는지 먼저 확인
- 페이지 전용/공용이 애매하면 페이지 폴더에 먼저 만든다 (승격은 나중에)
- 백엔드 API가 없으면 계약대로 목을 추가 후 진행. 계약에 없는 필드를 임의로 만들지 말 것
- 미정 정책(sessionId 만료 처리, 판매자/관리자 계정 생성 방식 등)은 임의로 정하지 말고 질문
- 다중 파일·구조 변경(폴더 이동, 라이브러리 교체)은 실행 전 계획부터 제시
- 결제·인증·배포 관련 코드는 위험을 먼저 설명하고 수정
- **인프라 구조(nginx·컨테이너·워크플로)는 팀 아키텍처 문서(`03-architecture.md`)를 먼저 확인하고,
  바꿔야 한다면 반드시 먼저 묻는다** — 이식 중 nginx를 임의로 제거해 3중 방어가 깨진 적 있음

## 미확정 (정해지면 이 문서 갱신)
- sessionId 10분 TTL 만료 시 응답/재발급 스펙
- 판매자/관리자 계정 생성 방식 (별도 가입 vs DB 시드)
- `/internal` 경계: 문서(03 §4)는 "nginx 차단"이지만 실제 nginx.conf는 프록시 중.
  AI 서버가 ALB 경유로 호출하는 구조라 차단하면 상품 검색이 죽는다.
  내부망 직행(프라이빗 IP)으로 바꾸려면 보안그룹 작업이 선행 — 팀 논의 필요
