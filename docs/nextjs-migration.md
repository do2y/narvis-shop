# Next.js 마이그레이션 계획

> 작성 2026-07-28 · **상태: 1~5단계 코드 완료 + 브라우저 검증 전 시나리오 통과(2026-07-29).**
> **남은 것: 워크플로 rename → 푸시 → 전환.** 아직 원본 Vite 앱이 배포 중이다(스위치 OFF).
> 검증 결과는 `docs/nextjs-migration-qa.md` 참조 — 브라우저에서만 드러난 버그 5건 발견·수정
> 배경 결정은 CLAUDE.md와 `docs/auth-token-strategy.md` 참조
> 작업 폴더: `jarvis-web-next/` (Next 16.2.12). 그 폴더의 CLAUDE.md에 이식 규칙 정리됨

## 1. 목표와 비목표

**목표 — SEO/OG 확보**
- 상품 상세(`/products/:id`)·브랜드(`/brands/:id`)·홈(`/`)을 서버 렌더로 전환해 검색엔진에 본문이 노출되게 함
- 상품·브랜드 페이지에 동적 OG 태그를 붙여 카카오톡·슬랙 공유 시 카드가 뜨게 함
- 위 3개 페이지의 LCP 개선(현재는 JS 번들 로드 → 쿼리 → 렌더의 3단 지연)

**비목표 (이번 범위 밖 — 하지 않음)**
- 인증 필요 페이지(mypage·checkout·seller·admin)의 SSR 전환. 클라이언트 렌더 유지
- BFF 구축. AT 메모리 보관 전략을 **그대로 유지**함
- 챗봇 SSE 스트리밍 구조 변경. 현재 fetch 스트리밍 그대로 이식
- React Query → 서버 상태 라이브러리 교체 등 상태관리 재설계

**이 경계가 성립하는 이유**: SEO가 필요한 페이지는 전부 공개 라우트라 인증 토큰 없이 서버에서 데이터를 받을 수 있음. 따라서 인증 아키텍처를 건드리지 않고 목표를 달성함. 인증 페이지를 SSR하려 드는 순간 BFF가 필수가 되고 공수가 몇 배로 뜀 → 그래서 뺌.

## 2. 방식: 새 프로젝트로 점진 이식

`jarvis-web-next/`를 별도로 만들고 페이지를 하나씩 옮김. 이식 중에도 현재 Vite 앱은 계속 동작하므로 언제든 중단·롤백 가능함. 전부 옮긴 뒤 레포를 교체함.

in-place 전환을 택하지 않은 이유: Vite와 Next는 빌드 설정·환경변수·엔트리가 모두 충돌해서 중간 상태에서 앱이 빌드되지 않는 구간이 길게 생김. 1인 체제에서 "지금 돌아가는 앱"을 잃는 건 위험함.

**이식 원칙 — 1:1 이식, 리팩토링 금지**: 이식 단계의 목표는 동작 동일성임. 옮기면서 구조 개선·이름 변경·"김에 정리"를 섞지 않는다(라우터 치환 등 Next가 강제하는 변경만 허용). 개선이 섞이면 원본과의 디프 검증이 불가능해짐. 개선은 이식 완료 후 별도 작업으로.

**⚠️ 디렉토리 예외 (2026-07-28 발견)**: 원본 `src/pages/`는 **`src/features/`로 옮긴다**. `src/pages/`가 Next의 Pages Router 예약 경로라 그 안의 파일이 전부 클라이언트 번들 대상이 되고, 서버 전용 모듈(`server-only`)을 쓰는 순간 빌드가 깨진다. 폴더 안의 `{components,hooks,utils}` 구조는 원본 그대로 유지. import는 `@/features/...`. — 1:1 원칙의 유일한 구조 예외이며 Next가 강제하는 변경에 해당함

## 3. 현황 실측 (2026-07-28 기준)

| 항목 | 수치 | 이식 영향 |
|---|---|---|
| 전체 TS/TSX 파일 | 180개 / 15,811줄 | — |
| react-router 의존 파일 | 33개 | 기계적 치환 대상 |
| `useNavigate` | 32회 | → `useRouter().push` |
| `<Link>` / `NavLink` | 21회 / 12회 | → `next/link` (`NavLink`는 `usePathname`으로 active 판정 직접 구현) |
| `useSearchParams` | 12회 (실측 결과 **전부 읽기 전용** — `setSearchParams` 사용 0회) | → `next/navigation` 동명 훅. **Suspense 경계 필수** — 없으면 빌드 실패 또는 페이지 전체 CSR 강등 |
| `useLocation` | 13회 | → `usePathname` + `useSearchParams` 분해 |
| `useParams` | 6회 | → 서버 컴포넌트는 `params` prop, 클라이언트는 동명 훅 |
| `navigate(..., { state })` | 2흐름 (상품 상세→`/checkout`, 결제→`/checkout/complete`) | **Next에 없는 개념** — `router.push`는 state 전달 불가. sessionStorage 경유로 대체 (아래 스니펫) |
| splat 라우트 | 3개 (`/mypage/*`, `/seller/*`, `/admin/*`) | **실질 공수** — 폴더 구조로 재배치 |
| `import.meta.env` | 7곳 | → `process.env.NEXT_PUBLIC_*` |

