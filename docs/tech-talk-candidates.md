# 기술 발표 후보 — 코드와 커밋으로 뒷받침되는 것만

> 발표 소재를 고르기 위해 현재 레포를 조사한 기록. 2026-08-12.
>
> 기준은 다섯 가지다 — **실제 사용자 문제 / 기술적 난점 / 원인 분석 / trade-off / 코드 근거**.
> 단순 UI 수정과 취향 조정은 제외했다.
>
> **측정하지 않은 성능 수치는 쓰지 않는다.** 근거가 없는 항목은 `확인 필요`로 남긴다.

## 조사 범위

- `.agents/skills`(animation-vocabulary · apple-design · emil-design-eng), `CLAUDE.md`, `package.json`
- 현재 브랜치 `design/mobile-responsive-ui` ↔ `main` diff (28 파일, +1223/-513)
- 최근 커밋 60개 — 특히 챗 세션·screen context·조건 칩·바텀시트 계열
- 기존 문서 — `home-scroll-interaction-perf-review.md`, `hero-animation-perf-review.md`, `cart-event-migration-incident.md`

---

## 1. 후보 5선

| # | 후보 | 사용자 문제 | 핵심 기술 | 관련 파일 | 발표 가치 | 추천도 |
|---|---|---|---|---|---|---|
| 1 | **멀티탭 채팅 세션 조정** | 탭 2개면 세션이 서로 축출됨 · 한 탭에서 로그인하면 다른 탭이 403 | Web Locks · BroadcastChannel · localStorage(공유)+sessionStorage(탭별) 이중 저장소 · 락 진입 후 캐시 재확인 · degrade 경로 | `shared/chat/sessionCoordinator.ts` · `threadId.ts` · `claimOnLogin.ts` · `useChat.ts` | 브라우저 동시성을 FE 에서 분산 문제로 풂. 커밋 3개가 문제 발견→부분 해결→잔여 결함 제거로 이어짐 | ★★★★★ |
| 2 | **LLM 에 넘기는 화면 context** | "이거 담아줘" · "3번째 줄 2번째" 지시어를 AI 가 못 풂 | 전송 시점 스냅샷(값 아닌 함수 주입) · 반응형 `columns` 전송 · 신뢰 경계 기반 필터링 · 순수 함수 분리 + 단위 테스트 5종 | `features/chat/useScreenContext.ts` · `useScreenContext.test.ts` · `components/ProductPanel.tsx` | "AI 에 무엇을 보내지 **않을** 것인가"를 보안으로 판단. LLM 앱 FE 고유 문제 | ★★★★★ |
| 3 | **모바일 채팅 바텀시트** | 좁은 화면에서 대화·결과 두 축이 동시에 필요 · 시트에 가려 마지막 카드가 안 보임 | Pointer Events + `setPointerCapture` · 거리+속도 이중 스냅 · ResizeObserver 실측 · CSS 변수로 시트 높이 전파 · 드래그 중 transition 해제 | `shared/chat/MobileBottomSheetFrame.tsx` · `ChatLayout.tsx` · `features/chat/components/ProductPanel.tsx` | 라이브러리 없이 네이티브 제스처 구현. Before/After 가 화면으로 가장 잘 보임 | ★★★★☆ |
| 4 | **조건 칩 key 충돌 회귀** | 카테고리 칩 하나를 지웠는데 전부 사라짐 · 엉뚱한 칩이 사라져 보임 | React 리컨실리에이션과 key 중복 · `(field,value)` 복합 식별자 · 낙관적 업데이트 분리·테스트화 | `shared/chat/conditionRemoval.ts` · `conditionRemoval.test.ts` | "서버는 하위호환인데 렌더링은 아니었다"는 통찰이 핵심. 짧고 밀도 높음 | ★★★☆☆ |
| 5 | **홈 스크롤 / reveal 인터랙션** | 스크롤 인터랙션이 메인 스레드를 잡아먹을 위험 | CSS `scroll-snap: proximity`(JS 하이재킹 회피) · `useRevealOnce` 1회성 observer · `prefers-reduced-motion` | `features/home/hooks/useRevealOnce.ts` · `app/globals.css` · `docs/home-scroll-interaction-perf-review.md` | 검토 문서는 있으나 **실측이 없음**. 문서 스스로 "정적 코드 리뷰 기반, 프로파일러 미실행"이라 밝힘 | ★★☆☆☆ |

