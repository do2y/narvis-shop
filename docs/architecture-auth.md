# 인증 아키텍처 — 토큰을 FE 가 만지지 않게 된 뒤의 구조

> AT·RT 를 **httpOnly 쿠키**로 전환한 뒤(`05e6b46`)의 현재 동작을 정리한다.
> 이 전환으로 "AT 는 메모리에만 둔다"던 종전 설계가 통째로 바뀌었고,
> **CLAUDE.md 에는 아직 옛 서술이 남아 있다**(§8 참조). 코드가 정본이다.
>
> 구현: `shared/stores/authStore.ts` · `shared/api/client.ts` ·
> `shared/hooks/useRestoreSession.ts` · `shared/auth/guards.tsx`

## 0. 핵심 전제 — FE 는 토큰 값을 볼 수 없다

AT·RT 둘 다 httpOnly 쿠키다. **JS 가 읽을 수 없고, 읽을 필요도 없다.**

```
AT  Path=/            → 모든 API 요청에 브라우저가 자동 첨부
RT  Path=/api/auth    → refresh 요청에만 실린다
```

따라오는 결과 3가지:

1. **`Authorization` 헤더를 다는 요청 인터셉터가 없다.** 브라우저가 알아서 붙인다.
   대신 `withCredentials: true` 가 필수다.
2. **refresh 응답 body 에서 토큰을 꺼내지 않는다.** 새 AT 는 `Set-Cookie` 로 온다.
   호출이 성공했다는 사실 자체가 "AT 쿠키가 심겼다"는 신호다.
3. **"AT 를 갖고 있는가"를 FE 가 직접 판정할 수 없다.** → §3 의 우회가 필요해진다.

---

## 1. authStore — 저장하는 건 `user` 하나뿐

```ts
partialize: (s) => ({ user: s.user })
```

`user` 만 localStorage 에 persist 한다. 이건 **헤더 닉네임 등의 초기 깜빡임을
줄이기 위한 캐시일 뿐이며, 신뢰 경계가 아니다.**

> localStorage 는 사용자가 편집 가능하므로 role 을 그대로 믿으면 안 된다.
> 물론 최종 방어선은 백엔드이고, 가드는 UX 차원의 1차 필터다.

**권한 판정은 부팅 시 `/api/auth/me` 응답으로 덮어쓴다.**

### 저장소 키를 `jarvis-` 로 두는 이유

```ts
name: "jarvis-auth",   // 서비스명이 Narvis 로 바뀐 뒤에도 그대로(2026-08-07)
```

바꾸면 기존 사용자의 localStorage 항목을 못 찾아 **전원 로그아웃**된다.
사용자에게 보이지 않는 내부 식별자라 통일할 이득도 없다.

### `version: 2` 마이그레이션이 있는 이유

`partialize` 는 **앞으로의 저장만** 막는다. 과거 버전에서 AT 를 저장한 브라우저가
남아 있으므로, version 을 올려 기존 항목을 마이그레이션한다(= 토큰 폐기).

---

## 2. 부팅 세션 복원 — 새로고침마다 필요하다

AT 가 메모리/스토리지에 없으니, 새로고침하면 쿠키만 남는다.
`useRestoreSession`(app 최상단 1회)이 복원한다.

```
persist 리하이드레이션 대기
  └ user 없음 → 아무것도 안 함 (게스트)
  └ user 있음 → POST /api/auth/refresh
                  ├ 실패 → clearAuth()  (RT 없음/만료 = 비로그인)
                  └ 성공 → GET /api/auth/me
                             ├ 실패 → clearAuth()  (신원 불명)
                             └ 성공 → setUser(me)
finishRestore()  → isRestoring = false
```

**판단 기준 4개가 여기 몰려 있다:**

### ① 리하이드레이션을 기다린다

persist 복원은 비동기라 mount 시점엔 user 가 아직 null 일 수 있다.

> 기다리지 않고 user 를 읽으면 "로그인한 적 없음"으로 오판해 refresh 를 건너뛰고,
> 잠시 뒤 user 만 복원돼 **"user 는 있는데 AT 는 없는" 상태로 굳는다**
> → 인증 쿼리가 전부 막히거나 401 을 맞아 새로고침 때마다 로그인으로 튕긴다.

### ② user 가 없으면 refresh 를 부르지 않는다

게스트는 RT 가 없어 401 이 **정상 응답**이다. 부르면 앱을 열 때마다 콘솔에 에러가 쌓인다.