가장 무거운 페이지: mypage 2,461줄 · seller 2,106줄 · product 1,095줄

### 치환 표준 스니펫 (33개 파일에서 이 패턴만 사용 — 제각각 구현 금지)

**NavLink → active 판정 직접 구현**
```tsx
// before: <NavLink to="/mypage/orders" className={({ isActive }) => isActive ? A : B}>
const pathname = usePathname();
const isActive = pathname.startsWith("/mypage/orders");
<Link href="/mypage/orders" className={isActive ? A : B}>
```

**useLocation 분해**
```tsx
// location.pathname        → usePathname()
// location.search          → useSearchParams()  ※ .toString()에 '?' 미포함 주의
// location.pathname+search → `${pathname}${qs ? `?${qs}` : ""}`  (returnUrl 조립)
// location.state           → 없음. 아래 sessionStorage 패턴으로
```

**useSearchParams (전부 읽기 전용이라 이것만)**
```tsx
// before: const [searchParams] = useSearchParams();
const searchParams = useSearchParams(); // 배열 아님, 단일 반환
// 사용하는 클라이언트 컴포넌트는 <Suspense>로 감쌀 것 (page 단위에서)
```

**navigate state → sessionStorage 경유 (checkout 흐름 전용)**
```tsx
// before: navigate("/checkout", { state });
sessionStorage.setItem("checkout:state", JSON.stringify(state));
router.push("/checkout");
// 수신측: 마운트 시 읽기. removeItem은 하지 않는다 — 원본(history.state)은 새로고침에도
// 살아남으므로 지우면 동작이 달라짐. 다음 결제 진입 시 setItem이 덮어씀. 없으면 기존 null 분기.
// [알고 수용한 차이] history.state는 히스토리 엔트리별, sessionStorage는 탭별.
// 결제 A → 뒤로 → 바로구매 B → 뒤로가기로 A의 checkout 엔트리 복귀 시 원래는 A state,
// 이제는 B state가 보임. checkout 특성상 실사용 영향 낮다고 판단해 수용 — 관련 버그
// 리포트가 오면 이 차이부터 의심할 것.
```

## 4. 단계별 계획

각 단계 끝에서 `npm run build` 통과를 게이트로 삼음 (tsc만으로는 놓치는 에러가 있음).

### 1단계 — 프로젝트 셋업 + 공통 계층 이식
- `jarvis-web-next/` 생성 (App Router, TypeScript, Tailwind v4)
- **새 레포용 CLAUDE.md를 1단계에 작성** — `jarvis-web-next/`에서 작업하는 모든 세션이 알아야 할 결정(AT 메모리 전략, 미들웨어 가드 금지, 프록시 구조, 포트 3000 고정, 1:1 이식 원칙)을 담고 이 계획 문서를 참조시킴. 기존 레포 CLAUDE.md의 CSR 전제 문구 갱신은 5단계에
- `src/shared/` 전체를 그대로 복사 — 대부분 라우터 비의존이라 수정 없이 넘어감
  - 수정 필요: `AppHeader.tsx`(Link), `useGoToProduct.ts`·`useLogout.ts`·`useWishlist.ts`(useNavigate)