### 5번을 낮게 둔 이유

`home-scroll-interaction-perf-review.md` 는 서두에 기준을 **"정적 코드 리뷰 기반 / 브라우저
Performance 프로파일러·실기기 측정은 아직 하지 않음"** 이라고 명시한다.
발표에서 "개선했다"고 말하려면 실측이 선행되어야 한다.

대비되는 사례가 `hero-animation-perf-review.md` 다 — 그쪽은 CPU 4x slowdown 조건에서
측정했고, **코드만 읽고 세운 가설이 측정으로 반증됐다**는 결론까지 남겼다.
발표 소재로서의 강도 차이는 여기서 갈린다.

---

## 2. 1위 — 멀티탭 채팅 세션 조정

**한 줄**: 탭이 여러 개일 때 채팅 세션이 서로를 축출하던 문제를, Web Locks + BroadcastChannel 로
"세션은 공유, 대화방은 탭별"로 분리해 해결함.

### 문제

- 탭 2개에서 채팅하면 서로 세션을 축출함
- 1차 해결 후에도 잔여 결함 2개가 남음
  - **승계 실패의 조용한 폴백** — 로그인 승계(CH-7)가 실패하면 `sessionId` 만 비우고 넘어가,
    다음 전송에서 새 세션이 조용히 생김. 결과적으로 **화면엔 로그인 전 대화가 남았는데
    AI 는 그 맥락을 기억하지 못하는** 어긋난 상태가 되고, 사용자는 이유를 알 수 없음
  - **다른 탭의 낡은 게스트 티켓** — 한 탭에서 로그인해 세션이 회원으로 승계되면 다른 탭이
    들고 있던 게스트 티켓은 그 순간 무효가 됨. 기존에는 그 티켓으로 스트림을 연 뒤에야
    실패를 알 수 있었고, 안내도 "새로고침 후 다시 시도해 주세요"였음

### 기술적 난점

- 탭 간에는 공유 메모리가 없음
- 동시 진입 시 N 개 탭이 동시에 발급 요청함(thundering herd)
- **"세션"과 "대화방"의 생명주기가 다름** — 세션은 신원 단위, 방은 탭 단위
- 실패 종류별로 처방이 달라야 함 — 404 는 자동 재발급 금지(탭 전쟁 유발), 403 은 폴백 허용

### 해결 방식

- `navigator.locks` 로 접속당 CH-1 발급 1회 보장. **락 진입 후 캐시를 재확인**해
  대기하던 탭들의 중복 발급을 차단함
- 발급 결과를 localStorage(채널별) + BroadcastChannel 로 탭 간 공유
- `thread_id` 를 sessionStorage(탭별 정본)로 분리 — 세션은 공유하되 방은 탭마다 고유
- 방송 메시지를 유니온으로 분리
  - `session` — 티켓이 갱신됨
  - `ownership` — 세션의 주인이 게스트→회원으로 바뀜
  - 하나로만 알리면 받는 쪽이 **"새 티켓이 왔다"와 "내 자격이 무효다"를 구분할 수 없음**
- 승계 실패는 `SessionClaimPendingError` 로 발급 자체를 막고, 사용자에게 3지선다를 줌
  (다시 시도 / 기억 없이 계속 / 지우고 새로 시작)

### trade-off

| 선택 | 버린 것 | 이유 |
|---|---|---|
| 락 범위를 발급·재발급만 감쌈 | 완전한 직렬화 | SSE 스트림까지 감싸면 그동안 다른 탭의 발급이 막힘 |
| `ownership` 수신 시 전송을 막지 않음 | 완벽한 정합성 | 실제로 깨지는 건 방송 도착 전 **수십 ms** 뿐인데, 막으면 멀쩡히 이어질 대화까지 끊김 |
| `publish` → `ownership` 순서 고정 | — | 반대면 받는 탭이 방금 심긴 유효 티켓을 지워 재발급이 한 번 더 남 |
| Web Locks 미지원 시 300ms 대기 후 캐시 재확인 | 엄밀한 상호배제 | degrade 여도 최악이 "중복 발급 1회"라 손해가 작음 |
| 승계 실패 시 사용자에게 물음 | 자동 복구 | 막으려던 건 "조용히 맥락이 끊기는 것"이지 사용자의 선택이 아님 |

