# 테스트 — 계약을 테스트로 고정한 이유와 범위

> FE·BE·AI 서버가 **동시에** 개발되는 상황에서 "상대가 무엇을 보낼지"를 붙잡아 두려고 쓴 테스트의 기록.
> 측정 기준 2026-10-31 — `npm run test` 결과 **36개 파일 · 330건 통과**.
>
> 설정: `vitest.config.mts` · 대상: `src/**/*.test.ts`(순수 모듈)

## 문제 — 붙어야만 확인되는 화면

- 채팅 화면 하나가 BE(세션 발급·카드 조회)와 AI 서버(SSE)를 **둘 다** 거쳐야 동작한다
- 정작 위험한 경우는 브라우저에서 손으로 재현할 수 없었다
  - SSE 프레임 하나가 깨져서 옴
  - 서버가 마지막 프레임을 `\n\n`으로 닫지 않고 끊음
  - `progress`가 0회인 턴, 모르는 `stage`가 추가됨
  - 사용자가 응답 도중 화면을 떠남
  - 탭 여러 개가 동시에 세션을 발급하려 함
- 이걸 브라우저에서 보려면 **상대 서버가 그렇게 보내 주기를 기다려야** 한다

## 선택

| 선택 | 버린 대안 | 이유 |
|---|---|---|
| 판단 로직을 **순수 함수로 떼어내** 그 함수를 테스트 | E2E·통합 테스트 | 세 서버가 다 붙어야 도는 테스트는 상대 구현을 기다려야 한다. 순수 함수는 지금 검증할 수 있다 |
| 계약 문장을 **테스트 제목으로** 옮김 | 기능 이름 위주 네이밍 | 계약이 바뀌어 테스트가 깨지면 **어떤 약속이 깨졌는지가 제목에서 바로 읽힌다** |
| 컴포넌트 렌더 테스트는 두지 않음 | `@testing-library/react` 도입 | `@vitejs/plugin-react`가 babel 8을 요구해 기존 의존성과 충돌. 대상이 전부 순수 모듈이라 JSX 변환이 필요 없다(`vitest.config.mts` 주석) |

제목 예 (실제 테스트):

- `깨진 JSON 은 던지지 않고 흘려보낸다 — 뒤따르는 정상 프레임을 살리기 위해`
- `모르는 stage 는 직전 문구를 지우지 않는다 — 무시는 초기화가 아니다`
- `이름만 맞아도 잡는다 — 환경마다 생성자가 달라 instanceof 로는 새 나간다`
- `실패해도 말풍선은 남긴다 — 로그인했더니 대화가 사라지면 안 된다`

## 무엇을 고정했나 — 채팅 (`src/shared/chat`, 13개 파일 · 106건)

| 변수 | 테스트 (건수) | 고정한 약속 | 근거 문서 |
|---|---|---|---|
| 프레임이 깨지거나 안 닫힘 | `streamChat.test.ts` (7) | 한 프레임의 문제가 턴 전체를 죽이지 않는다 · 종결 이벤트 없이 끝나면 실패다 | `docs/troubleshooting/stream-lifecycle-bugs.md` ① |
| 사용자가 도중에 떠남 | `abortError.test.ts` (5) | 중단은 오류로 표시하지 않는다 | 같은 문서 ② |
| 이벤트 순서 | `chatEventHandler.test.ts` (13) | `report`는 `done{replace}`에서만 커밋 · token이 progress를 지우지 않음 · 늦게 온 묶음도 `listIds` 순서 유지 · 조회 실패 시 이전 카드 유지 | `docs/architecture/chat.md` §4·§5 |
| AI가 stage를 추가함 | `progress.test.ts` (8) | 모르는 stage는 무시하되 직전 문구를 지우지 않는다 | `chat.md` §5 |
| 칩이 값마다 1개로 옴 | `conditionRemoval.test.ts` (12) | `(field, value)` 쌍이라야 칩이 특정된다 | `chat.md` §7 |
| 탭 여러 개 | `sessionCoordinator.test.ts` (13) | 신선한 캐시가 있으면 CH-1을 부르지 않는다 · 승계 실패 중에는 새 세션을 만들지 않는다 | `chat.md` §3·§9 |
| 로그인 승계 실패 | `claimOnLogin.test.ts` (12) | 네트워크 실패도 배너로 알린다 · 말풍선은 남긴다 | `chat.md` §9 |
| 구버전 서버가 report를 안 보냄 | `analysisReport.test.ts` (5) | token 연문을 부분치로 승계한다 | `chat.md` §10 |
| 판매자 초안 만료 | `activeDraft.test.ts` (4) | 수정 턴에서 만료 시각도 함께 갱신된다 | `docs/architecture/state.md` |

그 밖에 `chatPersistence`(7) · `threadId`(5) · `attachment`(10) · `errorMessage`(5).

**테스트가 실제로 잡는지 확인한 방법** — `chatEventHandler.test.ts`를 추가할 때(`889bc03`)
지키려는 규칙 6개를 일부러 깨 보고 테스트가 실패하는지 확인했다.

## 채팅 밖

| 영역 | 테스트 (건수) | 고정한 것 |
|---|---|---|
| 찜 낙관적 갱신 | `shared/hooks/wishlistOptimistic.test.ts` (15) | 목록 캐시가 없으면 만들지 않는다 · 중복 삽입 방지 등 경계 조건 (→ `docs/architecture/data.md` §4) |
| 수집 401 재전송 | `shared/analytics/retry.test.ts` (16) | 재전송 대상은 401 하나 · 1회뿐 · 5xx·네트워크 오류는 재전송하지 않음 (→ `docs/troubleshooting/analytics-401-retry.md`) |
| 화면 맥락 | `features/chat/useScreenContext.test.ts` (5) | 추천 카드는 보내지 않는다 · 상한 20개 (→ `chat.md` §11) |
| 취향 그래프 배치 | `features/mypage/preferences/components/graphLayout.test.ts` (18) | 관계별 각도 배분 · 서버 정렬 보존 · 이웃 라벨 겹침 방지 (→ `docs/features/ui-implementation-notes.md` §1) |
| 마크다운 파서 | `shared/utils/markdown.test.ts` (25) | HTML 태그를 해석하지 않는다 · 합의한 4종 밖의 문법은 평문 (→ `ui-implementation-notes.md` §3) |

## 한계

- **전부 순수 모듈 단위 테스트다.** 세 서버가 실제로 붙었을 때의 동작은 수동으로 확인한다
- **컴포넌트 내부 상태는 테스트가 없다** — 예: 이미지 업로드 세대 토큰(`ChatInput.tsx`), 언마운트 abort 타이밍
- **멀티탭은 탭 2개를 실제로 띄운 자동 검증이 없다** — `sessionCoordinator`의 판단 로직만 고정돼 있다
- StrictMode 가짜 언마운트 회귀(`36fb6d5`)처럼 **브라우저에서만 드러난 결함**이 있었다
- 커버리지는 측정하지 않는다
- **커밋된 CI(`.github/workflows/ci.yml`)는 lint·build만 돌린다** — 테스트는 아직 PR 게이트가 아니다

## 실행

```bash
npm run test          # vitest run
npx vitest run src/shared/chat   # 채팅만
```