- **서버-safe fetch 분리** — 현재 `shared/api/client.ts`(axios)는 클라이언트 전용임: 인터셉터가 authStore·`window.location`을 참조하고 401 리다이렉트를 수행함. 서버 컴포넌트에서 그대로 쓰면 안 됨. 공개 API(상품·브랜드·홈)용 **서버 fetch 헬퍼를 별도 파일로 분리**(인증 헤더·인터셉터 없음, 서버 전용 base URL 사용, 봉투 언래핑만 공유). 2단계 SSR이 이걸 사용함
- `import.meta.env` → `process.env.NEXT_PUBLIC_*` 치환 (7곳)
- React Query Provider를 `'use client'` 경계 컴포넌트로 분리해 루트 레이아웃에 배치
- `useRestoreSession`을 클라이언트 부트 컴포넌트로 이식 — **AT 메모리 전략 그대로**
- **MSW는 이식하지 않음** (2026-07-28 결정) — 백엔드·LLM 서버가 배포되어 실 API 연동이 기본이 됨. 현 레포도 이미 `VITE_ENABLE_MOCKS=false`로 배포 백엔드에 붙어 개발 중. 필요해지면 `src/mocks/`를 복사(핸들러는 프레임워크 비의존이라 거의 그대로 동작)
- **`/api` 프록시: 전 환경 공용 Route Handler로 통일 (2026-07-28 결정)** — `app/api/[...path]/route.ts` 하나가 dev·prod 모두에서 백엔드로 프록시함
  - 배경: dev는 쿠키 재작성이 필요함(`vite.config.ts:26-36` — 로컬 http에서 `Secure` RT 쿠키가 저장되지 않아 refresh가 항상 401 → 로그인 불가). Next `rewrites()`는 응답 헤더 조작 불가
  - "dev 전용 Route Handler + prod rewrites" 조합은 **불가** — Route Handler는 파일시스템 라우트라 rewrites보다 먼저 매칭되므로 prod에서도 `/api/*`를 가로챔. 파일 존재로는 환경 분기가 안 됨
  - 따라서 Route Handler를 공용 프록시로 삼음. 쿠키 재작성(`Secure` 제거·`SameSite=Lax`)만 `NODE_ENV=development` 분기 — **prod에서는 헤더를 건드리지 않고 그대로 통과**
  - 이점: dev와 prod가 같은 **코드** 경로임. 단 **서버는 다름** — `next dev`는 압축을 안 하지만 prod `next start`는 기본 `compress: true`(문서 확인). 스트리밍 응답이 이 프록시를 지나간다면 버퍼링 위험이 있으므로 게이트 ③에 `next start` 검증을 포함함
  - **※ 실측 정정 (2026-07-28): 챗봇 SSE는 이 프록시를 타지 않음.** 구매자·판매자 모두 세션 발급(`POST /api/chat/sessions`·`/api/chat/seller/sessions`, 일반 JSON)으로 받은 `llmSseUrl`(AI 서버 절대 URL)에 `streamChat`이 직접 fetch함 — 원본 `vite.config.ts` 주석에도 명시됨. 따라서 **SSE 버퍼링 리스크는 이 프록시에 실재하지 않음**. passthrough 구현은 방어적으로 유지하되(장래 스트리밍 엔드포인트 대비), 게이트 ③의 실제 검증 대상은 "세션 발급 → AI 서버 직통 스트리밍"이 정상 동작하는지임
  - **구현 요건 (처음부터 이렇게 짤 것)**:
    - 응답 스트리밍 passthrough — body를 버퍼링 없이 `new Response(upstream.body, ...)`로 그대로 흘림. 버퍼링하면 "SSE 구조 그대로 이식" 비목표가 여기서 깨짐
    - **전 HTTP 메서드 export** (GET/POST/PUT/PATCH/DELETE) — 챗봇·로그인은 POST라 GET만 만들면 즉시 막힘
    - 요청 body를 스트림으로 넘기면 Node fetch는 **`duplex: 'half'` 필수** (없으면 런타임 에러)
    - **`export const dynamic = 'force-dynamic'`** — 프록시 응답이 캐시되면 안 됨
    - set-cookie는 **복수 개 대응** — AT 갱신+RT 재발급이 동시에 오면 헤더가 여러 개임. `headers.get()`은 합쳐버리므로 `getSetCookie()`로 다뤄야 dev 재작성 분기가 안전함
- dev 포트는 3000 고정 유지 (백엔드 CORS가 `http://localhost:3000`만 허용)
- 게이트: ① 빈 페이지·헤더 렌더 ② **로그인 → 새로고침 → 세션 복원** 동작 ③ **챗 세션 발급 → AI 서버 직통 스트리밍** 정상 동작 (dev + `next build && next start` 양쪽)

#### ✅ 1단계 완료 (2026-07-28)

