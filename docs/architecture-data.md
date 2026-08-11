# 데이터 계층 — 쿼리 키·캐시·SSR 경계의 판단 기준

> "이 데이터를 어디에 두고, 얼마나 믿고, 언제 다시 부를까"에 대한 이 프로젝트의 답.
> 규칙 자체는 CLAUDE.md 에 요약돼 있고, 여기엔 **왜 그 값인지와 실제로 겪은 사고**를 적는다.
>
> 함께 볼 것: `architecture-auth.md`(인증 쿼리의 `enabled`) · `architecture-chat.md`(챗 액션 무효화)

## 0. 상태를 어디에 둘지 — 4갈래

| 성격 | 도구 | 예 |
|---|---|---|
| 서버 원본 데이터 | **React Query** | 상품·장바구니·주문·찜 |
| 클라이언트 상태 | **Zustand** | 인증(`authStore`), 현재 챗 대화, UI 상태 |
| 폼 | **RHF + Zod** | 로그인·가입·배송지 |
| 화면 간 전달 | **sessionStorage** | `checkoutHandoff`(Next 엔 `navigate(state)` 가 없다) |

**서버 데이터를 `useState` 로 복제하지 않는다.** 복제하는 순간 무효화가 안 먹는다.

---

### QueryClient 는 `useState` 로 만든다

```ts
const [queryClient] = useState(() => new QueryClient());
```

> 모듈 스코프에 두면 **서버 렌더 환경에서 요청 간에 공유되어 사용자끼리 캐시가 섞인다.**

**전역 `defaultOptions` 가 없다.** staleTime·retry 는 라이브러리 기본값(0, 3회)이고
각 훅이 개별 지정한다 — 그래서 §2 의 값들을 훅마다 명시해야 한다.

---

## 1. 쿼리 키 — 실제 사용 목록

소문자 세그먼트 배열. 변수는 객체로 묶어 마지막에 둔다.

```
['cart']                                   ['wishlist']
['categories']                             ['addresses']
['orders', {page,size}]                    ['orders', orderId]
['claims', {page,size}]
['products', 'recent']                     ['products', 'popular', size|null]
['products', 'recommended', userId]
['products', id]                           ← 카드 시딩
['products', id, 'detail']                 ← 상세
['products', id, 'reviews', {page,size,sort}]
['brands', brandId, {category,sort,page}]
['chat', 'popular']
['seller', 'summary', from, to]            ['seller', 'orders', {tab,page}]
['seller', 'products', {tab,sort,page}]
```

### 상품 키가 2벌인 이유

**응답 구조가 다르다.** 같은 키를 쓰면 캐시가 섞여 렌더가 깨진다.

| 키 | 내용 | 특징 |
|---|---|---|
| `['products', id]` | 카드(부분): `brandName`, `rating: number` | **queryFn 없음** — `setQueryData` 전용 슬롯 |
| `['products', id, 'detail']` | 상세(정본): `brand.name`, `rating: {average,count}` | 실제 조회 |

카드 → 상세 진입은 **`useGoToProduct()`** 경유로 캐시를 승계한다.
인자 타입이 `SeededProductCard` 라 **필드 누락을 컴파일 타임에 막는다**
(누락되면 상세 렌더가 크래시한다). 카드가 그 타입을 못 채우면 시딩 없이 이동할 것.

**⚠️ 읽는 쪽의 기대치가 통일돼 있지 않다.** 주문 상세는 후기 작성용으로 4개 필드만
심고, 읽는 쪽이 `Partial<ProductCard>` 로 받는다. 이 슬롯에서 필드를 꺼낼 땐
없을 수 있다고 보고 써야 한다.

### 시딩 슬롯은 `useQuery` 로 읽지 않는다

`useSeededProductCard` 는 `useSyncExternalStore` + `queryCache.subscribe` 를 쓴다.

> 이 쿼리는 네트워크 요청이 없어 queryFn 을 줄 수 없는데, `useQuery` 는
> `enabled:false` 여도 **queryFn 부재를 에러로 본다**(시딩 없이 URL 직접 진입 시 콘솔 에러).

### `['seller','summary', from, to]` — 날짜를 마운트에 고정한다