### 시연할 장면

- 탭 2개 게스트 대화 → 한쪽 로그인 → 다른 탭이 **같은 sessionId 를 유지한 채 티켓만
  `sub_type=member` 로 바뀌고, thread 는 탭별로 분리**됨 (`e8a04a6` 에 이 시나리오로 수동 검증 기록 있음)
- 승계 실패 배너 — DevTools 로 claim 요청을 차단해 재현 (`b6ffc48` 에 기록됨)

### 관련 파일

- `src/shared/chat/sessionCoordinator.ts` (297줄) · `threadId.ts` · `claimOnLogin.ts`
- `src/shared/chat/chatPersistence.ts` — `claimFailedSessionId` 별도 보관
- `src/shared/chat/ClaimFailureBanner.tsx`
- 테스트 — `sessionCoordinator.test.ts` · `claimOnLogin.test.ts` · `threadId.test.ts`
- 커밋 — `d600e51`(축출 해결) → `b6ffc48`(조용한 폴백 차단) → `e8a04a6`(낡은 티켓 폐기)

### 예상 질문

1. **"Web Locks 대신 localStorage 뮤텍스나 leader election 은 왜 안 썼나?"**
   → degrade 경로가 사실상 그 답이다(대기 + 캐시 재확인). 브라우저 지원 범위는 `확인 필요`
2. **"세션 TTL 10분과 티켓 TTL 25초의 관계는?"**
   → 티켓 캐시를 실제 TTL(30~60초)보다 짧은 25초로 잡아 만료 직전 재사용을 피함.
   스트림 401 재발급 경로가 있어 보수적으로 잡아도 손해가 없음

### 3분 흐름

| 시각 | 내용 |
|---|---|
| 0:00 | 탭 2개 데모로 축출 재현 |
| 0:40 | 왜 어려운가 — 공유 메모리 없음 + 세션/방 생명주기 분리 |
| 1:30 | Web Locks + BroadcastChannel 구조도 |
| 2:10 | 잔여 결함 2개와 `ownership` 신호 분리 |
| 2:40 | 교훈 — 멀티탭은 FE 의 분산 문제다. 실패는 종류별로 처방이 다르다 |

---

## 3. 2위 — LLM 에 넘기는 화면 context

**한 줄**: "이거 담아줘" 같은 지시어를 풀기 위해 화면 사실을 AI 에 전송하되,
서버가 이미 아는 것은 의도적으로 제외해 위조 경로를 막음.

### 문제

- 사용자는 우측 패널을 보며 "이거", "3번째 줄 2번째"라고 말함.
  이 지시어는 발화만으로 확정 불가 — **무엇이 어떤 배치로 보이는지는 FE 만 아는 사실**임
- 게다가 타입과 전송 코드는 있었지만 `getScreenContext` 를 주입하는 호출부가 없어
  **`screen` 이 한 번도 전송된 적이 없던** 상태였음 (`e6e97d5`, 명세도 "현재 전송되지 않으며"로 기재)

### 기술적 난점

1. **값이 아니라 함수를 넘겨야 함**
   대화 중 패널이 계속 바뀌므로 훅 초기화 시점이 아닌 매 전송 시점의 화면을 실어야 함.
   값을 deps 에 넣으면 콜백이 재생성돼 `useChat` 의 `send` 까지 흔들림
   → `useRef` + 빈 deps `useCallback`
2. **`columns` 는 반응형이라 서버가 알 수 없음**
   `index = (row-1) × columns + (col-1)` 좌표 계산의 필수 입력인데,
   `ProductPanel` 의 GRID 클래스와 `currentColumns()` 가 어긋나면 **조용히** 틀림
3. **무엇을 보낼 것인가**

### 해결 방식 — 기준을 바꾼 것이 핵심

기준을 "화면에 보이나"가 아니라 **"서버가 이미 아나"** 로 잡음.

- 추천 카드(CH-5)는 서버가 `listId` 로 알고 있음. 되돌려주면 **FE 가 보낸 목록을 서버가
  신뢰하는 위조 경로**가 됨 → `recommendationContext` 유무로 걸러 인기상품 패널만 전송