| 검증 항목 | 결과 |
|---|---|
| `npm run build` | 통과 (타입 검사 포함, 경고 0) |
| 홈 SSR | 서버 렌더 HTML에 헤더(로고·로그인·시작하기)·본문 포함 확인 |
| `/healthz` | 200 `text/plain` |
| 보안 헤더 4종 | nginx → `next.config.ts` 이관 확인 |
| 프록시 GET | `/api/categories` 200 + 실데이터 (`server: nginx` 헤더로 백엔드 도달 확증) |
| 프록시 POST | `/api/auth/refresh` 401 `AUTH_REQUIRED` (메서드·body 전달 정상) |
| **쿠키 재작성** | **dev에서 `Secure` 제거 확인 / prod에서 `Secure` 유지 확인** — 환경 분기 정상 |
| 챗 세션 발급 | `sessionId`·`streamTicket`·`llmSseUrl` 정상 수신 |
| 원본 무변경 | `git status src/` 0건 |

미검증(브라우저 필요): 실제 로그인 폼 제출 → 새로고침 세션 복원 UI 흐름. 4단계에서 auth 페이지 이식 후 확인.

### 2단계 — 상품 상세 SSR (SEO 1순위)
- `app/products/[productId]/page.tsx` — 서버 컴포넌트에서 상품 데이터 호출 (1단계에서 분리한 서버 fetch 헬퍼 사용)
- `generateMetadata`로 title·description·OG(이미지·가격) 생성
- **중복 fetch 방지**: `generateMetadata`와 `page.tsx`가 같은 상품을 각각 부르면 요청당 API 2회. 서버 fetch 함수를 React `cache()`로 감싸 요청 단위 dedup — 헬퍼가 네이티브 `fetch()` 기반이면 Next가 동일 요청을 자동 dedup하므로 그것만으로도 해결되지만, 헬퍼가 axios를 재사용하는 경우엔 dedup이 없으므로 `cache()` 래핑을 표준으로 함(fetch 기반이어도 무해)
- 서버에서 받은 데이터를 React Query에 하이드레이션 → 클라이언트 상호작용(옵션 선택·장바구니·찜)은 기존 컴포넌트 그대로 `'use client'`
- 후기(`fetchProductReviews`)는 페이지네이션·정렬이 있어 클라이언트 유지
- **주의**: 카드 시딩(`useSeededProductCard`)은 클라이언트 캐시 승계 메커니즘이라 SSR과 공존해야 함. 서버 데이터가 정본이므로 시딩은 초기 렌더 보조로만 남김
- 게이트: `view-source`에 상품명·가격·설명이 보이고, OG 디버거에서 카드가 뜸

#### ✅ 2단계 완료 (2026-07-28)

| 검증 항목 | 결과 |
|---|---|
| `npm run build` | 통과. `/products/[productId]`가 `ƒ (Dynamic)`으로 등록 |
| `<title>` | `[지샥] GA-2100-1A1DR … \| 지샥(G-SHOCK)` — 상품명+브랜드 |
| meta description | 상품 `summary` 전문 렌더 |
| OG 태그 | `og:title`·`og:description`·`og:image`·`og:type` + `twitter:card` 생성 |
| **본문 SSR** | 상품명·브랜드·가격(142,350원/정가 150,150원)·액션 버튼이 HTML에 포함 — JS 없이 읽힘 |
| **중복 fetch 방지** | 계측 프록시로 측정: 페이지 1요청당 백엔드 호출 **정확히 1회** (`cache()` 동작 확인) |
| 404 처리 | 없는 상품·잘못된 형식 모두 404 (`notFound()`) |
| 백엔드 장애 시 | 초기 데이터 없이 렌더 → 클라이언트가 재조회(원본 스켈레톤 경로와 동일) |

**구현 메모**
- 서버 fetch는 `shared/api/server.ts`(`server-only` + 봉투 언래핑) → `features/product/serverApi.ts`(`cache()` 래핑)
- 데이터 전달은 `HydrationBoundary` 대신 **`useQuery`의 `initialData`** — 이 페이지는 상세 쿼리 1개뿐이라 더 단순하고, 클라이언트 내비게이션 진입 시엔 `undefined`라 기존 동작(카드 시딩→조회)이 그대로 유지됨
- 리뷰는 계획대로 클라이언트 유지(정렬·페이지네이션 있음)

### 3단계 — 브랜드 + 홈 SSR
- `app/brands/[brandId]/page.tsx` — 2단계와 동일 패턴, `generateMetadata` 포함
- `app/page.tsx` — 홈. 인기/추천 상품 목록을 서버에서 받음
- 브랜드의 카테고리 필터·정렬은 URL 쿼리로 올려 서버에서 처리 (SEO상 필터별 URL이 색인 가능해짐)
- 게이트: 3개 페이지 모두 소스에 본문 노출

#### ✅ 3단계 완료 (2026-07-28)

