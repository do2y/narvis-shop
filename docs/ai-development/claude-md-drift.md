# CLAUDE.md 드리프트 이력

> 2026-10-31 문서 재배치 때 `docs/README.md`의 같은 이름 섹션을 그대로 옮겨 왔음. 내용은 고치지 않았음.
> CLAUDE.md는 AI 코딩 도구가 매 세션 읽는 규칙 요약이라, 구현보다 뒤처지면 AI가 낡은 전제로 코드를 짬.
> 그래서 AI 활용 개발 기록의 출발점으로 이 폴더에 둠.

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

## 관련

- [architecture/auth.md](../architecture/auth.md) §8 — 쿠키 전환 직후 CLAUDE.md와 어긋났던 지점의 원래 기록
- [architecture/chat.md](../architecture/chat.md) §5·§7 — SSE 11종 · 조건 칩 `(field, value)` 쌍의 현재 구조