### ③ refresh 에 `api` 인스턴스를 쓰지 않는다

인터셉터를 타면 401 에서 `/login` 으로 리다이렉트돼 **게스트가 홈에 못 머문다.**
그래서 순수 `axios` 를 직접 쓴다.

### ④ me 를 한 번 더 부른다

persist 된 user 는 편집 가능해서 role 을 그대로 믿으면 가드가 뚫린다.
백엔드가 최종 방어선이긴 하나 **화면이 열리는 것 자체는 막아야 한다.**

### StrictMode 대응

이펙트가 2회 실행된다. 그대로 두면 refresh 가 두 번 나가고,
**백엔드가 RT 를 회전시키므로 두 번째 호출이 첫 번째가 받은 토큰을 무효화할 수 있다.**
모듈 레벨 프라미스로 1회만 수행한다(`client.ts` 의 `refreshing` 과 같은 방식).

---

## 3. `selectIsAuthReady` — 인증 쿼리의 `enabled` 는 반드시 이걸 쓴다

```ts
export const selectIsAuthReady = (s) => !s.isRestoring && s.user !== null;
```

AT 가 쿠키로 가면서 FE 는 토큰 보유 여부를 직접 볼 수 없다.
그래서 **"복원 완료 + user 존재"** 로 판정한다.

**`isRestoring === false` 조건이 핵심이다:**

> 복원이 끝난 뒤의 user 는 항상 `/api/auth/refresh` → `/api/auth/me` 를 통과한
> 서버 응답으로 덮어써진 값이다(실패 시 clearAuth 로 null). 즉 이 셀렉터가
> true 인 시점의 user 는 **서버가 인정한 신원**이다.

반대로 복원 중에 true 를 주면 **만료된 AT 로 요청이 나가 401 → refresh 폭주**를 부른다.

---

## 4. 401 처리 — 코드 2종으로 갈린다

2026-07-18 확정된 규약. **status 만으로 분기하지 않는다.**

| code | 뜻 | 조치 |
|---|---|---|
| `AUTH_TOKEN_EXPIRED` | AT 만료 | **refresh 1회 → 원 요청 재시도** |
| `AUTH_REQUIRED` | RT 없음/만료 | 재발급 여지 없음 → 즉시 로그인 유도 |

```ts
if (status === 401 && code === "AUTH_REQUIRED") { redirectToLogin(); ... }
if (status === 401 && code === "AUTH_TOKEN_EXPIRED" && !original._retry) { ... }
```

`_retry` 플래그로 **재시도는 1회만**. 무한 루프를 막는다.

### 동시 401 방어 2겹

```ts
let refreshing: Promise<void> | null = null;   // refresh 프라미스 공유
let redirecting = false;                       // 리다이렉트 중복 실행 방지
```

프라미스를 공유해도 **각 요청이 개별적으로 실패 경로를 타므로** `redirecting`
플래그가 별도로 필요하다.

### `NO_AUTH_REDIRECT` — 401 이 곧 판정인 경로

부팅 복원처럼 "401 = 비로그인"인 곳에서 쓴다.

> 리다이렉트가 먼저 일어나면 **호출부의 catch 가 잡기도 전에** 화면이 로그인으로 넘어간다.

`fetchMe` 가 이걸로 호출된다.

### 이미 로그인 화면이면 이동하지 않는다

`returnUrl` 을 덮어써 원래 목적지를 잃지 않도록.

### 리다이렉트 후 프라미스를 매달아 둔다

```ts
return new Promise(() => {});   // 후속 처리 중단
```

resolve/reject 하지 않아 호출부의 에러 핸들러가 안 돈다 — 화면이 이미 넘어가는 중이라.

---

## 5. 응답 봉투 언래핑

모든 응답이 `{success, data}` / `{success, error}` 로 감싸여 온다.
인터셉터가 벗겨서 `data` 만 돌려주므로 **호출부는 봉투 구조를 모른다.**

```ts
if (body.success) { res.data = body.data; return res; }
throw new ApiError(body.error, res.status);
```

**`success: false` 인데 HTTP 200 으로 올 수 있어**(백엔드 정책) 여기서 방어적으로 throw 한다.
204 등 봉투가 아닌 응답은 그대로 통과.

### `ApiError` 의 getter 들