| 검증 항목 | 결과 |
|---|---|
| `npm run build` | 통과. 홈 `○ (Static) Revalidate 30m`, 브랜드 `ƒ (Dynamic)` |
| 홈 SSR | 인기상품 가격이 HTML에 포함(11,360 / 142,350 / 19,730원 …) |
| 홈 메타 | `<title>Jarvis — 대화로 찾는 쇼핑</title>` + OG |
| 브랜드 SSR | `<title>지샥(G-SHOCK) \| Jarvis</title>`, 본문에 브랜드명 9회·상품 가격 렌더 |
| **정렬 URL 쿼리** | `?sort=price_asc` → 323,000원 먼저 / `?sort=price_desc` → 767,700원 먼저 (**서버에서 순서 실제로 바뀜**) |
| **카테고리 필터 URL** | brandId=53에서 전체 2개 → `?category=19`(TV) 1개 / `?category=22`(모니터) 1개로 정확히 분기 |
| canonical | 필터·정렬·페이지가 붙어도 `/brands/{id}`로 수렴 — 중복 색인 방지 |

**구현 메모**
- 브랜드 상태를 `useState` → **URL 쿼리**로 이동. 공유·뒤로가기가 동작하고 서버가 같은 조건을 렌더할 수 있게 됨. 기본값(`sort=popular`·`page=0`)은 URL에서 빼 같은 화면이 두 URL로 갈리지 않게 함
- `useSearchParams`를 쓰므로 브랜드 페이지는 **`<Suspense>` 경계로 감쌈**(검토 지적 사항 — 없으면 빌드 실패/CSR 강등)
- 홈은 하위 컴포넌트가 각자 훅으로 데이터를 가져오는 구조(CLAUDE.md)라 **`HydrationBoundary`** 사용. 상품 상세(쿼리 1개)의 `initialData`와 방식이 다른 이유
- 홈 prefetch는 카테고리·인기상품 각각 `.catch(() => {})` — 한쪽 실패가 홈 전체를 막지 않게. 개인화 추천은 로그인 필요라 클라이언트 조회 유지
- `cache()`에 객체 인자를 넘기면 참조 동등성 때문에 중복 제거가 안 됨 → 브랜드는 쿼리를 **문자열 키로 정규화**해 래핑

### 4단계 — 나머지 페이지 클라이언트 이식
SSR 없이 `'use client'`로 그대로 옮김. 라우터 훅 치환이 작업의 대부분임.
- 순서: auth → cart → wishlist → chat/inquiry → checkout → mypage → seller → admin
- splat 라우트 3개는 폴더 구조로 펼침:
  - `/mypage/*` → `app/mypage/{orders,reviews,wishlist,...}/page.tsx`
  - `/seller/*` → `app/seller/{dashboard,products,orders,chat}/page.tsx`
- 가드(`RequireAuth`·`RequireRole`·`BlockSeller`)는 레이아웃 단위 클라이언트 컴포넌트로 재구성
  - **`proxy.ts`(구 middleware)로 옮기지 않음**: AT가 메모리에만 있어 서버가 인증 상태를 알 수 없음. 현행 클라이언트 가드 + 백엔드 최종 방어 구조를 유지함
  - ※ Next 16에서 `middleware` 규약은 `proxy`로 이름이 바뀜(deprecated). 이 프로젝트는 애초에 쓰지 않으므로 영향 없음
- checkout 흐름의 `navigate(..., { state })` 2곳은 sessionStorage 패턴으로 치환 (3장 스니펫)
- 게이트 — 라우트별 체크리스트 (각 항목 확인 결과를 보고):

| 라우트 | 확인 동작 |
|---|---|
| `/login` `/signup` | 로그인·가입 성공, `?returnUrl=` 복귀 |
| `/` | 인기·추천 상품 렌더 |
| `/products/:id` | 옵션 선택 → 장바구니 담기, 바로구매 → `/checkout` state 전달 |
| `/brands/:id` | 카테고리 필터·정렬 동작 |
| `/chat` | 스트리밍 수신, 조건 칩 제거, 카드 → 상세 캐시 시딩 |
| `/inquiry` | 문의 챗 응답 수신 |
| `/cart` | 게스트 담기, 수량 변경 시 헤더 뱃지 동기화 |
| `/wishlist` | 게스트 → 로그인 유도, 회원 → 찜 목록 |
| `/checkout` → `/complete` | 게스트 접근 시 로그인 리다이렉트, 주문 완료 화면에 주문 정보 표시 |
| `/mypage/*` | 주문 목록·상세 로드, 리뷰 작성, 게스트 접근 차단 |
| `/seller/*` | MEMBER 접근 차단, 대시보드 로드, 셀러 챗 SSE(직통 경로) |
| `/admin/*` | 비ADMIN 접근 차단 |
| 공통 | 새로고침 세션 복원, 판매자의 구매자 라우트 접근 → `/seller` 격리 |

