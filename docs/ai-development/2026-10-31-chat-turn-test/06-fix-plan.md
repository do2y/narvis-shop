# 06 · 결함 수정 계획 (승인 대기)

> 2026-10-31 · 작성 Claude Code · **개발자 최종 승인 전 — 프로덕션 코드 변경 없음**
> 범위·순서는 개발자가 정함(02 #11): B1~B4 → H1 → A1·A2, **변경 단위별로 분리**. 일반 발화 재시도 위험·R1은 [07-issues.md](07-issues.md)로 분리.

## 0. 변경 단위

| 단위 | 해결 대상 | 원인 | 파일 | 저장 데이터 영향 |
|---|---|---|---|---|
| **1단계** | B1·B2·B3·B4 | `retry()`가 대상을 모르고, 진행 중·성공 턴도 지움 | `useChat.ts` · `store.ts` · `MessageList.tsx` · `ChatConversation.tsx` · `seller/ChatPage.tsx` | 없음 |
| **2단계** | H1 | 말풍선 없는 턴의 요청이 남지 않음 | `store.ts`(타입) · `useChat.ts` | `ChatMessage`에 선택 필드 1개 |
| **A 단위** | A1·A2 (A3) | 끝난 턴이 현재 턴인지 확인하지 않고 공유 스토어를 씀 | `store.ts` · `useChat.ts` · `chatEventHandler.ts` | 없음 (새 필드는 저장 대상 아님) |

각 단위 = 브랜치 안의 별도 커밋. 단위마다 **전체 테스트 · eslint · build · 변이 재실행**을 따로 기록함.

---

## 1단계 — 재시도 대상 고정 (B1~B4) — ✅ 구현·검증 완료 (2026-10-31, `6640937`)

### 결과 요약

| 결함 | 해결 확인 | 근거 테스트 | 변이 |
|---|---|---|---|
| B1 연타 → 다시 보낸 턴 말풍선 삭제 | ✅ | `[B1]` 2건 (같은 틱 연타 · 실패 표시와 진행 중이 겹친 구간) | E1 |
| B2·B3 진행 중 재시도 → 진행 중 턴 삭제·토큰이 이전 답에 붙음 | ✅ | `[B2·B3]` | E3 |
| B4 위쪽 실패 재시도 → 마지막 성공 질문 재전송 | ✅ | `[B4]` 2건 (뒤가 성공 / 뒤도 실패) · `[MessageList]` 2건 | E2 · E4 |
| H1 말풍선 없는 턴 재시도 | ❌ 의도대로 미해결 (2단계) | `[H1 재현]` 2건이 여전히 재현 | — |

실제 변경, RED→GREEN, 변이 결과 → [03-validation.md](03-validation.md) §9

### 계획 (구현 전 작성분 — 아래는 고치지 않음)

### 변경

| # | 파일 | 지금 | 바꾼 뒤 |
|---|---|---|---|
| ① | `useChat.ts` `retry` | `retry()` — 인자 없음, 바로 `dropLastExchange()` | `retry(messageId)` — **스트리밍 중이 아니고**, 대상이 **마지막 메시지**이며, **실패했고**, `retryable !== false`일 때만 진행. 아니면 아무것도 하지 않음 |
| ② | `MessageList.tsx` | 실패 말풍선마다 버튼, `onClick={onRetry}` | **마지막 메시지일 때만** 버튼, `onClick={() => onRetry(msg.id)}` |
| ③ | `store.ts` `dropLastExchange` | 마지막이 assistant면 무조건 제거 | 마지막 assistant에 **`error`가 있을 때만** 제거, 아니면 아무것도 바꾸지 않고 `null` |
| — | `ChatConversation.tsx` | `onRetry: () => void` | `onRetry: (messageId: string) => void` (전달만) |
| — | `seller/ChatPage.tsx` | 등록 카드에 `onRetry={retry}` | 카드는 대상 id를 모르므로 `() => retry(lastMessage.id)` 로 감쌈 — 카드의 오류 상태 자체가 "마지막 메시지의 error"에서 나오므로 대상이 일치함 ([ChatPage.tsx:109-114](../../../src/features/seller/ChatPage.tsx#L109-L114)) |

①②③은 같은 결함에 대한 **삼중 방어**: ②는 UI에서 버튼을 없애고, ①은 훅이 잘못된 호출을 거르고, ③은 저장소가 진행 중 턴을 지우지 않음.

### 데이터 구조 · 호환성

- 타입·저장 포맷 변경 없음
- **사용자에게 보이는 변화**: 대화 위쪽에 남은 실패 말풍선에서 "다시 시도" 버튼이 사라짐 → 그 질문은 다시 입력해야 함. ⚠️ **UX 변경이므로 개발자 확인 필요**
  - 대안: 위쪽 버튼을 남기고 그 말풍선 **자기 질문**을 재전송 — 그러면 대화 중간에 답이 끼어드는 순서 문제가 생겨 범위가 커짐 → 제안하지 않음

### 회귀 테스트

| 테스트 | 막는 결함 | 방법 |
|---|---|---|
| 같은 틱에 `retry(id)` 2회 → 요청 1회, 말풍선 보존 | B1 | 훅 (프로브 B1을 단언으로) |
| 재전송 턴 진행 중 `retry(id)` → 요청·말풍선 변화 없음, 토큰은 그 턴 말풍선에 | B2·B3 | 훅 |
| 뒤에 성공 턴이 있을 때 위쪽 실패 id로 `retry` → 아무 일 없음, 성공 답 보존 | B4 | 훅 |
| `dropLastExchange` — 마지막이 실패 아닌 assistant면 변경 없음 | ③ | 스토어 |
| `MessageList` — 마지막 실패 말풍선에만 버튼, 클릭 시 그 id 전달 | ② | **컴포넌트 렌더** — vitest에서 JSX 컴포넌트 렌더가 플러그인 없이 동작함을 확인함(02 #11). `vitest.config.mts`의 `include`에 `.test.tsx`를 넣을지, `.test.ts`에서 `createElement`로 쓸지 결정 필요 |
| 기존 S3·`[H1 재현]` | — | `retry()` → `retry(lastMessage().id)`로 호출부만 바뀜. H1 재현 테스트는 1단계에선 **여전히 재현돼야 함**(H1은 2단계) |

### 변이 (1단계용, 테스트 작성 전 고정 · 기존 15개와 별도 집계)

| # | 주입 | 노리는 테스트 |
|---|---|---|
| E1 | ①의 스트리밍 가드 제거 | B1·B2 |
| E2 | ①의 "마지막 메시지" 확인 제거 | B4 |
| E3 | ③의 `error` 확인 제거 | 스토어 · B2 |
| E4 | ②의 `isLast` 조건 제거 | MessageList |

기존 M13(`retry` 본문 치환)은 문자열이 바뀌므로 **재정의 필요** — 같은 의미(재시도에서 이미지 누락)로 새 문자열을 지정하고 02에 사유 기록.

---

## 2단계 — 요청 보존과 유형별 재시도 정책 (H1)

### 데이터 구조

```ts
// store.ts — ChatMessage 에 선택 필드 1개
/**
 * 말풍선 없는 턴(칩 제거·판매자 승인)이 실패했을 때 **다시 보낼 최소 정보**.
 * 재시도해도 안전하다고 판정된 실패에만 남는다. 성공한 턴·일반 발화에는 없다.
 * sessionId·threadId·티켓·화면 맥락은 담지 않는다 — 재시도 시점에 새로 구한다.
 */
resend?:
  | { kind: "conditions"; actions: ConditionAction[] }
  | { kind: "confirm"; draftId: string };
```

### 실패 분류 — "서버가 처리했는가"

> ⚠️ **v1(아래 접힌 표)은 "요청을 보냈는가"와 "서버가 처리했는가"를 혼동했음** — 개발자가 이 혼동 여부를 검토하라고 요구(02 #12)해 AI가 다시 확인한 결과, HTTP 5xx를 "미도달 확정"에 넣은 것이 틀렸음.
> `504 UPSTREAM_TIMEOUT(first-token)`은 이름 그대로 **파이프라인이 시작된 뒤** 첫 토큰을 기다리다 난 타임아웃이고([chatErrors.ts](../../../src/shared/chat/chatErrors.ts) `case 504` 주석), 502·503은 ALB·nginx가 **처리 중 끊긴 업스트림**을 대신 응답한 것일 수 있음. "응답을 받았다"는 "처리하지 않았다"가 아님.

**v2 — 세 축을 분리함**

| 질문 | 판단 방법 |
|---|---|
| ① 요청이 AI 서버로 **나갔는가** | `streamChat`의 fetch 호출 직전에 표시 — 그 전 실패(세션·티켓·승계)는 "안 나감" |
| ② 서버가 **응답했는가** | `StreamStartError`(HTTP 응답 있음) vs 네트워크 오류·끊김(응답 없음/불완전) |
| ③ 그 응답이 **"처리 전 거부"라고 계약이 보장하는가** | 계약이 파이프라인 진입 전 검증으로 명시한 상태 코드만 |

| 분류 | 해당 실패 | 근거 |
|---|---|---|
| **안 나감** | 세션·티켓 확보 실패 · 승계 대기(`SessionClaimPendingError`) · 발급 단계 404 | ① 거짓 — AI 서버에 요청이 없었음 |
| **처리 전 거부** | `StreamStartError` 중 **400 · 401 · 403 · 404 · 409 · 429** | 계약상 스트림 시작 전 검증 실패(필드·티켓·권한·세션 만료·동시 스트림·요청 과다). 판매자 계약 §4.1: "`meta` 조차 못 받는다" |
| **불명** | `StreamStartError` **5xx 전부**(504 포함) · 위 목록 밖 상태 코드 · fetch 후 네트워크 오류 · 종결 없이 끊김 | 서버가 처리를 시작·완료했을 수 있음 |
| **서버 판정** | SSE `error` 이벤트 | 서버가 `retryable`을 줌 — 단 승인 턴에선 개발자 결정 (나)로 **불명과 같이 취급** |

확인 필요: 위 4xx 목록이 **현재** AI 서버에서도 "처리 전" 거부인지 — 근거가 계약 문서뿐임(판매자 계약은 archive). 확인 전까지는 목록을 넓히지 않음.

<details><summary>v1 (폐기 — 기록용)</summary>

| 분류 | 해당 실패 | 판단 근거 |
|---|---|---|
| 미도달 확정 | 세션·티켓 확보 실패 · 승계 대기 · 404 만료 · 스트림 시작 거부(HTTP 4xx/5xx 응답) | fetch 전 실패이거나, 서버가 파이프라인 진입 전 거부 응답을 줌 |
| 불명 | 종결 없이 끊김 · fetch 후 네트워크 오류 | 서버가 처리했는지 FE가 알 수 없음 |
| 서버 판정 | SSE `error` 이벤트 | 서버가 `retryable`을 줌 |

</details>

### 유형별 정책 (v2 분류 기준)

| 턴 | 안 나감 | 처리 전 거부 | 불명 | 서버 판정 (SSE `error`) |
|---|---|---|---|---|
| 칩 제거 | `resend` | `resend` (단 409·429는 기존대로 `retryable:false`) | `resend` — 서버 멱등(`op:remove` no-op, [chat.md](../../architecture/chat.md) §7) | 서버 `retryable` |
| **판매자 승인** | `resend` | `resend` (409·429는 버튼 없음) | **남기지 않음 · `retryable:false` · 확인 안내** | **불명과 같이 취급 — 개발자 결정 (나)** |
| 일반 발화 | 종전대로 | 종전대로 | **종전대로 — 범위 밖** ([07-issues.md](07-issues.md) I-2) | 종전대로 |

승인 불명 시 안내(제안): "등록 결과를 확인하지 못했어요. 상품 목록에서 확인한 뒤 다시 진행해 주세요."

### 재시도 동작

`retry(id)`가 대상에 `resend`가 있으면 **실패 말풍선만** 지우고(user 말풍선이 없으므로) `run`을 그 정보로 다시 실행.
- 칩: `send()`를 거치지 않고 `run` 직행 — 낙관적 제거를 다시 하지 않고(이미 지워져 있음), 검색 수집도 하지 않음(S2와 일관)
- 승인: `{ action: "confirm", draftId }`
- 1단계의 가드(스트리밍 중·마지막·실패·`retryable`)를 그대로 거침 → 연타 방지

### 저장 데이터 호환성 · 보안

| 항목 | 판단 |
|---|---|
| 옛 저장분 (필드 없음) | `resend` 없음 → 말풍선 없는 실패 턴은 재시도 대상 없음 → **1단계 이후엔 아무것도 지우지 않고 끝남**(③). 버튼은 보일 수 있으나 무해. sessionStorage(탭 단위)라 배포 후 오래 남지 않음 |
| 복원 시 형태 검증 | `loadChat`이 메시지를 검증 없이 돌려줌([chatPersistence.ts:54-72](../../../src/shared/chat/chatPersistence.ts#L54-L72)) → 재시도 시점에 `resend`를 **타입 가드로 좁혀** 형태가 다르면 무시(요청 안 보냄) |
| 저장 내용 | 칩 `field`·`value`(사용자가 고른 필터) 또는 `draftId`(서버 UUID)만. 인증·세션·화면 맥락·이미지 URL 없음 |
| 노출면 | 같은 sessionStorage에 이미 대화 원문이 저장됨 — 새 노출면 아님 |
| 복원 후 만료된 `draftId` | 서버가 `not_found` 안내(계약 §4.3) — 중복 실행 아님 |

### 회귀 테스트

| 테스트 | 근거 |
|---|---|
| 칩 제거 "처리 전 거부"(예: 401 두 번) → `retry(id)` → 같은 `conditionActions` · user 말풍선 없음 · 실패 말풍선만 제거 · 다른 칩 재제거 없음 · 수집 없음 | H1 |
| 칩 제거 불명 실패(끊김·500) → 재시도 가능 | 정책 |
| 승인 "안 나감"(세션 실패) · "처리 전 거부"(401·403·404) → `retry(id)` → 같은 `draftId` | H1 |
| **승인 불명: 500 · 502 · 503 · 504 · 끊김 · fetch 후 네트워크 오류 → 버튼 없음 · `resend` 없음 · `retry(id)`해도 요청 없음** | 정책 — 개발자 지시 · v2 분류 |
| **승인 SSE `error`(`retryable:true`라도) → 위와 동일** | 개발자 결정 (나) |
| 분류 경계: 첫 시도 401 → 재발급 → 두 번째 시도에서 500 → **불명**(최종 실패 기준) | ① 표시 시점 |
| 성공 턴에는 `resend`가 없음 | 데이터 |
| 저장 → 복원 후 재시도 동작 · 깨진 `resend`는 요청 없이 무시 | 호환성 |
| `[H1 재현]` 2건 → "재전송한다"로 반전 (승인 건은 미도달 실패로 재현하고 있으므로 재전송 쪽) | — |

변이(2단계용, 별도 집계): F1 분류 반전(불명을 미도달로) · F2 칩 재시도에서 낙관적 제거 재적용 · F3 `resend` 타입 가드 제거 · F4 성공 턴에도 `resend` 기록.

---

## A 단위 — 턴 소유권 (A1·A2)

### 원인 다시 보기

| | 지금 | 문제 |
|---|---|---|
| 새 대화 | `abort()` → `reset()` (`isStreaming:false`) → 새 방 | 중단된 턴은 **비동기로** 아직 살아 있음 |
| 이전 턴의 남은 작업 | 세션 확보 `await` 이후 · catch · `finally` · 카드 조회 `.then` | 전부 **"내가 아직 현재 턴인가"를 묻지 않고** 공유 스토어를 씀 |

`abort()`는 네트워크를 끊을 뿐, **이미 시작된 비동기 작업이 스토어에 쓰는 것을 막지 못함** — 세션 확보 `await`는 abort 신호를 받지 않고, 카드 조회 promise도 중단과 무관하게 끝남. 그래서 "abort를 더 빨리"나 "타이밍 조정"으로는 해결되지 않음.

### 설계 — 턴 id로 쓰기 권한을 묶음

```
store:   activeTurnId: string | null          (initial null, 저장하지 않음)

run():   const turnId = newId()
         setState({ activeTurnId: turnId, isStreaming: true, ... })
         const isCurrent = () => getState().activeTurnId === turnId

         ...await acquireTicket()
         if (!isCurrent()) return             ← 새 대화가 시작됐으면 여기서 멈춤(요청도 안 보냄)
         createTurnHandler({ ..., isCurrent })
         ...
catch:   if (!isCurrent()) return             ← 끝난 턴의 실패는 새 대화에 쓰지 않음
finally: if (isCurrent()) { setStreaming(false); setProgress(null); setState({activeTurnId:null}) }
         if (abortRef.current === controller) abortRef.current = null

startNewChat(): abort() → reset()           ← reset 이 activeTurnId 를 null 로 → 이전 턴의 쓰기 권한이 즉시 사라짐

chatEventHandler: onEvent 시작에서 if (!isCurrent()) return
                  카드 조회 .then 에서도 if (!isCurrent()) return
```

| 결함 | 어떻게 막히나 |
|---|---|
| A1 늦은 카드 | 카드 조회 `.then`이 `isCurrent()` 거짓 → 패널에 쓰지 않음 |
| A2 이전 `finally`가 새 턴 잠금 해제 | `finally`가 `isCurrent()` 거짓 → 새 턴의 `isStreaming`을 건드리지 않음 · 세션 확보 뒤 즉시 멈춰 요청도 안 나감 |
| A3 | A2와 같은 경로 |

**소유권을 스토어에 두는 이유** (훅 ref가 아니라): `reset()`이 이미 "새 대화 = 스토어 초기화"의 단일 지점임 → 같은 지점에서 소유권도 회수되어 **별도 동기화가 필요 없음**. 또 판매자·구매자 화면이 같은 스토어를 공유해 훅 인스턴스가 바뀌어도 일관됨.

**언마운트(C1)와의 관계**: 언마운트는 `reset()`을 부르지 않음 → 턴은 여전히 현재 턴 → `finally`가 정상적으로 `isStreaming`을 품. C1 동작 유지(테스트로 확인 예정).

### `activeTurnId` 수명 정의 (개발자 요구로 명시, 02 #12)

| 시점 | 동작 | 불변식 |
|---|---|---|
| **생성** | `run()`이 `isStreaming` 가드를 통과한 직후, **첫 `await` 전에** 새 id 발급 → `activeTurnId`·`isStreaming:true`를 **한 번의 `setState`** 로 기록 | 둘은 항상 같이 바뀜 — `isStreaming === (activeTurnId !== null)` |
| **갱신** | 턴 안에서는 바뀌지 않음. 401 티켓 재시도는 **같은 턴**(같은 id). `retry`·다음 `send`는 **새 턴**(새 id) | 한 턴의 모든 쓰기는 그 id 하나로 판정 |
| **정상 종료** | `settle()`(카드 조회) 대기 후 `finally`에서 `isCurrent()`면 `activeTurnId:null`·`isStreaming:false`·`progress:null`을 한 번에 | 카드는 턴이 현재일 때 들어옴 — R4 유지 |
| **reset (새 대화)** | `abort()` → `reset()`이 `activeTurnId:null`. 이 순간 이전 턴은 **현재가 아님** — 이후 이전 턴의 모든 쓰기 차단, 이전 턴 `finally`는 스토어를 건드리지 않음 | 새 대화의 메시지·카드·세션·로딩은 새 턴만 바꿈 |
| **언마운트** | `reset()`을 부르지 않음 → 이전 턴은 여전히 현재 → 한 틱 뒤 abort → catch(abort) → `finally`에서 정상 정리 | C1·U1 동작 유지 |
| 언마운트 후 늦은 카드 | `finally`가 먼저 `activeTurnId:null` → 그 뒤 도착한 카드 `.then`은 현재 아님 → **버림** | ⚠️ **동작 변화**: 지금은 이탈 후 늦게 온 카드가 스토어에 들어가 재진입 시 보였음. 바뀐 뒤엔 사라짐 — 개발자 확인 필요 |
| 새로고침 | `activeTurnId`는 저장 대상 아님 → `null`로 시작 | 저장 포맷 무영향 |

**`finally`에서 `abortRef` 정리**는 소유권과 별개 — `abortRef.current === controller`일 때만 비움(새 턴의 컨트롤러를 지우지 않게, A2에서 관찰된 문제).

### 서버 상태 동기화 vs 대화 UI — 개발자 결정 반영

개발자 결정(02 #12): **신뢰할 수 있는 완료 이벤트**가 확인되면 캐시 무효화는 허용, 단 이전 턴이 새 대화의 메시지·카드·세션·로딩을 바꾸면 안 됨.

| 이전 턴(현재 아님)의 이벤트 | 대화 UI (메시지·카드·진행·레인·리포트·초안) | `onAction` (쿼리 무효화) |
|---|---|---|
| `action` 중 **성공** 타입 — `isCartMutatingAction` / `isWishlistMutatingAction`이 참 | 차단 | **허용** — 서버에서 실제로 완료됐다는 계약 이벤트 |
| `action` 중 실패 타입 · 판매자 수정 결과 | 차단 | 차단 (동기화할 서버 변화 없음 · 판매자 초안 카드는 대화 UI) |
| `token`·`progress`·`conditions`·`suggestions`·`products.ready`·`draft`·`report`·`meta`·`done`·`error` | 차단 | 해당 없음 |
| 카드 조회 `.then` | 차단 | 해당 없음 |

`onDone`(판매자 패널 지시)은 대화 UI이므로 차단.

| 결정 | 선택 |
|---|---|
| `isStreaming`을 `activeTurnId !== null`로 대체할지 | 유지 — 범위 최소화. 둘을 같은 `setState`에서 갱신해 불변식으로 묶음 |

### 호환성

- `activeTurnId`는 `chatPersistence`가 저장하지 않음(저장 대상은 messages·sessionId·results·claimFailedSessionId) → 저장 포맷 무영향
- `createTurnHandler`의 `isCurrent`는 선택 인자(기본: 항상 참) → `chatEventHandler.test.ts` 무영향

### 회귀 테스트 (프로브 A1~A3를 단언으로 + 수명 정의)

| 테스트 | 근거 |
|---|---|
| **생성**: `send` 직후(첫 `await` 전) `activeTurnId`가 있고 `isStreaming`과 일치 | 수명 |
| **정상 종료**: 턴이 끝나면 `activeTurnId` null · `isStreaming` false | 수명 |
| **재시도·다음 전송은 새 id**, 401 재시도는 같은 id | 수명 |
| 카드 조회 대기 중 새 대화 → 조회가 끝나도 새 대화 패널은 비어 있음 | A1 |
| 세션 확보 대기 중 새 대화 → 새 질문 → 이전 턴이 뒤늦게 끝나도 새 턴은 `isStreaming` 유지 · 이전 턴 요청은 나가지 않음 · 중복 전송 차단 · 답은 새 턴 말풍선에 | A2 |
| 토큰 수신 중 새 대화 + 새 질문 → 같은 보장 · 새 턴의 `abortRef`가 지워지지 않음(새 대화를 다시 누르면 새 턴이 끊김) | A3 |
| **언마운트**: C1 그대로 + 언마운트 후 `activeTurnId` null | 수명 |
| 기존 N1 · U1 · R4 그대로 통과 | 회귀 |
| `chatEventHandler` 단위 — `isCurrent` 거짓이면 **이벤트 11종 어느 것도 스토어를 바꾸지 않음** | 대화 UI 격리 |
| 같은 조건에서 성공 `action`(예: `CART_ADDED`)은 `onAction` 호출 · 실패 `action`은 호출 안 함 · 스토어 불변 | 서버 동기화 분리 |

변이(A 단위용, 별도 집계): G1 `finally`의 소유권 확인 제거 · G2 카드 `.then`의 확인 제거 · G3 세션 확보 뒤 확인 제거 · G4 `reset`이 `activeTurnId`를 비우지 않음 · G5 이전 턴의 실패 `action`도 `onAction` 통과 · G6 `abortRef` 정리에서 컨트롤러 일치 확인 제거.

---

## 단위별 기록 방식

| 단위 | 기록 위치 |
|---|---|
| 테스트·변이·빌드 결과 | [03-validation.md](03-validation.md)에 단위별 절 추가 (기존 1~3차와 섞지 않음) |
| 해결된 결함 | 이 문서 각 단위 표에 "해결 확인" 열 추가 |
| AI 제안 vs 개발자 결정 | [02-interaction-log.md](02-interaction-log.md) |