> 마운트 시점에 한 번 고정한다 — 렌더마다 새로 만들면 queryKey 가 흔들려 재조회가 돈다.

`new Date()` 를 렌더 본문에서 계산해 키에 넣으면 **매 렌더가 새 키**가 된다.
무한 재조회의 전형적인 원인이다.

---

## 2. staleTime — 값의 근거

| 대상 | 값 | 근거 |
|---|---|---|
| 카테고리·브랜드 | **30분** | 시드로만 바뀌는 정적 데이터 |
| 인기상품 | **5분** | BE Redis 캐시(3분)와 **합산 낡음 상한 8분** |
| 홈 개인화 추천 | **5분** | BE 가 P-5 를 10분 캐시 → **합산 15분** 안에 행동이 반영 |
| 상품 상세 | 5분 | |
| 장바구니·주문·클레임 | **0** | 상태가 바뀌는 데이터 |
| 취향 프로필(M-11) | **0** | 서버가 원본이고 **버전 충돌(409)** 이 있다 |

**핵심 사고방식: FE staleTime 은 단독으로 정하지 않는다.**
BE 캐시 TTL 과 더한 값이 "사용자가 볼 수 있는 최대 낡음"이고, 그게 허용 범위여야 한다.

서버 컴포넌트의 `revalidate` 도 **클라이언트 staleTime 과 같은 값**으로 맞춘다 —
서버·클라이언트가 다른 판단을 하면 화면이 어긋난다.

챗 화면의 인기상품도 홈과 같은 P-4 라 5분으로 맞춘다:
> 값이 다르면 두 화면의 인기상품이 어긋나 보인다.

---

## 3. ⚠️ SSR `initialData` 함정 — 실제로 겪은 사고

**2026-07-28, 브랜드 페이지에서 "정렬이 안 먹는다"로 나타났다.**

### 무슨 일이 있었나

SSR 결과를 `initialData` 로 **모든 쿼리 키에 그대로** 넘겼다. 그랬더니:

1. 사용자가 정렬을 바꾼다 → **새 쿼리 키**가 생긴다
2. 그 새 키에도 옛 `initialData` 가 초기값으로 들어간다
3. `staleTime` 30분이라 **fresh 로 간주** → **재조회조차 하지 않는다**
4. 화면이 안 바뀐다

스피너도, 에러도 없다. 그냥 조용히 옛 데이터가 눌러앉는다.

### 해결 — "서버가 렌더한 그 조합"에만 승계

```ts
const isServerRenderedCombo =
  serverQuery !== undefined &&
  JSON.stringify(normalize(query)) === JSON.stringify(normalize(serverQuery));

initialData: isServerRenderedCombo ? initialData : undefined,
```

`serverQuery`(서버가 SSR 에 쓴 조합)를 함께 받아 **지금 조합과 같을 때만** 넘긴다.
`normalize()` 로 기본값을 채워 비교하는 게 중요하다 — `undefined` 와 `"popular"` 가
같은 뜻인데 문자열 비교로는 다르게 나온다.

**일반화: `initialData` 는 키에 종속된 값이다. 키가 달라지면 줄 수 없다.**

부수적으로 `placeholderData: keepPreviousData` 를 함께 쓴다 —
칩을 누를 때마다 목록이 스켈레톤으로 깜빡이지 않게.

### 같은 파일의 또 다른 함정

```ts
enabled: brandId.length > 0,
// brandId 는 문자열이다 — Number.isFinite 를 쓰면 항상 false 가 되어 쿼리가 안 돈다
```

§7 의 64비트 ID 문자열화와 같은 뿌리다.

---

### SSR 데이터를 넘기는 방식이 3가지다 — 쿼리 개수로 고른다

| 화면 | 쿼리 수 | 방식 | 이유 |
|---|---|---|---|
| 상품 상세 | 1개 | `initialData` | 키에 가변 축이 없어 안전 |
| 브랜드 | 1개 + **가변 조합** | `initialData` + **조합 검사** | 위 함정 |
| 홈 | 여러 개 | **`HydrationBoundary`** | 하위가 각자 훅으로 가져온다 |

홈이 다른 이유:

