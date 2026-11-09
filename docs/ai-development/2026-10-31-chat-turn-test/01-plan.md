# 01 · 계획 (개발 전)

> 작성 2026-10-31. 개발 시작 전 상태를 기록함 — 이후 바뀐 결정은 [02-interaction-log.md](02-interaction-log.md)에 남기고 여기는 고치지 않음.

## 1. 문제

### 대상

[`src/shared/chat/useChat.ts`](../../../src/shared/chat/useChat.ts) — 한 턴의 실행(`run`)과 그 진입점(`send`·`confirm`·`retry`·`removeCondition`·`startNewChat`), 언마운트 처리.

`889bc03`에서 이벤트 처리를 `chatEventHandler`로 떼어 테스트했지만, **떼고 남은 쪽은 테스트가 0건**임.
남은 쪽의 책임은 "부품을 올바른 순서와 분기로 엮는 것" — 부품별 테스트로는 잡히지 않음.

### 테스트되지 않은 분기와 사용자 영향

| # | 분기 | 깨지면 |
|---|---|---|
| R1 | 스트리밍 중이면 `run` 즉시 종료 | 연타 시 2회 전송 → 장바구니 중복 담기 |
| R2 | 시작 전 401 → 티켓 재발급 후 **1회만** 재시도 | 티켓 TTL 경계에서 전송 실패, 또는 무한 재시도 |
| R3 | 401 외 시작 실패는 재시도 안 함 | 409·429에서 재시도해 상황 악화 |
| R4 | `turn.settle()` 대기 후 `finally` | 카드 조회 전에 입력창이 풀려 다음 턴과 섞임 |
| C1 | abort → 실패 말풍선 없음 | 새 대화·이탈 시 "응답을 받지 못했어요"가 남음 |
| C2 | 승계 대기 → `retryable:false` | 같은 이유로 막히는 재시도 버튼 노출 |
| C3 | 404 → 세션 캐시·sessionId 비움 | 만료 세션으로 계속 실패 |
| C3' | catch 순서: 404 판정이 `StreamStartError` 분기보다 앞 | 404가 일반 오류로 떨어져 캐시가 안 비워짐 |
| C4 | 종결 이벤트 없이 끝남 → 실패 | 반쯤 잘린 답변이 버튼 없이 남음 |
| C5 | 시작 거부 상태별 안내 (403·409·429·504·기타) | 429에 재시도 버튼 노출 |
| F | `finally`: `isStreaming`·progress 정리 | 입력창 영구 잠김 |
| S1 | 메시지·칩 제거 둘 다 비면 전송 안 함 | 계약상 400 |
| S2 | 칩 제거 턴은 `search` 수집 안 함 | 분석 데이터 오염 |
| S3 | `retry` 시 이미지까지 재전송 | 초안이 사진 없이 생성 |
| N1 | `startNewChat`: abort → 저장소 비움 → reset → threadId | 새로고침 시 이전 대화 부활 |
| U1 | 언마운트 abort를 한 틱 미룸 | StrictMode에서 `?q=` 진입 시 SSE 미발신 |

C1·U1은 실제로 있었던 결함의 재발 방지 대상임 → [troubleshooting/stream-lifecycle-bugs.md](../../troubleshooting/stream-lifecycle-bugs.md).

### 기존 테스트와의 경계

이벤트 순서(`chatEventHandler.test.ts`) · 세션 발급·캐시(`sessionCoordinator.test.ts`) · 판정 함수(`abortError.test.ts`)는 **다시 테스트하지 않음.**
목록 → [testing/contract-tests.md](../../testing/contract-tests.md).

### 결함 의심 H1 (코드 대조로 세운 가설, 미검증)

칩 제거 턴·판매자 승인(confirm) 턴이 실패한 뒤 "다시 시도"를 누르면 **실패 말풍선만 사라지고 재전송되지 않을** 가능성.

- 두 턴은 사용자 말풍선을 남기지 않음(`userText: null`)
- `dropLastExchange`는 실패 assistant를 먼저 제거하고, 직전이 user가 아니면 `null` 반환 → `retry`는 아무것도 안 함
- 실패 말풍선의 `retryable` 기본값이 true라 버튼은 보임
- 칩 제거는 화면에서 칩이 이미 지워져 있어(낙관적 제거) 서버 조건과 화면이 어긋난 채로 남음

처리 방침: **테스트로 재현 여부만 확인.** 수정은 프로덕션 변경이라 재현 후 별도 승인.

## 2. 목표

- 위 16개 분기를 테스트로 고정 (프로덕션 코드 변경 0줄)
- 사전에 정한 변이로 테스트 유효성을 측정하고, 살아남은 변이는 원인을 분류해 보강하거나 사유를 남김
- H1 재현 여부를 판정

**비목표**: H1 수정 · 리팩터링 · 커버리지 도구 도입 · 멀티탭 통합 테스트

## 3. 기준값 (2026-10-31 17:33, 변경 전)

| 항목 | 명령 | 결과 |
|---|---|---|
| 단위 테스트 | `npx vitest run` | **36 파일 · 330건 통과** · Duration 6.96s (wall 8.0s) |
| lint | `npx eslint .` | 통과 (exit 0, 경고 출력 없음) |
| 빌드 | `npm run build` | 통과 (exit 0, wall 10.9s) |
| `useChat` 분기 커버 | §1 표와 테스트 대조 | **0 / 16** |

- 환경: Apple M4 · macOS 27.0.1 · Node v24.21.0 · HEAD `3259bad`
- 작업 트리에 이 과제와 무관한 미커밋 변경 2건이 있는 상태에서 측정함
  (`src/mocks/handlers.ts` 임시 블록 — `MOCK_API` 모드에서만 동작, `.github/workflows/ci.yml` 테스트 단계 — 빌드 무관)

