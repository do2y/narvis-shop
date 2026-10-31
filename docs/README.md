# docs — 문서 색인

나비스(Narvis) 프론트엔드 문서 모음. **코드가 정본이고, 문서는 "왜"를 남기는 곳**이다.
어긋난 곳을 발견하면 문서를 고친다.

## 처음 보는 사람이 읽을 순서

1. [features/page-spec.md](features/page-spec.md) — 이 서비스가 무엇을 하는지, 화면 10개의 목적
2. [architecture/chat.md](architecture/chat.md) §0 — 한 번의 대화에 통신 경로 3개가 관여하는 이유 (이 프로젝트의 중심)
3. [architecture/auth.md](architecture/auth.md) §0 — FE가 토큰을 볼 수 없게 된 뒤의 인증 구조
4. [performance/ssr-measurement.md](performance/ssr-measurement.md) "결론" — Next.js 전환 효과를 수치로
5. [portfolio/talking-points.md](portfolio/talking-points.md) §1 — 프론트가 실제로 판단한 것만 추린 소재 등급표

## 상황별 바로가기

| 상황 | 문서 |
|---|---|
| 페이지를 새로 만든다 | [features/page-spec.md](features/page-spec.md) → 해당 섹션 |
| 챗봇을 건드린다 | [architecture/chat.md](architecture/chat.md) |
| 로그인·권한·401 을 건드린다 | [architecture/auth.md](architecture/auth.md) |
| 쿼리 키·캐시·SSR 을 건드린다 | [architecture/data.md](architecture/data.md) |
| 상태를 어디에 둘지 정한다 | [architecture/state.md](architecture/state.md) |
| 판매자 챗 계약을 확인한다 | [features/seller-chat-contract.md](features/seller-chat-contract.md) |
| 배포를 만진다 | [migration/deploy-handoff.md](migration/deploy-handoff.md) |
| 발표를 준비한다 | [portfolio/talking-points.md](portfolio/talking-points.md) |

---

## 폴더 구조

```
docs/
├── architecture/     평상시 구조 — 기능 추가 전에 읽는 문서
├── features/         무엇을 만들기로 했고 화면을 어떻게 만들었나 — 명세 · 계약 · 구현 노트
├── troubleshooting/  무엇이 잘못됐고 어떻게 판단했나 — 사고·판단 기록
├── performance/      측정과 최적화 — 가설이 측정으로 뒤집힌 기록 포함
├── migration/        Vite → Next.js 전환 — 계획 · 브라우저 검증 · 배포 인수인계
├── portfolio/        발표 소재 선정 · 초안 · 대본
├── ai-development/   생성형 AI 활용 개발 기록 (과정만 적고 기술 내용은 링크)
└── archive/          역할이 끝났지만 판단 근거가 남은 문서
```

테스트만 다루는 문서는 아직 없다. 생기면 `testing/` 을 만든다
(지금의 근거 위치는 아래 "포트폴리오 핵심 경험" 표 참조).

## architecture/ — 평상시 구조

지금 코드가 왜 이렇게 생겼는지. 코드 주석에 흩어진 판단을 영역별로 모았다.

| 문서 | 확인할 수 있는 것 |
|---|---|
| [chat.md](architecture/chat.md) | 세션 발급·SSE·카드 조회가 각각 다른 경로인 이유 · SSE 이벤트 11종 처리 규칙 · 멀티탭 세션 조정 · 대화를 탭 단위로 저장한 이유 · 게스트→회원 승계(CH-7) 실패 처리 · 판매자 draft/report |
| [auth.md](architecture/auth.md) | httpOnly 쿠키 전환 후 FE가 토큰을 다루지 않는 구조 · 새로고침 시 세션 복원 순서 · 401 코드 2종 분기와 동시 401 방어 · 가드를 서버로 옮기지 않는 이유 |
| [data.md](architecture/data.md) | 쿼리 키 목록 · staleTime 값의 근거(BE 캐시와의 합산) · **SSR `initialData` 로 필터가 안 바뀌던 사고** · 낙관적 업데이트 · 로컬 프록시 |
| [state.md](architecture/state.md) | 상태를 소유자 기준 4축으로 나눈 이유 · 스토어가 2개뿐인 이유 · 채팅에 persist 미들웨어를 안 쓴 이유 · **저장소 선택 기준**(수명이 같은 곳에 둔다) |

