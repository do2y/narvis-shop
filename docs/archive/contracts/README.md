# 보관 — 판매자 챗 계약 감사 문서 (2026-07-22)

2026-10-31 공개 문서 정리 때 `docs/features/`에서 옮겨 옴. **내용은 고치지 않았음.**

## 보관한 이유

- AI 서버 쪽 코드(`app/api/seller.py` 등)를 기준으로 노션 명세와의 어긋남을 감사한 문서라, FE 레포의 설명 문서와 성격이 다름
- 작성 시점(v0.4.0) 상태가 그대로임 — "D/E 잔여", "프론트 연결 미시작" 등은 지금과 다름
- 현재 정본은 계약 타입 `src/shared/types/chat/seller.ts`, FE 쪽 동작 요약은 [architecture/chat.md](../../architecture/chat.md) §10

## 그래도 남긴 이유

| 문서 | 유효한 부분 |
|---|---|
| [seller-chat-contract.md](seller-chat-contract.md) | 레인(`meta`)·패널(`done{panel}`) 신호가 생긴 배경 · HITL 2-스트림 흐름 · confirm 결과 5종이 전부 HTTP 200 + 안내 문구로 오는 이유 · 성공·실패 케이스 전수 |