> 홈 하위 컴포넌트들은 훅으로 각자 데이터를 가져온다(props 드릴링 대신 도메인 훅).
> 그 구조를 유지한 채 SSR 데이터를 주려면 **캐시에 심어야** 하므로 HydrationBoundary 를 쓴다.

이때 **prefetch 키가 클라이언트 훅의 키와 정확히 같아야 한다** —
`['products','popular', null]` 의 `null` 이 `size ?? null` 과 일치해야 심은 게 쓰인다.
prefetch 는 각각 `.catch(() => {})` 로 감싼다 — 한쪽이 실패해도 홈 전체가 죽지 않게.

---

## 4. 무효화 규칙

| 사건 | 무효화 |
|---|---|
| 장바구니 변경 성공 | `['cart']` |
| **챗봇 CART_ADDED 등 수신** | `['cart']` — **동일하게** |
| 찜 변경 / 챗 찜 액션 | `['wishlist']` |
| 주문 생성 | `['orders']`, `['products', productId]` |
| 클레임 신청 | `['claims']`, `['orders']` |
| 판매자 수정 | `['seller']` (접두 일치로 하위 전부) |

**챗봇 경로가 같은 무효화를 타는 게 핵심이다.** AI 가 담아준 것도 서버 상태 변경이라,
빼먹으면 장바구니 뱃지가 안 바뀐다.

판정은 `isCartMutatingAction` / `isWishlistMutatingAction` 으로만 한다(→ `architecture-chat.md` §6).

### 낙관적 업데이트 — cancelQueries 가 먼저다

```ts
await queryClient.cancelQueries({ queryKey: ["cart"] });
```

이걸 빼면 진행 중이던 조회가 나중에 도착해 **낙관적 갱신을 덮어쓴다.**
`useWishlist` 에는 이 동작을 고정하는 테스트가 있다(`wishlistOptimistic.test.ts`).

`onSettled` 에서 다시 무효화해 서버 값으로 수렴시킨다.

### 찜 낙관적 갱신의 경계 조건 3개

`applyWishlistToggle` 을 훅 밖으로 꺼내 테스트로 고정했다.

> 경계 조건이 셋이라 인라인으로 두면 검증할 수가 없다:
> - 목록 캐시가 **아직 없으면(undefined) 만들지 않는다.** 빈 배열을 세우면
>   "찜이 이것뿐"이라고 단정하는 셈이라 찜 목록 화면이 잘못 그려진다
> - 이미 있는 상품은 **중복 삽입하지 않는다**(연타·중복 이벤트)
> - 추가인데 seed 가 없으면 건드리지 않는다 — 서버 재조회에 맡긴다

삽입은 **맨 앞**이다 — 찜 목록이 최신순이라 재조회 결과와 순서가 어긋나지 않게.
원본 배열을 변형하지 않는 것(React Query 캐시 불변성)도 테스트가 지킨다.

**`pendingWished` 가 따로 있는 이유:**

> 목록 캐시에서 파생하는 `useIsWished` 만으로는 부족하다 — 찜 목록을 아직 한 번도
> 받지 않았으면(챗 화면 첫 방문) 낙관적 삽입이 생략되고, **하트가 서버 응답까지
> 아무 반응을 안 한다.**

### 토스트는 mutation 콜백에서 띄운다

> mutation 상태(`isSuccess`)를 이펙트로 관찰하면 `onSettled` 의 재조회가 리렌더를
> 유발해 상태가 갈아엎히고, 이펙트가 읽기 전에 사라져 **토스트가 안 뜨는 경쟁**이 생긴다.

### 404 를 뭉치지 말 것

> 찜 추가의 `PRODUCT_NOT_FOUND`(없는 상품)도 404라 status 로만 판정하면
> **진짜 실패를 성공으로 오인해 하트가 켜진 채 남는다.**

코드로 분기한다(`WISHLIST_DUPLICATE`·`WISHLIST_NOT_FOUND` 는 성공 취급).

---

## 5. SSR 경계 — 무엇을 서버에서 렌더하나

