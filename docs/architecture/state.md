# 상태 관리 — 무엇을 어디에 두고 언제까지 살리는가

> 작성일 2026-08-12. **근거는 코드 전수 조사로 확인한 것만** 적었고, 추측은 "추정"으로 표시했다.
> 규칙 요약은 `CLAUDE.md`의 "상태 구분"·"React Query 규칙"에 있고, **이 문서는 그 근거와 실태**다.
> 코드가 정본이다. 이 문서와 어긋나면 코드를 믿고 이 문서를 고친다.

---

## 0. 한 장 요약

상태를 **소유자 기준으로 4개 축**에 나눴다. 판단 기준은 *"누가 이 값의 원본을 갖고 있는가"*다.

| 축 | 도구 | 무엇이 들어가나 | 원본 소유자 |
|---|---|---|---|
| **서버 원본 데이터** | React Query | 상품·장바구니·주문·찜·배송지·판매자 데이터 | **서버** |
| **인증 상태** | Zustand + persist | `user`, `isRestoring` | 서버(FE는 캐시만) |
| **채팅 대화** | Zustand + **수동** sessionStorage | 말풍선·칩·스트리밍 상태 | FE(일부는 서버 맥락과 연동) |
| **폼 입력** | RHF + Zod | 로그인·가입·배송지·클레임·후기 | FE(제출 전까지) |

**핵심 원칙 3개**
1. **서버 데이터를 `useState`로 복제하지 않는다** — 갱신 지점이 흩어져 하나만 빠뜨려도 화면이 죽는다
2. **저장소는 편한 곳이 아니라 수명이 같은 곳에 둔다** — §4
3. **persist된 값은 신뢰 경계가 아니다** — 권한 판정은 반드시 서버 응답으로 덮어쓴다

---

## 1. Zustand — 스토어가 2개뿐인 이유

`src/` 전체에서 `create` 호출은 **2곳**이다.

| 스토어 | 파일 | 줄 | persist |
|---|---|---|---|
| `useAuthStore` | [authStore.ts](src/shared/stores/authStore.ts) | 90 | O — localStorage |
| `useChatStore` | [chat/store.ts](src/shared/chat/store.ts) | 227 | **X** — 수동 sessionStorage |

> **왜 이것뿐인가**: 서버 데이터는 전부 React Query가 소유하고, UI 상태는 대부분
> 컴포넌트 지역 `useState`로 충분하다. Zustand는 **"여러 화면이 공유하는 클라이언트 상태"**에만 쓴다.
> 전역 스토어를 늘리면 어디서 바뀌는지 추적이 어려워진다.

### 1-1. authStore — 토큰이 없는 인증 스토어

```ts
interface AuthState {
  user: AuthUser | null;      // { id: string, email, nickname, role }
  isRestoring: boolean;       // 초기값 true
}
```