#### ✅ 4단계 완료 (2026-07-28)

| 검증 항목 | 결과 |
|---|---|
| `npm run build` | 통과. **24개 라우트 전부 등록** |
| 전 라우트 응답 | 24/24 HTTP 200 |
| SSR 본문 | `/login` 17.6KB(email·password 입력 포함) · `/signup` 23.2KB · `/chat` 16.1KB(input+placeholder) · `/cart` 16.2KB |
| **가드 동작** | 비로그인 시 `/mypage/orders`·`/checkout`·`/seller`·`/admin` 모두 본문 요소 0 (리다이렉트 대기) / 공개 라우트는 16KB 완전 렌더 |
| react-router 의존 | **0** (설명 주석 2곳만 잔존) |
| 원본 무변경 | `git status src/` 0건 |

**구조 변환**
- `/mypage/*` splat → `app/mypage/{orders,orders/[orderId],reviews/new,claims,recent,wishlist,addresses,inquiries}` + `layout.tsx`(RequireAuth + 셸)
- `/seller/*` splat → `app/seller/(shell)/{,orders,products}` + `app/seller/chat`. **라우트 그룹 `(shell)`** 로 원본의 "chat만 셸 밖" 구조를 그대로 표현
- 가드는 `Outlet` → `children` 형태로 변환(`shared/auth/guards.tsx`). 리다이렉트는 렌더 중이 아니라 이펙트에서 `router.replace` — Next는 렌더 중 내비게이션에 경고를 냄
- `BlockSeller`는 경로 판정 방식(`shared/auth/SellerIsolation.tsx`)으로 루트에 배치. 라우트 그룹으로 구매자 라우트를 전부 이동하는 건 1:1 범위를 넘는 구조 변경이라 회피

**⚠️ Suspense 경계는 최소 범위로 (실측으로 배운 것)**
`useSearchParams`를 쓰는 컴포넌트는 Suspense 경계에 묶이고, **그 경계 안 전체가 SSR에서 비워진다.** 처음에 페이지 껍데기째 감쌌더니 `/login`이 9KB(헤더만)로 나왔다. 쿼리값이 **렌더에 필요 없고 이벤트/이펙트 시점에만 필요하면** `useSearchParams` 대신 `window.location.search`를 그 시점에 읽어 경계 자체를 없앤다:
- `useAuthForm`(returnUrl) → 제출 콜백에서 읽기 → `/login` 9KB→17.6KB
- `chat`(`?q=`) → 마운트 이펙트에서 읽기
- `guards`(returnUrl) → 리다이렉트 시점에 읽기 (가드는 화면 전체를 감싸므로 특히 중요)

렌더 중 실제로 쿼리가 필요한 곳(브랜드 필터·리뷰 대상·셀러 페이지네이션)에만 Suspense를 남겼다.

**부수 정리**
- `useQueryParams`(shared/hooks) 신설 — 원본 `[params, setParams] = useSearchParams()` 쓰기 패턴 대체(셀러 3개 화면). 계획서 초안의 "12곳 전부 읽기 전용" 실측은 shared 기준이었고, 페이지 코드에는 쓰기 패턴이 있었음
- `navigate(path, {replace:true})` → `router.replace(path)` (Next에 replace 옵션 없음)
- 죽은 파일 제거: `features/{mypage,seller}/index.tsx`(구 내부 라우터, App Router가 대체)

### 5단계 — 배포 전환
`Dockerfile` 런타임 스테이지만 교체함. `.github/workflows/deploy.yml`(GHCR 푸시 → EC2 배포)은 **변경 없음**.

- `next.config.ts`에 `output: 'standalone'` — 컨테이너 이미지 크기 최소화
- Dockerfile runtime: `FROM nginx:1.27-alpine` + dist 복사 → `FROM node:20-alpine` + `node server.js`
- `nginx.conf` 설정 이관처:
  - 보안 헤더 4종 → `next.config.ts`의 `headers()`
  - `/api/` 프록시(8080) → **1단계의 공용 Route Handler가 이미 담당** (rewrites 안 씀 — Route Handler가 파일시스템 라우트라 rewrites보다 먼저 매칭되므로 병행 불가, 1단계 참조). **prod 프록시 대상 주소는 착수 전 확인 필요** — nginx 시절 `127.0.0.1:8080`이 통한 건 그 컨테이너의 네트워크 구성 덕분임. Next 컨테이너 안의 `127.0.0.1`은 자기 자신이므로, 백엔드가 별도 컨테이너면 bridge 네트워크에선 안 닿음. EC2에서 컨테이너가 host 네트워크인지 / compose 서비스명으로 부르는지 확인 후 서버 전용 env로 주입
  - `/healthz` → `app/healthz/route.ts`
  - gzip·정적자산 캐시 → Next 기본 제공
  - SPA fallback(`try_files`) → 불필요(App Router가 처리)