| | 대상 | 이유 |
|---|---|---|
| **한다** | 상품 상세 · 브랜드 · 홈 | 공개 라우트 — 인증 없이 서버가 조회 가능. SEO 필요 |
| **안 한다** | mypage · checkout · seller | 인증 필요 — 가드·복원 흐름이 클라이언트 기준 |

### 클라이언트용과 서버용 API 모듈이 다르다

| | `shared/api/client.ts` | `shared/api/server.ts` |
|---|---|---|
| 대상 | 브라우저 전용 | 서버 컴포넌트 전용 |
| 근거 | `authStore`·`window.location` 참조 | `server-only` |
| 인증 | 쿠키 자동 첨부 | **없음** — 공개 API 전용 |

**서버 fetch 에는 5초 타임아웃이 있다.**

> CI 컨테이너 안에는 백엔드가 없으므로 홈 정적 생성이 60초 타임아웃에 걸려
> **`next build` 자체가 실패한다**(실제로 겪음).

같은 문제의 **두 번째 방어선**이 홈의 `export const dynamic = "force-dynamic"` 이다.
데이터는 `serverApi` 가 30분 재검증으로 캐시하므로 매 요청 조회하지는 않는다.

### 봉투 타입을 복제해 둔 이유 (import 하지 않는다)

```
// client.ts는 클라이언트 전용 모듈(axios 인스턴스·authStore·window 참조)이라
// 타입만 import해도 모듈 그래프가 이어져 'server-only'가 클라이언트 번들로 샌다.
```

**타입만 가져와도 샌다**는 게 핵심이다. 계약이 바뀌면 양쪽을 같이 고쳐야 한다.
`src/pages/` 를 쓰지 않는 규칙도 같은 뿌리다.

### `cachedGet` — 인자는 반드시 원시값

`generateMetadata` 와 `page` 가 같은 데이터를 부르면 요청당 API 가 2번 나간다.
React `cache()` 로 한 렌더 패스 안의 동일 호출을 1회로 합친다.

**⚠️ `cache()` 는 인자를 참조 동등성으로 비교한다.** 객체를 그대로 넘기면 매번 다른
인자로 취급돼 **중복 제거가 안 된다.** 그래서 브랜드는 쿼리 조합을 `URLSearchParams`
문자열로 눌러 넘긴다.

### SSR 실패는 페이지를 죽이지 않는다

- 404 → `notFound()`
- 그 외 → **초기 데이터 없이 렌더**하고 클라이언트가 재조회한다
- `generateMetadata` 실패는 페이지를 막지 않는다 — 본문 렌더가 404 를 판단한다

SSR 조회는 브라우저 네트워크 탭에 안 잡히므로(서버가 부른다) dev 터미널에
`[ssr →]`·`[ssr ←]`·`[ssr ✕]` 로 남긴다. 본문은 `SSR_LOG_BODY` 스위치로 켠다
(`NEXT_PUBLIC_` 을 안 붙인다 — 붙이면 클라이언트 번들에 값이 박힌다).

---

## 6. 로컬 개발 프록시 — 배포엔 없는 경로

`src/app/api/[...path]/route.ts` 는 **로컬 개발 전용**이다.

배포에서는 nginx 가 `/api` 를 처리해 여기까지 오지 않는다.
로컬엔 nginx 가 없어 이 핸들러가 그 역할을 대신하고, **dev 에서 `Set-Cookie` 의
`Secure` 속성을 떼어** 로컬 http 에서도 refresh 가 되게 한다.

`Secure` 쿠키는 https 에서만 저장되므로, 이게 없으면 **로컬에서 로그인 유지가 안 된다.**

환경변수:

| 변수 | 용도 |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | 브라우저용. **빌드 시점 주입**, 빈 값이면 상대경로 |
| `API_PROXY_TARGET` | 로컬 프록시 대상 |

### `rewrites()` 를 쓰지 않은 이유

> Route Handler 는 파일시스템 라우트라 rewrites 보다 **먼저 매칭되어** 둘을 환경별로
> 나눠 쓸 수 없고, rewrites 로는 **응답 헤더(Set-Cookie) 조작도 못 한다.**

### 프록시가 처리하는 것 4가지