> data.md 와 state.md 는 상태 4축·쿼리 키 부분이 겹친다. data 는 캐시·SSR, state 는 소유권·저장소 수명이 중심.

## features/ — 명세 · 계약 · 구현 노트

| 문서 | 확인할 수 있는 것 |
|---|---|
| [page-spec.md](features/page-spec.md) | 페이지 10개의 목적과 핵심 기능. 관리자 페이지는 범위 제외(2026-08-12) |
| [seller-chat-contract.md](features/seller-chat-contract.md) | 판매자 챗 S-4 계약 원문 — 레인·패널 신호, HITL 2-스트림, 성공·실패 케이스 전수 |
| [personalization-contract.md](features/personalization-contract.md) | 개인화 마이페이지 API 5종 확정 계약(2026-08-09) · `edgeId` 교체·`graphVersion`·409 두 종류 등 버그 나기 쉬운 지점 |
| [ui-implementation-notes.md](features/ui-implementation-notes.md) | 방사형 그래프·판매자 차트·PDF 내보내기·마크다운 파서를 **라이브러리 없이** 만든 방식과 이유 |

## troubleshooting/ — 사고·판단 기록

표면 버그가 아니라 **구조적 문제**로 쓴 글. 포트폴리오용으로도 쓴다.

| 문서 | 확인할 수 있는 것 |
|---|---|
| [analytics-401-retry.md](troubleshooting/analytics-401-retry.md) | "재시도하지 않는다"는 코드에 401 하나만 예외를 둔 이유 · AT 만료 구간의 이벤트 배치가 통째로 사라지던 원인 |
| [cart-event-migration.md](troubleshooting/cart-event-migration.md) | 장바구니 이벤트를 BE로 옮기다 FE 제거가 먼저 머지된 사고 · 플래그 대신 되돌리기를 고른 이유 |

## performance/ — 측정과 최적화

| 문서 | 확인할 수 있는 것 |
|---|---|
| [ssr-measurement.md](performance/ssr-measurement.md) | CSR vs SSR 실측 — LCP 31~42% 단축 · SEO 83→100 · 폰트 서브셋 가설 반증 · **첫 판 결론을 정정한 이력** |
| [image-loading.md](performance/image-loading.md) | 상세 이미지 초기 전송량 142.9MB → 216KB · 정적 분석으로는 보이지 않던 문제를 실측으로 찾은 과정 |
| [hero-animation.md](performance/hero-animation.md) | 무한 애니메이션 3개의 비용 점검 — 가설이 측정으로 반증돼 **코드 수정 없음** |
| [home-scroll-interaction.md](performance/home-scroll-interaction.md) | 스크롤 스냅·reveal 의 비용 후보 3가지. **정적 코드 리뷰만 했고 실측은 안 함** |

## migration/ — Next.js 전환

| 문서 | 확인할 수 있는 것 |
|---|---|
| [nextjs-migration-plan.md](migration/nextjs-migration-plan.md) | 전환 목표·비목표(인증 페이지는 SSR 하지 않음) · 새 프로젝트로 점진 이식한 5단계 계획 · 위험 요소 |
| [nextjs-migration-qa.md](migration/nextjs-migration-qa.md) | 브라우저 검증 시나리오 9개 · **curl·빌드는 통과했지만 브라우저에서만 드러난 버그 5건** |
| [deploy-handoff.md](migration/deploy-handoff.md) | 배포 담당자용 인수인계 — nginx + node 2프로세스 · 롤백 절차 · 배포 후 확인 항목 |

## portfolio/ — 발표 자료

