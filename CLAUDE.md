# CLAUDE.md — jarvis-web (프론트엔드)

## 프로젝트
- AI Shopping Agent "나비스(Narvis)"의 프론트엔드. 자연어 채팅으로 상품을 탐색·추천받는 쇼핑몰
  - 서비스명은 2026-08-07에 자비스→나비스로 바뀌었다. **저장소 키·레포명의 `jarvis-`는 그대로 둔다**
    — 키를 바꾸면 기존 사용자의 로그인·채팅 세션이 통째로 날아간다(authStore.ts 주석 참조)
- 부트캠프 최종 프로젝트, **프론트 1인 체제** — 단순함과 일관성이 최우선
- 백엔드는 Spring Boot로 분리. 프론트는 **Next.js(App Router)** 이며, SEO가 필요한 공개 페이지만 SSR하고 나머지는 클라이언트 렌더
- 챗봇 2개(상품 추천 / 판매자 분석)는 단일 채팅 API를 공유하는 공통 모듈로 구현
  (문의 챗봇은 폐기 — `CS` 채널은 2026-08-11 CH-1 개정으로 계약에서도 빠졌고
   `ChatChannel` 타입에서 제거했다. 보내면 400)

## 명령어
- `npm run dev` — 개발 서버 (**포트 3000 고정** — 백엔드 CORS가 `http://localhost:3000`만 허용)
- `npm run build` — 프로덕션 빌드. **이게 진짜 게이트다** (타입 검사 포함)
- `npm run start` — 프로덕션 서버 / `npm run lint` / `npm run test` (vitest)
> 변경 후 검증: `npm run build`. tsc만으로는 놓치는 에러가 있다

## 기능 명세
- 페이지별 목적·핵심 기능은 `docs/features.md` 참조. 페이지 작업 시 해당 섹션을 먼저 읽고, 이번 세션에서 만들 범위는 프롬프트로 별도 지정받는다

## 문서 (`docs/README.md`가 색인)
이 파일은 **규칙 요약**이고, 구조와 그 근거는 아래에 있다. 해당 영역을 건드리기 전에 읽을 것.
- `docs/architecture-chat.md` — 세 갈래 통신 경로 · SSE 11종 · 경로 B · 세션/멀티탭 · CH-7 승계 · 판매자 draft/report
- `docs/architecture-auth.md` — 쿠키 전환 후 구조 · 부팅 복원 · 401 2종 규약 · 가드
- `docs/architecture-data.md` — 쿼리 키 · staleTime 근거 · **SSR `initialData` 함정** · 무효화 · 로컬 프록시
> 코드가 정본이다. 문서와 어긋나면 코드를 믿고 문서를 고친다

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
- **원칙**: 같이 수정될 것들은 같이 둔다. 페이지 전용은 페이지 폴더에, 공용이 된 순간에만 shared로 옮긴다

## 컴포넌트 (2계층)
- **순수 UI (shared/ui)**: 도메인을 모른다. 도메인 객체 대신 원시값/노드만 받는다.
  `<PriceText value={n}>` O / `<PriceText product={p}>` X. 도메인을 아는 공용 모듈은 `shared/<도메인>/`(chat·address)
- **도메인·페이지 컴포넌트**: 도메인 상태를 props로 내려받지 않고 도메인 훅(`useCart()`, `useProduct(id)`)으로 직접 접근한다.
  이유: 호출 위치가 자주 바뀌므로 props 드릴링은 중간 컴포넌트 연쇄 수정을 부른다
- **컴포넌트에서 axios 직접 호출 금지.** 반드시 shared/api 함수 → 도메인 훅 경유

## 상태 구분
- **서버 원본 데이터**(상품/장바구니/주문/찜) → React Query. useState로 복제 금지
- **클라이언트 상태** → Zustand: 인증(authStore — user만 localStorage persist, **토큰은 저장하지 않는다**), 현재 챗봇 대화(sessionStorage에 탭 단위 저장 — `chatPersistence`), UI 상태
  - 챗 대화를 **탭 단위**로 잡은 이유: 서버 맥락 TTL이 10분(sliding)이라 그보다 오래 남기면
    화면엔 대화가 있는데 AI는 기억 못 하는 어긋난 상태가 길어진다. 탭 수명이 세션 수명과
    대체로 겹쳐 그 간극이 가장 작다. "새 대화"는 저장소도 함께 비운다
- **폼** → React Hook Form + Zod. 검증 규칙은 백엔드 필드 정의와 일치시킬 것