- 환경변수: `NEXT_PUBLIC_*`는 **빌드 시점에 번들에 박힘** — 현재 Dockerfile이 빌드 스테이지에서 `ENV VITE_API_BASE_URL=""`로 주입 중이라(deploy.yml build arg 아님) 같은 자리에서 이름만 `NEXT_PUBLIC_*`로 교체하면 됨. 서버 전용 base URL은 런타임 주입 가능
- 레포 교체 후 Vite 잔재 제거(`vite.config.ts`·`index.html`·`vercel.json`·`tsconfig.*.json`)
- CLAUDE.md 갱신 (CSR 전제 문구·디렉토리 규칙)

#### ✅ 5단계 준비 완료 (2026-07-28) — **전환 스위치는 아직 OFF**

배포 파일을 만들고 **Docker 이미지 빌드·컨테이너 실행까지 실제로 검증**했다. 다만 브라우저 수동 검증 전이라 실제 전환은 하지 않았다.

| 검증 항목 | 결과 |
|---|---|
| `docker build` | 성공 (416MB, standalone) |
| 컨테이너 실행 | 전 라우트 200, 헬스체크 `curl -fs localhost/healthz` → `ok` |
| 컨테이너 내 SSR | 상품 제목·OG 이미지 정상 |
| 컨테이너 내 API 프록시 | `/api/categories` 200 |
| 보안 헤더 | 4종 응답 확인 |
| 정적 자산 | `/_next/static/...` 200 (32KB), `/favicon.svg` 200 |
| 실행 사용자 | `node` (비특권) |
| **백엔드 없는 빌드** | 통과 — CI에서 안전 |
| ESLint | 에러 0 (경고 20 = `<img>`→`next/image` 권고, 이식 후 별도 작업) |

**파일**
- `jarvis-web-next/Dockerfile` — deps/build/runtime 3스테이지. nginx → `node server.js`
- `jarvis-web-next/.dockerignore` — `node_modules`·`.next`·`.env*` 제외(비밀값 유입 차단)
- `.github/workflows/deploy-next.yml.disabled` — **비활성 상태로 대기.** 활성화 절차를 파일 상단에 기재
- `.github/workflows/ci.yml` — `check-next` 잡 추가(PR에서 Next 앱도 검사, 배포와 무관해 지금 켬)

**빌드 중 발견하고 고친 것**
1. **홈 프리렌더가 `next build`를 깨뜨림** — 홈이 빌드 시점에 정적 생성되며 백엔드를 부르는데, CI 컨테이너엔 백엔드가 없어 60초 타임아웃 → 빌드 실패. 로컬은 `.env.local`이 있어 통과했었다. **`export const dynamic = "force-dynamic"`** 으로 요청 시 렌더로 전환(데이터는 `serverApi`에서 30분 재검증 캐시라 매 요청 조회는 아님)
2. **서버 fetch 무한 대기** — `serverGet`에 5초 타임아웃(`AbortSignal.timeout`) 추가. 백엔드에 못 닿는 환경에서 요청이 매달리지 않게
3. **80번 포트 권한** — 원본 nginx는 root라 가능했으나 Node를 비특권으로 돌리면 bind 불가. root 실행 대신 `setcap cap_net_bind_service`로 node 바이너리에 권한만 부여하고 `USER node`
4. **standalone은 `.env`를 읽지 않음** — `docker run`에 `-e API_PROXY_TARGET` 명시 주입 필요(검증 중 500 에러로 발견)
5. ESLint 에러 4건 — try/catch 내 JSX 구성, 이펙트 내 동기 setState 3곳. 후자는 `useClientValue`(`useSyncExternalStore` 기반) 훅으로 정리

**네트워크 구성 (확인 완료)**
`deploy.yml`이 `--network host`로 컨테이너를 띄운다 → 컨테이너의 `localhost:8080`이 EC2 호스트의 Spring을 가리킨다. bridge로 바꾸면 `localhost`가 컨테이너 자신이 되므로 `API_PROXY_TARGET`도 함께 바꿔야 한다(주석에 명시).