**토큰 필드가 없다.** AT·RT 모두 httpOnly 쿠키라 JS가 볼 수 없고, 볼 필요도 없다
([authStore.ts:26-27](src/shared/stores/authStore.ts#L26-L27)).

| 설정 | 값 | 근거 |
|---|---|---|
| `name` | `"jarvis-auth"` | 서비스명이 Narvis로 바뀐 뒤에도 **유지** — 바꾸면 기존 사용자 전원 로그아웃 ([:45-47](src/shared/stores/authStore.ts#L45-L47)) |
| `partialize` | `{ user }` 만 | `isRestoring`은 저장하지 않는다 (부팅마다 새로 판정해야 함) |
| `version` | **3** | v2: 과거 AT 저장분 폐기 / v3: `id`를 number→string 정정 |
| `migrate` | `String(user.id)` | 숫자로 저장된 브라우저가 남아 있으면 **쿼리 키가 `1`과 `"1"`로 갈린다** ([:59-61](src/shared/stores/authStore.ts#L59-L61)) |

**`id`를 문자열로 강제하는 이유**는 상태 관리와 직결된다 — 쿼리 키에 섞였을 때
`["products","recommended",1]`과 `["products","recommended","1"]`이 **다른 캐시**가 되기 때문이다.

#### `selectIsAuthReady` — 이 파일의 핵심

```ts
export const selectIsAuthReady = (s: AuthState) => !s.isRestoring && s.user !== null;
```

**왜 필요한가**: AT가 httpOnly 쿠키가 되면서 FE는 "내가 토큰을 갖고 있는가"를 직접 볼 수 없다.
그래서 **"복원 완료 + user 존재"**를 대리 지표로 쓴다.

- `isRestoring=false` 조건이 핵심 — 그 시점의 `user`는 `refresh` → `me`를 통과한 **서버 응답으로 덮어써진 값**
- 복원 중에 `true`를 주면 만료된 AT로 요청이 나가 **401 → refresh 폭주**

**인증 필요 쿼리의 `enabled`에 반드시 이걸 쓴다.** 실제 사용처 8곳:
`useHomeData:48` · `useRecentProducts:17` · `useOrders:17,31` · `useClaims:19` ·
`useAddresses:31` · `useWishlist:27` · `useProfileGraph:32` · `DashboardPage:129`

#### persist 리하이드레이션과 복원의 순서

[useRestoreSession.ts:23-30](src/shared/hooks/useRestoreSession.ts#L23-L30)에서
`persist.hasHydrated()` / `onFinishHydration`으로 **리하이드레이션 완료를 기다린 뒤** refresh를 부른다.

> 안 기다리면 "로그인한 적 없음"으로 오판해 refresh를 건너뛰고,
> 잠시 뒤 user만 복원돼 **"user는 있는데 AT는 없는" 상태로 굳는다.**

StrictMode 이중 실행은 **모듈 레벨 프라미스**로 1회 제한 ([:59-68](src/shared/hooks/useRestoreSession.ts#L59-L68)) —
백엔드가 RT를 회전시켜 두 번째 호출이 첫 번째 토큰을 무효화할 수 있기 때문.

### 1-2. chatStore — persist를 쓰지 않는 스토어

227줄, 상태 필드 12개. **`persist` 미들웨어를 쓰지 않고 수동 저장**한다 (이유는 §3).

| 필드 | 역할 |
|---|---|
| `sessionId` | 서버 대화 세션. null = 만료 폐기, 다음 전송 때 재발급 |
| `threadId` | 판매자 챗 스레드 식별자 (목록 전환·패널 변경에 불변) |
| `claimFailure` | 로그인 승계 실패 배너 상태 `{ sessionId, retrying }` |
| `messages` | 말풍선 `{ id, role, text, error?, retryable?, requestId? }` |
| `results` | 결과 카드(상품·diff) |
| `conditions` / `suggestions` | 구매자 조건 칩 / 완화 제안 칩 |
| `isStreaming` | SSE 진행 여부 |
| `lane` | 판매자 챗 화면 전환 신호(첫 프레임 `meta.lane`) |
| `progress` | 진행 표시 문구 — **채널 공용 슬롯** |
| `analysisReport` | 우측 패널 리포트 |
| `activeDraft` | 검토 대기 초안 `{ draftId, expiresAt }` |

**설계 판단 3개**

**① `progress`를 채널 공용 문자열 슬롯으로 정규화**
페이로드가 채널마다 다르지만(구매자 `{stage,message?}` / 판매자 `{text}`)
화면에 필요한 건 표시 문구 하나뿐이라 **`useChat`이 문자열로 정규화해 넣는다**
([store.ts:80-85](src/shared/chat/store.ts#L80-L85)). 스토어가 채널을 몰라도 된다.

**② `analysisReport`를 `results` 카드로 두지 않은 이유**
턴당 정확히 1개이고 **누적되지 않는다**(다음 분석이 통째로 교체).
배열에 넣으면 "이전 리포트를 지우는" 코드가 따로 필요해진다 ([:86-90](src/shared/chat/store.ts#L86-L90)).

**③ `activeDraft`의 TTL을 FE가 재는 이유**
초안은 서버에서 10분 뒤 사라지는데 그 시점엔 **SSE 스트림이 이미 끝나 있어 서버가 알려줄 경로가 없다.**
이게 없으면 판매자가 죽은 초안에 갇힌다 ([:54-67](src/shared/chat/store.ts#L54-L67)).
`DRAFT_TTL_MS = 10분`으로 서버 checkpoint 보관 시간과 맞춤.

> `activeDraft`는 **순수 FE 표시 상태**다. 서버에 보내지 않는다 —
> 서버는 이미 checkpoint에 초안을 갖고 있고, FE가 보낸 값을 신뢰하면 위조가 가능해진다.

**`reset()`(새 대화)이 지우는 것**: 화면 상태만. 방 id는 sessionStorage(`threadId.ts`),
세션은 코디네이터가 들고 있어 여기서 지워지지 않는다 — **"새 대화" = 새 방, 세션은 유지**.

---

## 2. React Query — 서버 데이터의 유일한 소유자

### 2-1. QueryClient에 `defaultOptions`가 없다

```ts
// src/app/providers.tsx:23
const [queryClient] = useState(() => new QueryClient());
```

**전역 기본값을 두지 않고 훅마다 개별 선언**한다.

- **이유(추정)**: staleTime 근거가 데이터 성격마다 다르다. 전역 기본값을 두면
  훅에서 그 값을 덮어쓸 때 *"왜 다른가"*가 안 보인다. 개별 선언이 근거를 코드 옆에 남긴다
- **`useState`로 감싼 이유**: 모듈 스코프에 두면 **SSR 환경에서 요청 간 인스턴스가 공유돼
  사용자끼리 캐시가 섞인다** ([providers.tsx:20-22](src/app/providers.tsx#L20-L22))

서버 컴포넌트는 별도로 `new QueryClient()`를 요청마다 만든다 ([home/page.tsx:43](src/app/home/page.tsx#L43)).

### 2-2. 쿼리 키 컨벤션

**소문자 도메인 문자열 → 식별자 → 하위 리소스 → 필터 객체** 순의 배열.

```
["cart"]                                    ["orders", { page, size }]
["products", "popular", size]               ["products", id, "detail"]
["products", id, "reviews", { page, size, sort }]
["seller", "products", { tab, sort, page }]
```

**키 factory를 쓰지 않고 인라인 리터럴**이다 (상수화는 `PROFILE_GRAPH_KEY` 한 곳뿐).

> **트레이드오프**: factory가 있으면 오타를 타입으로 막을 수 있지만,
> 키가 20개 남짓이고 컨벤션이 단순해 **인라인 쪽 가독성이 낫다고 판단**(추정).
> 실제로 키 불일치 사고가 한 번 있었다 — [ChatPage.tsx:58](src/features/seller/ChatPage.tsx#L58)에
> *"키가 어긋나면 조용히 빈 배열이 되므로 주의"*라고 남아 있다.

**상품 키가 2벌인 이유** ([useProduct.ts:12-14](src/features/product/useProduct.ts#L12-L14))

| 키 | 내용 |
|---|---|
| `["products", id]` | 카드 시딩 — 챗봇·마이페이지가 넣은 **부분치** |
| `["products", id, "detail"]` | 상세 — 완전한 응답 |

같은 키를 쓰면 부분치가 상세를 덮어써 화면이 깨진다.

### 2-3. staleTime — 값과 근거

| 값 | 대상 | 근거 |
|---|---|---|
| **30분** | `["categories"]` · `["brands", id, ...]` | 거의 안 변하는 정적 데이터 |
| **5분** | 인기상품 · 홈 추천 · 상품 상세 · 리뷰 | **BE Redis 캐시와의 합산 낡음 상한** — 인기상품 합 8분, 개인화 합 15분 |
| **0** | 장바구니 · 주문 · 찜 · 배송지 · 클레임 · 판매자 데이터 | 사용자가 방금 바꿨을 수 있는 값 |

**SSR revalidate와 값을 맞춘다** — [serverApi.ts:11-13](src/features/home/serverApi.ts#L11-L13).
어긋나면 서버가 준 HTML과 클라이언트 재조회 결과가 다른 시점에 갱신된다.

### 2-4. 무효화 — 누가 언제 지우나

| 트리거 | 무효화 키 |
|---|---|
| 장바구니 담기·수량변경·삭제 | `["cart"]` |
| **챗봇 CART_ADDED 수신** | `["cart"]` — 같은 규칙 |
| **챗봇 찜 액션** | `["wishlist"]` — **productId가 없어 목록 통째 재조회**(경로 B) |
| 주문 생성 | `["orders"]` + PAID면 `["cart"]` |
| 후기 작성 | `["orders"]`, `["products", productId]` |
| 클레임 신청 | `["claims"]`, `["orders"]` |
| 판매자 챗 `done{panel:"refresh"}` | `["seller"]` — **프리픽스 전체** |
| **다른 탭 로그인 감지** | **인자 없음 = 전체 무효화** ([useAuthSync.ts:76](src/shared/hooks/useAuthSync.ts#L76)) |

> **전체 무효화가 정당한 유일한 경우**: 다른 탭에서 로그인하면
> **게스트로 받은 캐시 전부가 남의 데이터**가 된다. 선별 무효화가 오히려 위험하다.

### 2-5. 낙관적 업데이트 — 3곳뿐

| 대상 | 파일 | 패턴 |
|---|---|---|
| 찜 토글 | [useWishlist.ts:119-175](src/shared/hooks/useWishlist.ts#L119-L175) | cancel → 스냅샷 → setQueryData → onError 롤백 → onSettled 무효화 |
| 장바구니 수량 | [cart/useCart.ts:42-60](src/features/cart/useCart.ts#L42-L60) | 동일 |
| 장바구니 삭제 | [cart/useCart.ts:66-80](src/features/cart/useCart.ts#L66-L80) | 동일 |

**롤백하지 않는 예외** — [useWishlist.ts:135-148](src/shared/hooks/useWishlist.ts#L135-L148)

`WISHLIST_DUPLICATE`(409)·`WISHLIST_NOT_FOUND`(404)는 **"이미 원하는 상태"**라
롤백하면 오히려 화면이 틀려진다 → 롤백 대신 `invalidateQueries`로 서버 기준 정렬.

> status 404로 뭉치면 안 된다 — `PRODUCT_NOT_FOUND`와 혼동된다. **code로 분기**한다.

**토스트를 mutation 콜백에서 띄우는 이유** ([:156-159](src/shared/hooks/useWishlist.ts#L156-L159)):
이펙트로 상태를 관찰하면 `onSettled` 재조회 리렌더와 **경쟁해 발화가 누락**된다.

#### 낙관적 업데이트를 의도적으로 쓰지 않는 곳

**취향 프로필** — `graphVersion` 낙관적 잠금(If-Match, 409)이 걸려 있어
**서버 응답값만 캐시에 반영**한다 ([useProfileGraph.ts:62-95](src/features/mypage/preferences/useProfileGraph.ts#L62-L95)).
버전이 어긋나면 서버가 409로 막으므로, FE가 미리 그려두면 충돌 시 되돌릴 게 많아진다.

### 2-6. SSR 연결 — 방식이 2가지인 이유

**쿼리 개수로 고른다.**

| 페이지 | 쿼리 | 방식 |
|---|---|---|
| 상품 상세 | 1개 | `initialData` |
| 브랜드 | 1개 + 가변 조합 | `initialData` + **조합 검사** |
| 홈 | 여러 개 | `HydrationBoundary` |

**⚠️ `initialData` 함정** — [useBrandHome.ts:45](src/features/brand/useBrandHome.ts#L45)

```ts
initialData: isServerRenderedCombo ? initialData : undefined
```

모든 키에 그대로 주면 **필터를 바꿔 새 키가 생겼을 때도 옛 데이터가 초기값으로 들어가고,
staleTime(30분) 때문에 재조회조차 하지 않는다.** 브랜드 필터에서 실제로 겪은 사고다.

→ **`initialData`는 "서버가 렌더한 그 조합"에만 준다.**

홈은 `prefetchQuery` 2개를 **각각 `.catch(() => {})`로 독립 실패 처리**한 뒤 `dehydrate`
([home/page.tsx:50-63](src/app/home/page.tsx#L50-L63)) — 하나가 실패해도 나머지는 SSR된다.

---

## 3. 채팅 대화 — persist 미들웨어를 안 쓴 이유

zustand `persist` 대신 **수동 sessionStorage 저장 + 별도 훅** 구조다.

### 왜 수동인가

| 이유 | 설명 |
|---|---|
| **일부 필드만 저장** | 12개 중 4개만 (`messages`·`sessionId`·`results`·`claimFailedSessionId`). `partialize`로도 가능하지만 저장 형태가 스토어와 **다르다** |
| **복원 시점 제어** | 마운트 시 1회만. `persist`는 스토어 생성 시 자동 복원이라 **채팅 화면 밖에서도 복원**된다 |
| **저장 주체 단일화** | 로그인 왕복(CH-7 승계)도 **같은 저장소를 쓴다.** 주체가 둘이면 서로 덮어써 유실 ([chatPersistence.ts:14-15](src/shared/chat/chatPersistence.ts#L14-L15)) |

### 저장 형태

```ts
interface PersistedChat {
  messages: ChatMessage[];
  sessionId: string | null;
  results: ChatResult[];
  claimFailedSessionId?: string | null;   // 재시도 대상
}
```

**`claimFailedSessionId`를 `sessionId`와 따로 두는 이유**
([chatPersistence.ts:27-33](src/shared/chat/chatPersistence.ts#L27-L33)):
승계 실패 시 `sessionId`는 비워야 하지만(구 게스트 티켓으로 스트림을 열면 AI가 403으로 막음)
**재시도하려면 그 값을 알아야 한다.**

### 복원·저장의 순서 문제

[useChatPersistence.ts](src/shared/chat/useChatPersistence.ts) — 4가지 판단이 들어 있다.

**① 복원 → 저장 순서 강제** ([:14-15](src/shared/chat/useChatPersistence.ts#L14-L15))
```ts
const restored = useRef(false);   // 이게 없으면
// 복원 전에 저장 구독이 돌아 빈 스토어가 저장된 대화를 덮어쓴다
```

**② 저장을 스토어 구독으로** ([:36-39](src/shared/chat/useChatPersistence.ts#L36-L39))
`done`에만 쓰면 스트리밍 중 탭이 닫힐 때 답변이 통째로 날아간다.
구독이면 토큰 누적이 `messages`를 갈아끼우므로 **그때까지 받은 답변이 남는다**.

**③ 빈 대화는 저장하지 않는다** ([chatPersistence.ts:37-42](src/shared/chat/chatPersistence.ts#L37-L42))
빈 값을 써두면 **다른 탭에서 시작한 대화를 이 탭이 덮어쓸 여지**가 생긴다.

**④ 읽어도 지우지 않는다** ([:51-52](src/shared/chat/chatPersistence.ts#L51-L52))
새로고침이 반복돼도 계속 복원돼야 한다 (로그인 왕복 1회만 쓰던 종전 동작과 달라진 점).

### 저장소 선택 — sessionStorage인 이유

> 서버 맥락 TTL이 **10분 sliding**이라, 그보다 오래 남기면
> **화면엔 대화가 있는데 AI는 기억하지 못하는** 어긋난 상태가 길어진다.
> 탭 수명이 세션 수명과 대체로 겹쳐 그 간극이 가장 작다.

부수 효과로 **새로고침·탭 복구(`Ctrl+Shift+T`)에는 살아남는다.**

---

## 4. 저장소 선택 기준 — 이 문서의 결론

같은 "채팅"이라도 **축마다 수명이 달라** 저장소가 넷으로 갈린다.

| 축 | 저장소 | 수명 | 공유 범위 |
|---|---|---|---|
| 세션 + 티켓 | `localStorage` | **25초** | **탭 전체** |
| 대화방(threadId) | `sessionStorage` | 탭 | 탭별 |
| 대화 내용 | `sessionStorage` | 탭 | 탭별 |
| 화면 상태 | Zustand(메모리) | 마운트 | 없음 |

**기준**: *"이 값은 언제까지 유효한가"* 와 *"누가 이 값을 공유해야 하는가"*.

- 신원은 **사용자 단위**라 탭이 공유해야 한다 → localStorage
- 대화는 **탭 단위**여야 각 탭이 독립 대화를 한다 → sessionStorage
- 티켓은 **25초** — 티켓 TTL(30~60초)보다 짧게 잡아 만료 직전 것을 재사용하지 않게
  ([sessionCoordinator.ts:43](src/shared/chat/sessionCoordinator.ts#L43))

> 자세한 멀티탭 동기화(락·BroadcastChannel)는 `presentation-chat-session-design.md` 참조.

---

## 5. 폼 — RHF + Zod

`useForm` + `zodResolver`를 쓰는 폼은 **5개**다.

| 폼 | 파일 | 스키마 |
|---|---|---|
| 로그인 | [LoginForm.tsx:20](src/features/auth/components/LoginForm.tsx#L20) | `features/auth/schema.ts` |
| 회원가입 | [SignupForm.tsx:30](src/features/auth/components/SignupForm.tsx#L30) | `features/auth/schema.ts` |
| 배송지 | [AddressFormModal.tsx:49](src/shared/address/AddressFormModal.tsx#L49) | `shared/address/addressSchema.ts` |
| 클레임 | [ClaimRequestModal.tsx:82](src/features/mypage/components/ClaimRequestModal.tsx#L82) | `features/mypage/claimSchema.ts` |
| 후기 | [ReviewWritePage.tsx:40](src/features/mypage/ReviewWritePage.tsx#L40) | `features/mypage/reviewSchema.ts` |

**Zod 스키마는 예외 없이 별도 파일**이다. 폼 컴포넌트 안에 `z.object`를 정의한 사례는 없다.

- **이유(추정)**: 스키마는 백엔드 필드 정의와 맞춰야 하는 **계약성 코드**라
  화면 코드와 수명이 다르다. 분리해두면 계약이 바뀔 때 고칠 곳이 한 군데다
- `ClaimRequestModal`은 제네릭 3개로 **입력/출력 타입을 분리**한다
  (`useForm<Input, unknown, Values>`) — zod `transform` 대응

**검증은 1차 필터일 뿐**이다. 재고처럼 *"이미 담긴 양 + 이번 요청"*으로 판정해야 하는 값은
FE가 알 수 없어 **서버 응답으로 확정**한다.

---

## 6. "서버 데이터를 useState로 복제 금지" — 실제 준수 상태

`src/**` 전체 `useState` 호출을 훑은 결과, **위반 사례는 발견되지 않았다.**
확인된 `useState`는 전부 UI 상태 범주다:

- 쿼리 키의 **입력값**(page·tab·sort) — 서버 데이터가 아니라 요청 파라미터
- 모달 개폐·편집 대상 id
- 입력값·애니메이션·뷰포트

### 규칙을 의식적으로 지킨 흔적

[useProfileGraph.ts:40-49](src/features/mypage/preferences/useProfileGraph.ts#L40-L49):

> `graphVersion`을 별도 state로 복제하지 않고 React Query 캐시 한 곳에서만 읽고 쓴다.
> useState로 들고 다니면 갱신 지점이 **4곳(수정·삭제·초기화·개인화)**으로 흩어져
> 하나만 빠뜨려도 화면이 죽는다.

[useCart.ts:9-10](src/shared/hooks/useCart.ts#L9-L10): 헤더 뱃지와 장바구니 페이지가
**같은 `['cart']` 키를 공유** — 복제 대신 캐시 공유.

### 경계선 사례 1건 (위반 아님)

[product/index.tsx:65-67](src/features/product/index.tsx#L65-L67) — `optionSoldOut`을 state로 "복제"한다고
주석에 적혀 있으나, 원본은 **서버 응답이 아니라 자식 컴포넌트의 선택 상태(`selectionRef`)**다.
ref는 렌더를 유발하지 않아 버튼 비활성에 반영되지 않으므로 미러링이 필요하다.
→ **서버 데이터 복제가 아니라 ref → state 미러링**이라 다른 축이다.

---

## 7. 재시도 정책

| 대상 | 설정 | 근거 |
|---|---|---|
| **뮤테이션 전반** | `retry: false` | **자동 재시도 금지** — 중복 담기·중복 주문 방지. 실패 시 **재시도 버튼**을 준다 |
| 취향 프로필 조회 | `retry: 1` | 기본 3회를 줄임 |
| 챗봇 액션 | 자동 재시도 없음 | 같은 이유 |

> 사용자가 누르는 재시도와 자동 재시도는 다르다. **자동은 사용자가 모르는 사이 상태를 바꾼다.**

---

## 8. 알려진 한계

- **키 factory가 없다** — 인라인 리터럴이라 오타를 타입으로 막지 못한다.
  실제로 판매자 챗에서 키 불일치 위험이 주석으로 남아 있다
- **`defaultOptions`가 없다** — 새 훅을 만들 때 staleTime을 빠뜨리면 라이브러리 기본값(0)이 된다.
  의도한 것인지 실수인지 코드만 봐서는 구분이 안 된다
- **채팅 저장이 스토어 구독 기반**이라 스트리밍 중 sessionStorage 쓰기가 잦다.
  현재 문제는 없지만 **측정한 적은 없다**
- **낙관적 업데이트가 3곳뿐** — 나머지는 서버 왕복을 기다린다. 의도적 선택이지만
  체감 속도 개선 여지는 남아 있다
