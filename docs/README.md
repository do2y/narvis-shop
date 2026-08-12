# docs — 문서 색인

나비스(Narvis) 프론트엔드 문서 모음. **코드가 정본이고, 문서는 "왜"를 남기는 곳**이다.
어긋난 곳을 발견하면 문서를 고친다.

## 어디부터 볼까

| 상황 | 문서 |
|---|---|
| 이 서비스가 뭘 하는지 알고 싶다 | [features.md](features.md) |
| 페이지를 새로 만든다 | [features.md](features.md) → 해당 섹션 |
| 챗봇을 건드린다 | [architecture-chat.md](architecture-chat.md) |
| 로그인·권한·401 을 건드린다 | [architecture-auth.md](architecture-auth.md) |
| 쿼리 키·캐시·SSR 을 건드린다 | [architecture-data.md](architecture-data.md) |
| 상태를 어디에 둘지 정한다 | [architecture-state.md](architecture-state.md) |
| 발표를 준비한다 | [presentation-talking-points.md](presentation-talking-points.md) |
| 판매자 챗 계약을 확인한다 | [FE-CONTRACT-SELLER-CHAT.md](FE-CONTRACT-SELLER-CHAT.md) |
| 배포를 만진다 | [deploy-handoff-nextjs.md](deploy-handoff-nextjs.md) |

---

## 1. 구조 — 평상시 동작

지금 코드가 왜 이렇게 생겼는지. 기능 추가 전에 읽는 문서.

| 문서 | 다루는 것 |
|---|---|
| [architecture-chat.md](architecture-chat.md) | 세 갈래 통신 경로 · SSE 11종 · 경로 B(카드) · 세션/티켓/멀티탭 · 승계(CH-7) · 판매자 draft/report |
| [architecture-auth.md](architecture-auth.md) | httpOnly 쿠키 전환 후의 구조 · 부팅 복원 · 401 2종 규약 · `selectIsAuthReady` · 가드 |
| [architecture-data.md](architecture-data.md) | 쿼리 키 목록 · staleTime 근거 · **SSR `initialData` 함정** · 무효화 · SSR 경계 |
| [architecture-state.md](architecture-state.md) | 상태 관리 전반 — 4축 분리(RQ·Zustand·수동 저장·폼) · 스토어 2개 실태 · **저장소 선택 기준** |

## 2. 명세 — 무엇을 만들기로 했나

| 문서 | 다루는 것 |
|---|---|
| [features.md](features.md) | 페이지별 목적·핵심 기능 (10개 화면) |
| [FE-CONTRACT-SELLER-CHAT.md](FE-CONTRACT-SELLER-CHAT.md) | S-4 판매자 챗 계약 원문 |

## 3. 사건 기록 — 무엇이 잘못됐고 어떻게 판단했나

포트폴리오용으로도 쓰는 글. 표면 버그가 아니라 **구조적 문제**로 쓴다.

| 문서 | 한 줄 |
|---|---|
| [analytics-401-retry.md](analytics-401-retry.md) | "재시도 안 한다"는 코드에 401 하나만 예외를 뚫은 이유 |
| [cart-event-migration-incident.md](cart-event-migration-incident.md) | BE 적재 전에 FE 제거가 먼저 머지된 사고와 복구 |
| [image-loading-review.md](image-loading-review.md) | 상품 이미지 로딩 점검과 조치 |
| [hero-animation-perf-review.md](hero-animation-perf-review.md) | 가설이 측정으로 반증된 기록 (**코드 수정 없음**) |

## 3-1. 발표·포트폴리오

| 문서 | 한 줄 |
|---|---|
| [tech-talk-candidates.md](tech-talk-candidates.md) | 기술 발표 후보 5선과 상위 3개 상세 (코드·커밋 근거만) |
| [presentation-frontend-draft.md](presentation-frontend-draft.md) | 프론트 발표 초안 전체 (슬라이드 15장 · 평가지표 6항목 대응) |
| [presentation-chat-session-design.md](presentation-chat-session-design.md) | 채팅 세션 설계 통합본 — 게스트/회원 승계 · 멀티탭 (초안 2·2-1⑤ 재구성) |
| [presentation-talking-points.md](presentation-talking-points.md) | **발표 소재 등급표 · 프레이밍 · 말하면 안 되는 것** — 프론트 기여도 기준 |
| [presentation-script-chat.md](presentation-script-chat.md) | **발화 대본** — 채팅 3블록(스트림·탭·대화). 입으로 말할 문장 + 대사별 코드 근거 |
| [presentation-script-state.md](presentation-script-state.md) | **발화 대본** — 상태 3블록(소유권·즉시성·합류). AI 행동이 사용자 조작과 같은 갱신 경로로 합류 |

## 4. 이전·배포

| 문서 | 다루는 것 |
|---|---|
| [nextjs-migration.md](nextjs-migration.md) | Vite → Next.js 전환 계획 |
| [nextjs-migration-qa.md](nextjs-migration-qa.md) | 전환 후 브라우저 검증 시나리오 |
| [deploy-handoff-nextjs.md](deploy-handoff-nextjs.md) | 배포 인수인계 (nginx + node 2프로세스) |

## 5. 계획 — `plans/`

| 문서 | 다루는 것 |
|---|---|
| [plans/preference-profile-explained.md](plans/preference-profile-explained.md) | 취향 프로필이 뭐고 뭘 할 수 있나 |
| [plans/personalization-contract-2026-08-09.md](plans/personalization-contract-2026-08-09.md) | 개인화 확정 계약 |
| [plans/personalization-mypage.md](plans/personalization-mypage.md) | 개인화 마이페이지 구현 계획 |
| [plans/personalization-graph-plan.md](plans/personalization-graph-plan.md) | 계약 정합 + 방사형 그래프 |

---

## 문서 드리프트 이력

한때 CLAUDE.md 가 구현보다 뒤처져 있던 지점들. **2026-08-11 에 전부 갱신 완료.**
어떻게 벌어졌는지가 참고가 되므로 남긴다 — 계약·구조가 바뀌는 커밋은 CLAUDE.md 를 같이 고칠 것.

| 항목 | 옛 서술 | 실제 | 계기 |
|---|---|---|---|
| AT 보관 | 메모리 전용 | **httpOnly 쿠키** | `05e6b46` 전환 |
| role enum | `MEMBER` | **`USER`** | 초기 오기 |
| SSE 이벤트 | 8종 + meta·draft | **11종** | 판매자 `report` 신설 |
| progress | `analyzing` 1종, 0~1회 | **7종 + 개방형**, 다회 | 2026-08-06 다단계화 |
| 조건 칩 | `field` 로 식별 | **`(field, value)` 쌍** | v0.32.14 값당 분리 |
| brand 색 | 청록 | **블루 `#2a63b8`** | 2026-08-10 변경 |

## 문서를 쓸 때

- **개조식(~함/~음)** 으로 쓴다. PR 본문도 같다.
- 리뷰어 설득이 아니라 **미래의 나를 위한 기록** — "왜 이렇게 했는지"가 중심이다.
- 사건 기록은 표면 버그가 아니라 **구조적 문제**로 쓴다. 정리할 건은 먼저 제안한다.
- 되돌려질 위험이 있는 판단은 **"이걸 넓히지 말 것"** 을 명시한다
  (예: 401 재전송을 5xx 로 확대 금지).
