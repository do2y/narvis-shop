# 보관 — 개인화 마이페이지 계획서 (2026-08-07 ~ 08-10)

2026-10-31 문서 재배치 때 `docs/plans/`에서 옮겨 옴. **내용은 고치지 않았음.**

## 보관한 이유

- 셋 다 2026-08-07 **초안 계약** 기준이라 응답 필드가 확정본과 다름 (각 문서 첫머리에 스스로 밝혀 둠)
- 구현이 끝났음 — 세로형 트리 → 방사형 그래프까지 반영됨
- 계약 정본: [features/personalization-contract.md](../../features/personalization-contract.md)
- 그래프 구현 방식: [features/ui-implementation-notes.md](../../features/ui-implementation-notes.md) §1

## 그래도 남긴 이유 — 지금도 유효한 판단

| 문서 | 유효한 부분 |
|---|---|
| [mypage-plan.md](mypage-plan.md) | §0 결정표(마크다운 자체 렌더, 관계 색 미사용, 라우트·네비) · 파일 구조 · 상태 설계(`graphVersion`·`edgeId`·409 분기) · 목 전략 |
| [preference-profile-explained.md](preference-profile-explained.md) | 개념 설명 — 나 → 관계 → 대상, 관계 5종의 의미, 다단계 그래프가 아닌 이유 |
| [graph-plan.md](graph-plan.md) | 초안 → 확정 계약 정합 순서(데이터 층 먼저) · 그래프 라이브러리 미사용 판단 · 결정 기록 |

> ⚠️ 이 문서들의 코드 링크·줄 번호는 작성 당시 기준이라 현재 코드와 다를 수 있음.