- 상한 20건, 초과분은 화면 순서대로 절단
- 패널이 비었거나 추천 카드뿐이면 `screen` 자체를 생략 — `pageType` 만 보내면 항상 "chat" 이라 정보량 0
- 순수 함수 3개로 분리해 테스트로 고정
  - `screenProductsFromResults` / `hasVisibleProductPanel` / `buildBuyerScreenContext`
  - `useScreenContext.test.ts` 케이스 5종

### trade-off

| 선택 | 버린 것 | 이유 |
|---|---|---|
| 추천 카드를 `products` 에서 제외 | 그 카드에 대한 지시어 해석 | 보안(위조 차단)을 기능성보다 우선함. 서버는 `listId` 로 조회하면 됨 |
| 빈 패널이면 `screen` 자체 생략 | 일관된 페이로드 | `pageType` 만 보내면 정보량이 0 |
| GRID ↔ `columns` 동기화를 **주석**으로만 보장 | 타입 안전성 | 타입으로 묶을 수단이 없어 취약점을 인정하고 양쪽에 주석을 남김 |
| AI 수신부보다 먼저 배포 | — | `screen` 은 계약상 관대함(모르는 값이면 무시하고 200). `conditionActions` 가 엄격(400)인 것과 다름 |

### 시연할 장면

- 인기상품 패널이 뜬 상태에서 "3번째 거 담아줘" 전송 → DevTools Network 에서
  요청 body 의 `screen.products` / `screen.columns` 확인
- 브라우저 폭을 줄여 2열로 만든 뒤 다시 보내 `columns` 가 바뀌는 것 확인
- **AI 서버의 실제 지시어 해석 동작은 `확인 필요`** — `e6e97d5` 시점엔 수신부가 없었고,
  현재 상태는 FE 코드에서 확인 불가

### 관련 파일

- `src/features/chat/useScreenContext.ts` (53줄) · `useScreenContext.test.ts` (5 케이스)
- `src/features/chat/components/ProductPanel.tsx` — GRID 상수
- `src/shared/types/chat.ts` — `ChatScreenContext`
- 커밋 — `e6e97d5`(최초 배선) → `3527b98`(순수 함수 분리 + 테스트)

### 예상 질문

1. **"추천 카드도 보내면 UX 가 더 좋지 않나?"**
   → 서버가 이미 아는 정보를 FE 가 되돌려주면 신뢰 경계가 무너짐. 서버는 `listId` 로 조회하면 됨
2. **"20건 상한을 넘는 화면이면?"**
   → 화면 순서대로 절단. 계약 기본값 `screen_products_max` 를 따름

### 3분 흐름

| 시각 | 내용 |
|---|---|
| 0:00 | "이거 담아줘"가 왜 안 풀리는지 시연 |
| 0:40 | FE 만 아는 사실 3가지 — 무엇이 · 몇 열로 · 어떤 순서로 |
| 1:20 | 무엇을 **안** 보낼 것인가 — "보이나"가 아니라 "서버가 아나" |
| 2:10 | 함수 주입과 리렌더 함정 |
| 2:40 | 교훈 — LLM 앱에서 context 는 기능이자 공격면이다 |

---

## 4. 3위 — 모바일 채팅 바텀시트

**한 줄**: 라이브러리 없이 Pointer Events 로 네이티브 감각의 드래그 시트를 만들고,
시트 높이를 CSS 변수로 형제 패널에 전파해 가림 문제를 해결함.

### 문제

- 모바일에서 대화와 결과 두 축이 동시에 필요한데 세로 공간이 부족함
- 시트가 하단에 떠 있어 상품 목록 마지막 줄이 가려짐
- 입력창 하단 고정이 깨짐 (`bd5bdeb`)

### 기술적 난점

- 시트 높이가 콘텐츠에 따라 변하는데, **형제 패널의 하단 여백은 그 높이를 알아야 함**
- 드래그 중에는 CSS transition 이 손가락을 따라오지 못해 지연이 생김
- 드래그와 탭을 구분해야 함 — 드래그 끝에 click 이 함께 발생함
- 키보드가 올라올 때 입력창이 시트 밖으로 밀림

### 해결 방식

- `ResizeObserver` 로 시트 높이를 실측해 `collapsedOffset` 계산
- **드래그 중에만 `transition-none`** 을 붙여 손가락에 붙이고, 놓으면
  `cubic-bezier(0.32,0.72,0,1)` 로 스냅