## React Query 규칙
- Query Key 배열 컨벤션(소문자 세그먼트): `['cart']` `['orders', {status}]` `['categories']` `['addresses']` `['products', 'recent']`
- 상품 키는 2벌: `['products', id]`(카드 시딩) / `['products', id, 'detail']`(상세) — 응답 구조가 달라 분리
- staleTime: 정적 데이터(카테고리·브랜드) 30분 / 인기상품·홈 추천 5분 / 상품 상세 5분 / 장바구니·주문 0
  (인기상품·홈 추천 5분 근거: BE Redis 캐시와의 합산 낡음 상한 — 인기상품 합 8분, 개인화 합 15분)
- 장바구니 변경 성공 시 `invalidateQueries(['cart'])` — **챗봇 CART_ADDED 수신 시에도 동일**
- **캐시 승계**: 카드 → 상세 진입은 `useGoToProduct()`(shared/hooks) 경유
- 목록/상세/브랜드는 스피너 단독 금지 → 스켈레톤 기본
- **⚠️ SSR `initialData`는 "서버가 렌더한 그 조합"에만 넣는다.** 모든 쿼리 키에 그대로 주면
  필터를 바꿔 새 키가 생겼을 때도 옛 데이터가 초기값으로 들어가고, staleTime 때문에
  **재조회조차 하지 않는다**(브랜드 필터에서 실제로 겪음 — `useBrandHome`의 `serverQuery` 참조)

## 루트 라우트 (2026-08-12 전환)
- **`/` = 랜딩**(서비스 소개, 소비자/판매자 탭 `?tab=`) / **`/home` = 쇼핑몰 홈**(인기·추천 상품)
  - 주소창에 도메인만 친 사람은 서비스를 모르는 경우가 많아 루트에서 먼저 설명한다
  - 구 `/landing`은 `next.config.ts`의 **308 영구 리다이렉트**로 `/`에 흡수(공유 링크 보존)
  - **로그아웃 → `/`**(비로그인이니 소개가 맞다) / **로그인·역할불일치 → `/home`**(이미 쓰던 사람)
  - ⚠️ `SellerIsolation`의 허용 목록에 `/`를 **접두사로 넣지 말 것** — 전 경로가 통과해
    격리가 무력화된다. 루트는 `ALLOWED_EXACT`(정확 일치)로 분리돼 있다
  - ⚠️ `analytics/pageType.ts`는 `/home`을 `home`으로 잡는다. 루트는 발화하지 않는다 —
    `PageType`이 E-1 계약 어휘 14종이라 landing 항목이 없다(임의로 만들면 서버가 드롭)

## SSR 경계
- **SSR하는 것**: 상품 상세·브랜드·홈(`/home`) — 전부 공개 라우트라 인증 없이 서버에서 조회 가능
- **하지 않는 것**: mypage·checkout·seller — 인증이 필요하고, 가드·세션 복원 흐름이 클라이언트 기준이다
  (AT가 httpOnly 쿠키가 된 뒤로 "서버가 못 읽어서"는 이유가 아니게 됐지만, 결론은 그대로 유지)
- `shared/api/client.ts`(axios)는 **클라이언트 전용** — authStore·`window.location`을 참조한다.
  서버 컴포넌트는 `shared/api/server.ts`(`server-only`, 인증 없는 공개 API 전용)를 쓴다
- 서버 fetch에는 5초 타임아웃이 있다 — 없으면 백엔드에 못 닿는 CI에서 빌드가 무한정 매달린다

## 인증/권한 (구현: src/shared/auth/guards.tsx, src/shared/api/client.ts, src/shared/stores/authStore.ts)
- 계정 3종: USER / SELLER / ADMIN (백엔드 role enum과 일치). 라우트 가드에서 역할별 접근 제어 (RequireAuth, RequireRole)
- 게스트: 탐색·챗봇·**장바구니 담기**까지 가능(횟수 제한 없음, 개인화만 미적용). 구매·찜·마이페이지는 로그인 필요
- **게스트 승계는 `guest_id` 쿠키로 서버가 자동 처리** — FE는 `withCredentials`로 쿠키가 실리는 것만 보장
- 미인증 접근 → `?returnUrl=` 붙여 /login, 로그인 후 복귀
- **AT·RT 모두 httpOnly 쿠키다**(2026-08-06 전환, `05e6b46`). AT `Path=/` · RT `Path=/api/auth`.
  **JS가 토큰 값을 볼 수 없고 볼 필요도 없다** — 따라오는 결과 3가지:
  - 브라우저가 자동 첨부하므로 **Authorization을 다는 요청 인터셉터가 없다.** 대신 `withCredentials: true`가 필수
  - refresh 응답 **body에서 토큰을 꺼내지 않는다** — 새 AT는 `Set-Cookie`로 온다. 호출 성공 자체가 "AT가 심겼다"는 신호
  - **"AT를 갖고 있는가"를 FE가 직접 판정할 수 없다** → `selectIsAuthReady`가 필요해진 이유