| 문서 | 확인할 수 있는 것 |
|---|---|
| [talking-points.md](portfolio/talking-points.md) | **소재 등급표 · 프레이밍 · 말하면 안 되는 것** — 프론트 기여도 기준. 발표 준비의 출발점 |
| [talk-candidates.md](portfolio/talk-candidates.md) | 소재를 고르기 위한 조사 — 후보 5선(멀티탭 세션 · 화면 context · 바텀시트 등)과 상위 3개 상세 |
| [chat-session-design.md](portfolio/chat-session-design.md) | 채팅 세션 설계 통합본 — 멀티탭 중복 발급 방지 · 게스트→회원 승계 · 실패 UX |
| [frontend-draft.md](portfolio/frontend-draft.md) | 발표 초안 전체 (슬라이드 15장 · 평가지표 6항목 대응표) |
| [script-chat.md](portfolio/script-chat.md) | 발화 대본 — 채팅 3블록(스트림·탭·대화). 대사별 코드 근거 포함 |
| [script-state.md](portfolio/script-state.md) | 발화 대본 — 상태 관리. AI 행동이 사용자 조작과 같은 갱신 경로로 합류 |

## ai-development/ — AI 활용 개발 기록

| 문서 | 확인할 수 있는 것 |
|---|---|
| [README.md](ai-development/README.md) | 기록 원칙(기술 내용은 링크로만) · 템플릿 · 기존 문서에 근거가 있는 기록 후보 |
| [claude-md-drift.md](ai-development/claude-md-drift.md) | AI가 매 세션 읽는 CLAUDE.md 가 구현보다 뒤처졌던 6개 지점 |

## archive/ — 보관

| 문서 | 확인할 수 있는 것 |
|---|---|
| [personalization/](archive/personalization/README.md) | 개인화 마이페이지 초안 기준 계획서 3종. 계약은 낡았지만 결정 기록이 남아 있어 보관 |

---

## 포트폴리오 핵심 경험 — 근거 문서

| 경험 | 근거 |
|---|---|
| SSE 실시간 스트리밍 | [architecture/chat.md](architecture/chat.md) §1·§5·§6-1 · [portfolio/script-chat.md](portfolio/script-chat.md) 블록 1 |
| 세션·스레드 구조 (멀티탭 · 게스트→회원 승계) | [architecture/chat.md](architecture/chat.md) §3·§8·§9 · [portfolio/chat-session-design.md](portfolio/chat-session-design.md) |
| Next.js 마이그레이션 | [migration/](migration/nextjs-migration-plan.md) 3종 |
| SSR 성능 측정 | [performance/ssr-measurement.md](performance/ssr-measurement.md) |
| 인증·API 통신 설계 | [architecture/auth.md](architecture/auth.md) · [troubleshooting/analytics-401-retry.md](troubleshooting/analytics-401-retry.md) |
| 상태 관리 | [architecture/state.md](architecture/state.md) · [portfolio/script-state.md](portfolio/script-state.md) |
| 실제 오류 분석·해결 | [performance/image-loading.md](performance/image-loading.md) · [architecture/data.md](architecture/data.md) §3 · [troubleshooting/cart-event-migration.md](troubleshooting/cart-event-migration.md) · [migration/nextjs-migration-qa.md](migration/nextjs-migration-qa.md) |
| 테스트 자동화 | 전용 문서 없음 — [portfolio/frontend-draft.md](portfolio/frontend-draft.md) 슬라이드 8·10 · [portfolio/chat-session-design.md](portfolio/chat-session-design.md) §6 · 커밋 `889bc03` |
| 라이브러리 없이 만든 UI | [features/ui-implementation-notes.md](features/ui-implementation-notes.md) |

## 문서를 쓸 때

- **개조식(~함/~음)** 으로 쓴다. PR 본문도 같다.
- 리뷰어 설득이 아니라 **미래의 나를 위한 기록** — "왜 이렇게 했는지"가 중심이다.
- 사건 기록은 표면 버그가 아니라 **구조적 문제**로 쓴다. 정리할 건은 먼저 제안한다.
- 되돌려질 위험이 있는 판단은 **"이걸 넓히지 말 것"** 을 명시한다
  (예: 401 재전송을 5xx 로 확대 금지).
- 문서를 옮기거나 이름을 바꾸면 루트 `CLAUDE.md`·`README.md`와 코드 주석의 경로도 함께 고친다.
- 계약·구조가 바뀌는 커밋은 CLAUDE.md 를 같이 고친다 — 어긋났던 이력은 [ai-development/claude-md-drift.md](ai-development/claude-md-drift.md).