- 스냅 판정은 **거리(44px)와 속도(0.12px/ms) 이중 조건** — 짧아도 빠르면 넘기고,
  느려도 멀리 끌면 넘김
- 6px 이상 움직이면 `suppressClickRef` 로 click 억제
- `setPointerCapture` 로 손가락이 시트 밖으로 나가도 추적 유지
- 접힌 높이를 `--mobile-chat-result-bottom-clearance` CSS 변수로 내보내
  `ProductPanel` 의 `padding-bottom` 과 `scrollPaddingBottom` 에 동시 반영

### trade-off

| 선택 | 버린 것 | 이유 |
|---|---|---|
| 라이브러리(vaul 등) 대신 직접 구현 | 검증된 접근성·엣지케이스 | 새 라이브러리 추가에 승인이 필요하고, 필요한 건 2단계 스냅뿐이라 의존성 대비 이득이 적음. 대신 `aria-controls`/`aria-expanded` 는 직접 구현하고 키보드 조작은 토글 click 으로 대체함 |
| `translate` 기반 | 레이아웃 기반 시트 | 합성 단계 처리를 노림. 대신 시트 내부 스크롤과 제스처가 충돌할 수 있어 `overscroll-y-contain` 으로 완화 |
| CSS 변수로 높이 전파 | prop 드릴링 / 전역 상태 | 부모-자식 결합이 생기지만 둘보다 가벼움 |
| 초기 상태 expanded (`bef0a8a`) | 결과 우선 노출 | 채팅이 주 기능임을 첫 화면에서 알림 |

### 시연할 장면

- 모바일 뷰포트에서 핸들을 **천천히** 끌기 → 따라옴
- **짧고 빠르게** 튕기기 → 속도로 스냅
- 접은 상태에서 상품 목록 끝까지 스크롤 → 마지막 카드가 안 가림
- 입력창 탭 시 자동 확장
- **애니메이션 성능 수치는 미측정 → `확인 필요`**

### 관련 파일

- `src/shared/chat/MobileBottomSheetFrame.tsx` (213줄, 신규)
- `src/shared/chat/ChatLayout.tsx` · `ChatConversation.tsx` · `ChatInput.tsx`
- `src/features/chat/components/ProductPanel.tsx`
- 커밋 — `bd5bdeb`(시트 도입 + 입력창 고정) → `158c940`·`9ab3d5e`(높이 조정)
  → `bef0a8a`(초기 expanded) → `c3198e8`(하단 여백을 시트 높이에 맞춤)

### 예상 질문

1. **"vaul 이나 framer-motion 을 쓰지 않은 이유는?"**
   → 필요한 게 2단계 스냅뿐이고 의존성 추가에 승인 절차가 있음.
   다만 접근성은 직접 챙겨야 하는 비용이 있었음
2. **"드래그 중 setState 가 매 move 마다 도는데 성능은?"**
   → `translate` 만 바뀌어 합성 단계에서 처리될 가능성이 높으나 **실측은 안 함, `확인 필요`**

### 3분 흐름

| 시각 | 내용 |
|---|---|
| 0:00 | 모바일에서 두 축이 충돌하는 화면 |
| 0:40 | 시트 드래그 시연 — 느리게 / 빠르게 |
| 1:20 | 속도+거리 이중 스냅 판정과 드래그 중 transition 해제 |
| 2:10 | 가림 문제를 CSS 변수 전파로 푼 것 |
| 2:40 | 교훈 — 제스처는 "따라오는 구간"과 "결정하는 구간"이 다른 규칙을 쓴다 |

---

## 5. 발표에 쓰기 전 확인이 필요한 것

| 항목 | 왜 미확정인가 |
|---|---|
| Web Locks 브라우저 지원 범위 | 코드에 degrade 경로만 있고 지원 표를 조사한 기록이 없음 |
| AI 서버의 `screen` 수신부 현황 | `e6e97d5` 시점엔 없었음. FE 코드로는 확인 불가 |
| 바텀시트 드래그 프레임 성능 | 미측정 |
| 홈 스크롤 / reveal 실측 | `home-scroll-interaction-perf-review.md` 가 스스로 미측정이라 밝힘 |

**수치를 만들지 말 것.** 필요하면 `hero-animation-perf-review.md` 처럼 CPU throttling 조건을
명시해 실측하고, 가설이 반증되면 그 사실까지 남긴다.