- 401은 **code 2종으로 갈린다**(2026-07-18 규약). status만으로 분기하지 말 것:
  `AUTH_TOKEN_EXPIRED` → refresh 1회 재시도(`_retry` 플래그로 1회 제한) /
  `AUTH_REQUIRED` → 재발급 여지 없음, 즉시 로그인 유도. **이 로직은 shared/api에만 존재**
- 새로고침 시 `useRestoreSession`(app/providers.tsx)이 refresh → `/api/auth/me`로 복원.
  refresh는 **raw axios로 부른다**(인터셉터를 타면 게스트가 401에서 /login으로 튕긴다)
- **가드를 `proxy.ts`(구 middleware)로 옮기지 않는다** — 쿠키가 되어 서버도 읽을 수는 있지만,
  가드·복원 흐름이 클라이언트 기준이고 이중 관리가 된다. 클라이언트 가드 + 백엔드 최종 방어를 유지
- **persist된 user는 신뢰 경계가 아님** — role 판정은 `me` 응답으로 덮어쓴다
- 복원 중(`isRestoring`)에는 가드가 판정을 보류 — 없으면 새로고침마다 로그인으로 튕긴다
- **인증 필요 쿼리의 `enabled`는 `selectIsAuthReady`(복원완료 + user 존재) 필수** —
  복원 중에 true를 주면 만료된 AT로 요청이 나가 401 → refresh 폭주
- 복원 경로의 401은 리다이렉트 대상이 아님 — `fetchMe`는 `NO_AUTH_REDIRECT`로 호출
- **수집(analytics)은 이 경로를 공유하지 않는다** — `api` 인스턴스를 쓰면 배경 작업의 401이
  사용자를 로그인으로 튕긴다. 재전송 대상은 **401 하나뿐**(→ `docs/analytics-401-retry.md`)

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
- `/internal`은 nginx가 프록시 중 — AI 서버가 ALB 경유로 호출해서, 차단하면 상품 검색이 죽는다.
  내부망 직행으로 바꾸려면 보안그룹 작업이 선행되므로 임의로 막지 않는다

## 챗봇 공통 모듈 (src/shared/chat, 타입: src/shared/types/chat.ts)
- 챗봇은 단일 API를 `channel`(SHOPPING|SELLER)만 바꿔 공유. 공통 모듈 + 채널별 렌더러 주입
  (`CS`는 2026-08-11 폐기 — 타입에서도 제거했다. 유효한 값은 SHOPPING·SELLER 2종)
- 와이어는 `data: {"type":..,"data":{..}}` envelope 한 줄 — **`event:` 줄을 쓰지 않는다**. 이름이 아니라 `payload.type`으로 분기
- 이벤트 **11종** — 공통 3(`token` append / `done` / `error` 종결) + 구매자 4(`conditions` 제거 가능 칩 /
  `suggestions` 완화 제안 / `products.ready` 상관키 / `action`) + 판매자 3(`meta` 레인 / `draft` HITL 초안 /
  `report` 분석 리포트) + `progress`(채널 공용, 페이로드만 다름)
  - **`progress`는 채널별로 페이로드가 다르다** — 구매자 `{stage,message?}` / 판매자 `{text}`. 수신부가 분기해야 한다
  - **stage 어휘는 개방형이다** — 알려진 7종(`analyzing` `mapping` `expanding` `searching` `relaxing`
    `reranking` `publishing`)은 자체 문구를 가진 것들일 뿐 **허용 집합이 아니다**. 계약이 "모르는 stage는 무시"를
    명문화했으므로 닫힌 유니온으로 두지 않는다
  - **`progress` 도착을 전제하지 않는다** — 0회인 턴이 있다(첫 프레임이 `error`이거나 스트림이 안 열림).
    2026-08-06 다단계화로 **다회 나갈 수 있다**
  - **`token`이 progress를 지우면 안 된다** — `publishing`은 근거 token 뒤 `products.ready` 직전에 온다.
    여기서 지우면 그 한 종이 영영 화면에 닿지 못한다. 정리는 `done`·finally가 맡는다
  - **`report`는 도착 즉시 반영하지 않는다** — 커밋 신호는 `done{panel:"replace"}`다. 바로 꽂으면
    report 뒤 `error`로 끝나는 스트림에서 실패한 턴의 리포트가 패널에 남는다