`detail` 은 **코드마다 형태가 달라** 타입을 좁히지 않고 `Record<string, unknown>` 으로 둔다.
읽는 쪽이 code 를 확인한 뒤 getter 로 꺼낸다.

| getter | 동반 코드 | 쓰임 |
|---|---|---|
| `displayMessage` | (공통) | 필드 사유 우선, 없으면 공통 message |
| `availableStock` | `CART_STOCK_INSUFFICIENT` | 남은 재고 |
| `options` | `CART_OPTION_REQUIRED` | **바로 옵션 선택 UI 를 띄우라**는 명세 |
| `unavailableItems` | `ORDER_PRODUCT_UNAVAILABLE` | 주문 불가 항목 전량 |

`options` 를 features 에서 import 하지 않고 여기서 좁히는 이유:
**shared → features 역방향 의존**이 되므로.

`unavailableItems` 는 서버가 fail-fast 가 아니라 **불량 항목을 전량 수집**해 내려준다 —
없으면 "장바구니에서 확인해주세요"밖에 안내할 수 없다.
`optionId`·`optionName` 은 옵션별 재고 전환(2026-08-09)으로 추가됐고,
**옵션 없는 상품과 HIDDEN 사유는 둘 다 null** 이라 표기는 조건부여야 한다.

### ⚠️ 64비트 ID 는 문자열이다

`optionId`·`productId` 는 **string**. number 로 파싱하면 **끝자리가 조용히 바뀐다**
(커밋 `b72f0e9`·`6dd5241`에서 실제로 고친 버그).

---

## 6. 가드 — 서버로 옮기지 않는 이유

라우트 가드는 클라이언트에 있다(`RequireAuth`·`RequireRole`).

**`proxy.ts`(구 middleware)로 옮기지 않는다.** AT 가 httpOnly 쿠키가 된 지금도
판단은 그대로다 — 가드는 UX 차원의 1차 필터이고 **최종 방어선은 백엔드**다.
서버 가드를 두면 이중 관리가 되고, 복원 타이밍과 어긋난다.

**복원 중(`isRestoring`)에는 판정을 보류한다** — 없으면 새로고침마다 로그인으로 튕긴다.

미인증 접근은 `?returnUrl=` 을 붙여 `/login` 으로 보내고, 로그인 후 복귀시킨다.

**리다이렉트는 렌더가 아니라 이펙트에서 한다** — Next 에서는 렌더 중 내비게이션이 경고를 낸다.
복원 중에는 `return null`(빈 화면). 스피너를 두지 않는다.

### returnUrl 은 세 곳에서 만들고, 전부 `useSearchParams` 를 피한다

| 위치 | 이동 방식 |
|---|---|
| `guards.tsx` | `router.replace` |
| `useWishlist`(게스트가 하트 클릭) | `router.push` |
| `client.ts` 401 인터셉터 | `window.location.href`(하드 내비) |

`usePathname()` 은 Suspense 를 유발하지 않으므로 써도 된다. 쿼리스트링만
`window.location.search` 에서 읽는다.

### `RequireRole` — 역할 불일치엔 returnUrl 을 안 붙인다

비로그인 → `/login?returnUrl=`, **역할 불일치 → `/home`**(쇼핑몰 홈).
재로그인해도 해결되지 않는 문제라 복귀시킬 이유가 없다.
루트(`/`)가 아니라 `/home` 인 이유: 이미 로그인해 서비스를 쓰던 사람이라
서비스 소개 화면으로 되돌리면 "처음 온 사람" 취급이 된다.

role 은 `/api/auth/me` 로 덮어쓴 서버 값으로만 판정한다.

### `SellerIsolation` — 전역 경로 접두 판정

판매자가 구매자 기능을 쓰지 못하게 막는다. 라우트 트리를 감싸는 대신
**루트 레이아웃에서 경로로 판정한다** — App Router 에서 같은 형태로 하려면
폴더를 라우트 그룹으로 대거 이동해야 해서, 이식 범위를 넘는 구조 변경이 된다.

허용 접두: `/seller` `/login` `/signup` / 허용 **정확 일치**: **`/`**(랜딩)

랜딩을 허용한 판단:

> 이 화면은 쇼핑 기능이 아니라 **서비스 소개**다. 판매자 탭이 그 안에 있어서 막으면
> 판매자가 자기 대상 소개 페이지에 못 들어간다. 격리가 지키려는 것(판매자가 구매자
> 기능을 쓰는 것)은 그대로 막힌다.