## 4. 테스트 방식 비교

| 기준 | A. 순수 함수 추출 | **B. RTL `renderHook`** (채택) | C. 직접 만든 renderHook |
|---|---|---|---|
| 프로덕션 변경 | `run` 등 약 150줄 이동 + 의존성 주입 | **0줄** | 0줄 |
| 라이브러리 | 없음 | `@testing-library/react` · `@testing-library/dom` (dev) | 없음 |
| 검증 대상 | 추출된 함수 | **컴포넌트가 실제로 부르는 `useChat`** | 같음 |
| U1(언마운트·StrictMode) | 불가 | 가능 | 가능 |
| 변이 대상 | 추출된 새 코드 (추출 자체의 무변경도 따로 증명 필요) | **현재 운영 코드 그대로** | 같음 |
| 유지보수 | 테스트 때문에 생긴 주입 구조가 남음 | 표준 API | 자작 유틸 관리 |

**B를 고른 이유**: 프로덕션 변경 없이 운영 코드를 그대로 변이할 수 있고, 과거 실제 결함(U1)을 검증할 수 있는 선택지.
기존에 RTL을 두지 않은 이유(`@vitejs/plugin-react`의 babel 8 충돌, [contract-tests.md](../../testing/contract-tests.md) "선택")는
**JSX 변환이 필요한 컴포넌트 렌더**에 해당함. `renderHook`은 JSX가 필요 없어 플러그인 없이 쓸 수 있다고 판단 — 설치 단계에서 확인.

### 목 경계

| 진짜 | 가짜 | 이유 |
|---|---|---|
| `streamChat` 파서 · `createTurnHandler` · `useChatStore` · `chatPersistence` · `chatErrors` | `global.fetch`(SSE 응답) · `sessionCoordinator` · `lists.fetchChatListGroup` · `analytics/track` | 네트워크 경계에서만 끊음. 실제 SSE 바이트가 진짜 파서 → 핸들러 → 스토어를 지남. 코디네이터는 Web Locks·BroadcastChannel 의존이고 자체 테스트가 있음 |

## 5. AI 활용 계획

### 역할 구분

| AI (Claude Code) | 개발자 |
|---|---|
| 분기 열거 · 위험 서술 · 방식 비교 초안 | 방식·목 경계 결정 |
| 변이 목록 초안 | 변이 목록 검토 + **직접 3개 이상 추가** |
| 테스트 초안 작성 | 테스트가 분기 의도를 실제로 검증하는지 검토 (단언이 느슨하지 않은지) |
| 변이 실행 스크립트 · 결과 집계 | 살아남은 변이의 분류(보강 / 동등 / 테스트 불가) 판정 |
| H1 재현 테스트 | 수정 여부·방식 결정 |

### 작업 분할

분기 그룹별로 끊어서 요청함 — R(전송·재시도) → C(실패 분류) → S·N(진입점) → U(생명주기).
그룹마다 테스트 실행 결과를 확인한 뒤 다음 그룹으로 넘어감.

### 위험과 대응

| 위험 | 대응 |
|---|---|
| AI가 **구현을 보고** 테스트를 써서 현재 동작을 그대로 베낌 (버그도 정답으로 고정) | 테스트 제목을 계약·사용자 영향 문장으로 씀. H1처럼 의심 동작은 정답으로 고정하지 않고 별도 표시 |
| 잡히는 변이만 고르는 편향 | 변이 목록을 **테스트 작성 전에** 고정. 개발자 추가분은 따로 집계 |
| 단언이 느슨해 변이가 살아남음 (예: "에러가 있다"만 확인) | 변이 검증이 이것을 드러내는 장치임 — 살아남은 변이를 그대로 기록 |
| 변이가 운영 코드에 남음 | 별도 git worktree에서만 적용 → 종료 후 `git diff --quiet src/` + 전체 재검증 |
| 시간 단축 과장 | 비교 실험이 없으므로 주장하지 않음. 단계별 소요만 기록 |

## 6. 변이 절차

1. 변이는 **별도 git worktree**에서만 적용 — 작업 트리의 프로덕션 코드는 바뀌지 않음
2. 변이 1개 = 패치 1개. 적용 → `npx vitest run src/shared/chat/useChat.test.ts` → 결과 기록 → 되돌림
3. 종료 후 worktree 삭제 → 작업 트리에서 `git diff --quiet src/` 확인 → 전체 vitest · eslint · build
4. 패치와 실행 스크립트는 근거로 이 폴더에 보관

### 변이 초안 (AI 작성, 개발자 검토 전)

| # | 변이 | 노리는 분기 |
|---|---|---|
| M1 | `isStreaming` 가드 제거 | R1 |
| M2 | 401 재시도 제거 | R2 |
| M3 | 재발급 없이 기존 티켓으로 재시도 | R2 |
| M4 | 403에도 재시도 | R3 |
| M5 | catch에서 404 분기와 `StreamStartError` 분기 순서 교체 | C3' |
| M6 | abort 분기 제거 | C1 |
| M7 | 404에서 `clearCachedSession` 제거 | C3 |
| M8 | 승계 대기를 `retryable:true`로 | C2 |
| M9 | `await turn.settle()` 제거 | R4 |
| M10 | `finally`의 `setStreaming(false)` 제거 | F |
| M11 | `send` 빈 요청 가드 제거 | S1 |
| M12 | 칩 제거 턴에도 `track` | S2 |
| M13 | `retry`에서 `imageUrls` 누락 | S3 |
| M14 | `startNewChat`에서 `clearChat` 제거 | N1 |
| M15 | 언마운트 abort를 즉시 실행(`setTimeout` 제거) | U1 |