#### ⬜ 남은 것 — 실제 전환

1. **브라우저 수동 검증** (필수, 자동화로 대체 불가): 로그인 → 새로고침 세션 복원 / 상품 담기 → 결제 → 주문 완료 / 챗봇 스트리밍 / 판매자 화면. 4단계 게이트 체크리스트 참조
2. `deploy-next.yml.disabled` → `deploy-next.yml`, 기존 `deploy.yml` → `.disabled`
3. main 푸시 → 배포. 문제 시 워크플로 rename 되돌리거나 EC2에서 이전 이미지 해시로 `docker run`
4. 안정화 후: 레포 교체, Vite 잔재 제거(`vite.config.ts`·`index.html`·`vercel.json`·`nginx.conf`·`src/`·`src/mocks/`), `next.config.ts`의 `turbopack.root`·`outputFileTracingRoot` 제거, 원본 CLAUDE.md 갱신

## 5. 위험 요소

| 위험 | 영향 | 대응 |
|---|---|---|
| **배포 런타임 변경** | nginx 정적 서빙 → Node 상시 프로세스. SSR은 매 요청 서버에서 렌더를 돌리므로 JS 실행 주체가 필요함 | 이미 Docker+EC2 구조라 컨테이너 런타임 스테이지 교체로 해결됨. GitHub Actions 파이프라인은 변경 없음. nginx.conf의 보안헤더·gzip·`/api` 프록시·`/healthz`를 Next 설정으로 이관 (5단계) |
| 서버에서 백엔드 호출 시 네트워크 경로 | 브라우저용 `VITE_API_BASE_URL`이 서버에선 안 닿을 수 있음 | 서버 전용 base URL 환경변수 분리 |
| ~~SSE가 공용 프록시 Route Handler 통과~~ | ~~prod에서 챗봇 스트리밍이 Node 프록시를 거침~~ | **해소됨(실측)** — 구매자·판매자 챗 모두 `llmSseUrl`(AI 서버 절대 URL) 직통이라 프록시를 타지 않음. 프록시엔 세션 발급(일반 JSON)만 지나감. passthrough는 방어적으로 구현해 두되 게이트 ③은 "AI 서버 직통 스트리밍 정상 동작" 확인으로 수행 |
| AI 서버 CORS | SSE가 브라우저에서 AI 서버로 직접 나가므로 새 오리진(Next dev 3000 / prod 도메인)을 AI 서버가 허용해야 함 | 포트 3000 유지로 dev는 기존과 동일. prod 도메인은 5단계에서 확인 |
| React Query 하이드레이션 불일치 | 서버·클라이언트 렌더 결과가 달라 경고·깜빡임 | 쿼리 키·staleTime을 서버/클라이언트 동일하게 맞춤 |
| ~~MSW와 서버 컴포넌트~~ | ~~브라우저 워커는 서버 fetch를 가로채지 못함~~ | **해소됨** — MSW를 이식하지 않기로 해 SSR 경로가 실 백엔드만 바라봄 |
| 백엔드 의존 심화 | 목을 버리므로 백엔드·LLM 서버가 내려가면 화면 작업이 막힘 | 필요 시 `src/mocks/` 복사로 복구 가능(원본은 5단계까지 보존) |
| Tailwind v4 + Next 설정 | 현재 `@tailwindcss/vite` 플러그인 사용 중 | PostCSS 방식으로 전환 |
| mypage·seller 대형 페이지 | 각 2,000줄 이상, 치환 누락 위험 | 4단계에서 페이지 단위로 나눠 진행, 매번 빌드 검증 |

## 6. 열린 질문 (진행 중 결정)

- 상품 상세를 SSR로 할지 ISR(정적 재생성)로 할지 — 2단계에서 상품 데이터 갱신 빈도 보고 결정. 재고·가격이 자주 바뀌면 SSR, 아니면 ISR + revalidate
- 브랜드 필터 URL 구조 — 3단계에서 SEO 관점으로 결정
- **EC2 컨테이너 네트워크 구성** — host 네트워크인지 bridge+compose인지. prod 프록시 대상 주소(`127.0.0.1` vs 서비스명)와 서버 fetch base URL이 이것에 달림. 5단계 전 확인 (2단계 SSR을 로컬에서 배포 백엔드로 붙여 개발하는 데는 지장 없음)

~~배포 환경의 Node 런타임 지원 여부~~ → 해소(2026-07-28). Docker+EC2라 컨테이너 안에서 Node 구동은 정의상 가능함 (위험 요소 표 참조)