**⚠️ 루트는 접두사 목록에 넣지 않는다.** `/` 를 접두사로 두면 모든 경로가 통과해
격리가 통째로 무력화된다 — 그래서 `ALLOWED_EXACT` 로 분리했다
(2026-08-12 랜딩이 `/landing` 에서 루트로 옮겨오면서 생긴 함정).

**⚠️ 복원 중에는 children 을 렌더한다**(`RequireAuth` 와 반대다).
SELLER 만 걸러내므로 게스트·USER·ADMIN 은 그대로 통과한다.

### ⚠️ `useSearchParams` 를 가드에서 쓰지 말 것

그 훅을 쓰면 Suspense 경계에 묶이고 **경계 안 전체가 SSR 에서 빈 HTML** 로 나간다.
가드에서 쓰면 **보호된 페이지 전부가 빈 HTML** 이 된다.
이벤트·이펙트 시점에만 필요하면 그때 `window.location.search` 를 읽는다.

---

## 7. 수집(analytics)은 인증 경로를 공유하지 않는다

`track.ts`·`retry.ts` 는 **의도적으로 `api` 인스턴스를 피한다.**

> 401 이 나도 로그인 리다이렉트를 타면 안 되기 때문(수집은 배경 작업이다).
> 상품을 보던 사용자가 갑자기 로그인 화면으로 튕기게 된다.

그래서 refresh 도 별도 구현을 쓴다. **성공 여부만** 돌려주고, 실패하면 그 배치는 포기한다.

**재전송 대상은 401 하나뿐이다:**

> 401 은 서버가 요청을 받고 명시적으로 거부한 것이라 **적재가 안 됐음이 확실**하고,
> AT 재발급이라는 고칠 방법이 있다. 5xx·네트워크 오류는 **서버가 받았는지조차 모른다.**
>
> ⚠️ 이 예외를 5xx 로 넓히지 말 것 — 중복·부하가 실제로 생긴다.

자세한 경위는 `analytics-401-retry.md`.

### 게스트 승계는 서버가 한다

`guest_id` 쿠키로 서버가 자동 처리한다. **FE 는 `withCredentials` 로 쿠키가 실리는
것만 보장하면 된다.**

### `X-Session-Key`

**서버가 행동 이벤트를 적재하는 요청**에 붙인다 — 장바구니 변경 3종(C-2·C-3·C-4)과
**주문 2종(O-1 주문 생성 · O-2 재결제)**. 조회(GET)는 제외한다.
BE 가 이벤트를 적재할 때 방문 세션을 알 방법이 이 헤더뿐이다 —
`member_id`·`guest_id` 는 JWT·쿠키에서 뽑지만 `sessionKey` 는 FE 가
localStorage 로 관리하는 값이라서.

주문이 대상에 들어온 건 **2026-08-11 `purchase_complete` 서버 이관** 때문이다(E-1 개정).
빠뜨리면 결제는 정상 처리되지만 이벤트만 스킵되어 퍼널 마지막 단이 계속 비고,
S-1 `aiAttribution.coverage` 분자가 0 이 된다.

**모듈 로드 시점에 캐시하지 않고 요청 시점에 읽는다** — 30분 무활동이면 재발급되는데
캐시하면 만료된 옛 키를 계속 보낸다.

---

## 8. 문서 드리프트 — CLAUDE.md 와 어긋난 것

`05e6b46`(AT → httpOnly 쿠키) 전환이 CLAUDE.md 에 반영되지 않았다.

| CLAUDE.md 서술 | 실제 |
|---|---|
| "AT 는 메모리 전용 / 메모리에만 보관" | **httpOnly 쿠키.** 메모리에 두지 않는다 |
| "토큰: 인터셉터에서 자동 첨부" | 브라우저가 첨부한다. **첨부용 요청 인터셉터가 없다** |
| "`selectIsAuthReady`(복원완료+**AT보유**)" | AT 보유를 볼 수 없다 → **복원완료 + user 존재** |
| "SSR 안 함: AT 가 메모리에만 있어 서버가 알 수 없다" | 이유가 바뀌었다(쿠키는 서버도 읽을 수 있다). **결론은 유지** — 가드·복원 흐름이 클라이언트 기준이라 |
| role enum `MEMBER` | 코드는 **`USER`** / SELLER / ADMIN |

`docs/architecture-chat.md` 도 함께 참조.