1. **Hop-by-hop 헤더 제거**(RFC 7230). `content-length` 도 포함 — 스트림 전달 시
   실제 길이와 어긋날 수 있어 fetch 가 다시 계산하게 둔다.
2. **`content-encoding` 응답 제거.** fetch 가 이미 압축을 풀어 body 에 담는데 이 헤더를
   넘기면 브라우저가 평문을 또 풀려다 `ERR_CONTENT_DECODING_FAILED` 로 실패한다.
   **curl 로는 재현되지 않는다**(Accept-Encoding 을 기본으로 안 보냄) — 브라우저에서만 드러난 버그.
3. **다중 Set-Cookie.** 한 응답에 여러 개가 올 수 있다(AT 갱신 + RT 재발급 동시).
   `headers.get()` 은 콤마로 합쳐 값이 깨지므로 **`getSetCookie()`** 로 개별 처리한다.
4. **스트리밍 유지.** `duplex:"half"`(Node fetch 필수), `redirect:"manual"`, 버퍼링 없이 흘림.

SSE 는 이 경로를 타지 않는다(→ `architecture-chat.md` §1).

---

## 6-1. `next.config.ts` — 설정하는 게 딱 둘

`output: "standalone"` + **보안 헤더 4종**(전 경로):
`X-Frame-Options: DENY` · `X-Content-Type-Options: nosniff` ·
`Referrer-Policy: strict-origin-when-cross-origin` ·
`Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`

> nginx 는 앞단에 그대로 있지만 **헤더는 여기서만 붙인다.**
> 양쪽에서 붙이면 응답에 중복으로 실리고, 로컬(nginx 없음)에서도 동일하게 적용된다.

**없는 것도 알아둘 것:**

- **CSP 없음** — 보안 헤더 4종에 포함돼 있지 않다.
- **`images.remotePatterns` 없음** — 그래서 상품 이미지는 `next/image` 가 아니라
  일반 `<img>` 를 쓴다(`next/image` 사용처는 랜딩 헤더 1곳뿐). 도입하려면
  S3 호스트 등록이 **선행**돼야 한다.

---

## 7. 반복해서 물리는 함정들

### 64비트 ID 는 문자열이다

`productId`·`optionId`·`brandId` 전부 string.
`Number()` 로 파싱하면 **끝자리가 조용히 바뀐다** — JS number 는 2^53 까지만 정확하다.
커밋 `b72f0e9`·`6dd5241` 에서 실제로 고쳤다.

`Number.isFinite(id)` 같은 검증을 쓰면 항상 false 가 되어 쿼리가 아예 안 돈다.

### 컴포넌트에서 axios 직접 호출 금지

반드시 `shared/api` 함수 → 도메인 훅 경유.
인터셉터(봉투 언래핑·401 재시도)가 `shared/api` 에만 있어서, 우회하면 그 처리가 전부 빠진다.

### 도메인 상태는 props 로 내리지 않는다

`useCart()`·`useProduct(id)` 로 직접 접근한다.
**호출 위치가 자주 바뀌므로 props 드릴링은 중간 컴포넌트 연쇄 수정을 부른다.**

### 목록/상세/브랜드는 스켈레톤이 기본

스피너 단독 금지.

### `useSearchParams` 는 SSR 을 죽인다

→ `architecture-auth.md` §6. 쿼리값이 **렌더**에 필요한지 **이벤트/이펙트 시점**에만
필요한지로 가른다. 후자면 그 시점에 `window.location.search` 를 읽는다.

화면 내 쿼리 갱신은 `router.push` 가 아니라 **`window.history.pushState`**
(`useQueryParams` 훅) — `router.push` 는 페이지 이동이라 주소창이 즉시 반영되지 않는다.

---

## 8. 검증

```bash
npm run build     # ← 진짜 게이트. tsc 만으로는 놓치는 에러가 있다
npm run test      # vitest — 테스트 22개
```

테스트는 **판단이 느슨해지면 조용히 깨지는 곳**에 집중돼 있다:
`wishlistOptimistic` · `retry`(401 한정) · `conditionRemoval` · `claimOnLogin` ·
`sessionCoordinator` · `chatPersistence` · `progress` · `markdown` · `resizeImage` · `josa`.