- **SSE는 nginx·Next를 타지 않는다** — 세션 발급(`POST /api/chat/sessions`)으로 받은 `llmSseUrl`(AI 서버 절대 URL)에 `streamChat`이 직접 fetch한다. AI 서버가 이 앱 오리진에 CORS를 열어줘야 한다
- **EventSource 금지** — POST+body이므로 `streamChat`의 fetch 스트리밍으로 파싱
- 조건 칩 X 제거 = 요청 body의 **`conditionActions`** 배열(`{op:"remove",field,value?}`). 규약 문자열(`[조건 제거] …`) 왕복은 폐기됨
  - **⚠️ `field`는 칩을 유일하게 가리키지 않는다** — category·brand는 **값당 칩 1개**라 같은 field가 여러 개 온다(v0.32.14).
    칩을 특정하려면 **`(field, value)` 쌍**이 필요하다. field만 보고 지우면 카테고리 하나를 눌렀는데 전부 사라지고,
    React key도 `` `${field}:${value}` ``여야 한다(중복 키는 엉뚱한 칩이 사라져 보인다)
  - `value` 생략 시 그 축 전체 제거. 값이 하나뿐인 축(priceMax 등)은 서버가 value를 무시하고 축을 통째로 지운다
  - **`message`와 `conditionActions`가 둘 다 비면 400.** 칩 제거만 있는 턴은 사용자 말풍선을 남기지 않는다(제어 신호)
  - 제안 칩(`suggestions`)은 방식이 다르다 — label을 그대로 message로 보내는 왕복이다
- **카드는 SSE에 없다(경로 B)** — `products.ready`의 `listIds`(항상 배열)로 CH-5를 목록별 조회한다. 조회한 카드는 완전한 데이터라 상세 캐시 시딩용 — 카드 표시 위한 재조회 금지
- `action.type` **10종** — 장바구니 담기·삭제·수량변경, 찜 추가·해제(각 성공/실패) + 판매자 수정 2종.
  성공 시 해당 쿼리 무효화(`['cart']`·`['wishlist']`) — 판정은 `isCartMutatingAction`/`isWishlistMutatingAction`(shared/types/chat) 경유.
  **찜 이벤트엔 productId가 없다**(경로 B) → 목록 재조회만 가능. `message`는 AI가 조립한 노출 문구라 그대로 표시하고 파싱·하드코딩 금지
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
  - 색상: primary(검정)/배경(흰색)/회색 2~3단/포인트(할인 빨강·별점 노랑)/brand(블루 `--brand` `#2a63b8` —
    AI 기능 강조 전용) 외 금지. 2026-08-10에 청록에서 바꿨다 — 로고에 없는 색이라 다른 서비스처럼 보였다.
    **알파를 섞지 말 것** — 면색으로 쓰여서 흰 글자 대비가 무너진다(한때 2.02:1까지 떨어졌음)
  - radius: 버튼·칩 `rounded-full`, 카드·이미지·입력 `rounded-sm` (이 2단계 외 금지)
  - 폰트: Pretendard / 간격: 정의된 스케일만 (임의 px 금지)
- 시안에 없는 상태(로딩/에러/빈 상태)는 기존 페이지 패턴을 따라 통일

## 반응형 (모바일 우선)
- **모든 페이지는 모바일(≥360px)부터 대응.** 시안이 데스크탑 기준이어도 좁은 화면에서 깨지지 않게 구현
- 기본값은 모바일, 넓어질 때 `sm:`/`md:`/`lg:`로 확장 (Tailwind 기본 breakpoint)
- 컨테이너는 `w-full` + `max-w-*` / 여백도 반응형으로 (`p-6 sm:p-8`)
- 가로 스크롤 금지 — 넘칠 수 있는 요소는 `overflow-x-auto`
- 터치 타겟 최소 `h-11`, 화면 가장자리에 붙지 않게 좌우 여백 유지

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
- **인프라 구조(nginx·컨테이너·워크플로)는 바꾸기 전에 반드시 먼저 묻는다**
  — 이식 중 nginx를 임의로 제거해 3중 방어가 깨진 적 있음 (팀 아키텍처 문서는 레포 밖에 있음)

## 미확정 (정해지면 이 문서 갱신)
- sessionId 10분 TTL 만료 시 응답/재발급 스펙
- 판매자/관리자 계정 생성 방식 (별도 가입 vs DB 시드)
