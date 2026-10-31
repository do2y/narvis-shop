# 장바구니 이벤트 BE 이관 — 배포 순서를 앞지른 머지와 복구

> `add_to_cart` 수집을 FE→BE로 넘기는 작업에서, **BE 적재가 붙기 전에 FE 제거가 먼저
> main에 머지된** 사고와 그 복구 기록. 2026-08-07.
>
> 실제 피해는 0이었다. 배포를 중단했고 서비스 요청도 없었다.
> 다만 "왜 이 순서를 지켜야 했는지"와 "왜 이렇게 복구했는지"는 남겨둘 값어치가 있다.

## 배경 — 왜 이관하나

챗봇이 대화 중 담아주는 경로(SSE `CART_ADDED`)는 페이로드가 `{cartItemId, message}`뿐이다.
그래서 FE가 명세 필수 키인 `quantity`·`price`를 **계약상 채울 수 없었고**, 서버에
`_incomplete`로 쌓이고 있었다. 어느 추천 목록에서 왔는지도 알 수 없어 `recommendation`도
못 실었다.

데이터가 변경되는 지점(BE `CartService`)에서 남기면 담기 3개 경로(상품 상세 · 챗 카드 ·
챗봇 자동 담기)가 전부 커버된다 — A 문서(2026-08-06) 결정.

## FE가 해야 했던 것 3가지

| # | 작업 | 배포 타이밍 |
|---|---|---|
| 1 | `X-Session-Key` 헤더 전송(담기·수량변경·삭제) | BE보다 먼저 나가도 무해 |
| 2 | `track("add_to_cart")` 제거 3곳 + 타입에서 제거 | **BE 적재 시작과 같은 날** |
| 3 | `avgDeliveryDays` null 가드 | 언제든 안전 |

**2번만 순서 제약이 있다.** 이유는 아래.

### 왜 2번은 BE와 같은 날이어야 하나

- **FE가 먼저 떼면** → 이벤트가 통째로 빈다
- **양쪽이 동시에 쏘면** → 중복 적재된다.
  출처가 달라 각자 만든 UUID를 서버 UNIQUE 제약으로 막지 못한다

### `X-Session-Key`가 선행인 이유

BE `CartService`가 적재할 때 **방문 세션을 알 방법이 이 헤더뿐이다.**
`member_id`·`guest_id`는 JWT·쿠키에서 뽑지만, `sessionKey`는 FE가 localStorage로
관리하는 값이라 서버가 스스로 알 수 없다.

구현 시 주의한 것:

- 값을 **요청 시점에** 읽는다. 모듈 로드 때 캐시하면 30분 무활동으로 재발급된 키를
  따라가지 못해 옛 키를 계속 보낸다
- 조회(`GET /api/cart`)에는 붙이지 않는다 — 적재 대상은 변경 3종뿐
- localStorage 차단 환경(사파리 프라이빗)은 헤더 없이 보낸다.
  명세상 담기는 정상 처리되고 이벤트만 스킵된다

## 무슨 일이 있었나

순서 제약이 있는 2번을 별도 브랜치로 떼어 뒀는데, **그 브랜치가 먼저 머지됐다.**

```
PR #95  feat/cart-event-be-migration 머지  →  main 에 track 제거 반영
        (배포 워크플로가 push: [main] 트리거로 자동 실행)
```

배포를 수동으로 중단해 **프로덕션에는 나가지 않았다.** 서비스 요청도 없어 유실 데이터도 없었다.

> 브랜치를 나눈 것 자체는 맞는 판단이었다. 다만 **브랜치를 나누는 것만으로는 순서가
> 강제되지 않는다** — 머지 버튼은 여전히 누를 수 있다.

## 복구 — 왜 이 방법이었나

### 선택지

| 방법 | 판단 |
|---|---|
| **`1b8de17`만 revert** | ✅ 채택 |
| 머지 커밋(`7806f40`) 통째로 revert | ❌ 안전한 변경(1·3번, 카테고리, attributes)까지 날아감 |
| main force push | ❌ 공유 브랜치 이력 재작성 — 이미 pull 한 사람이 깨짐 |

`chore/minor-improvements`(1·3번 포함) 위에서 2번 브랜치를 분기했던 탓에, PR #95 머지로
**커밋 4개가 한꺼번에** main에 올라갔다. 그중 되돌려야 할 건 `1b8de17` 하나뿐이었다.

### 되돌린 범위

`1b8de17`이 건드린 4개 파일만:

- `features/product/index.tsx` — 담기 `onSuccess`의 track
- `features/chat/components/ChatProductCard.tsx` — 담기 `onSuccess`의 track
- `shared/chat/useChat.ts` — SSE `CART_ADDED` 분기
- `shared/analytics/types.ts` — 타입 union의 `add_to_cart`

유지한 것: `X-Session-Key` 헤더 · `avgDeliveryDays` 가드 · 카테고리 그리드 · attributes 필터 제거.
전부 BE와 무관하게 안전하다. 헤더는 BE가 아직 안 읽으면 무시될 뿐이다.

```
PR #96  revert/cart-event-track-removal 머지  →  main 복구 완료 (f4a6d8d)
        배포 #55 성공 — 현재 서버는 track 이 살아 있는 올바른 상태
```

## 왜 플래그로 끄지 않았나

"`if (FLAG) track(...)`으로 감싸 두면 되지 않나"를 검토했으나 택하지 않았다.

- 타입 union에서 `add_to_cart`를 뺀 것을 되돌려야 한다
- 죽은 코드가 남는다
- 배포일에 할 일이 "플래그 켜기"가 아니라 **결국 코드를 다시 고치는 것**이 된다

커밋을 나누는 쪽이 되돌리기도 쉽고 의도도 분명했다.

## 타입에서도 뺀 이유

호출부만 지우면, 나중에 누가 `track("add_to_cart")`를 다시 쓸 때 **조용히 중복 수집이
시작된다.** union에서 빼 두면 그 순간 빌드가 막아준다.

## 남은 절차

BE 적재 시작일에 **revert를 다시 revert**한다.

```bash
git checkout main && git pull
git checkout -b feat/cart-event-be-migration-v2
git revert 25f293e
```

`feat/cart-event-be-migration` 브랜치는 재사용할 수 없다 — 이미 머지됐다가 revert돼서
다시 PR을 올려도 GitHub이 "비교할 것이 없다"고 판정한다.

## 배운 것

**브랜치 분리는 순서를 표시할 뿐 강제하지 않는다.** 순서 제약이 있는 변경은 커밋
메시지 첫 줄에 그 사실을 박아 두는 편이 낫다 — 실제로 `1b8de17`에는
`⚠️ BE 적재 시작과 같은 날 배포할 것. 단독 머지 금지.`를 적어 뒀고, 사고 후 상황을
파악할 때 이 한 줄이 근거가 됐다.

더 확실한 방법은 GitHub 브랜치 보호 규칙이나 draft PR로 머지 자체를 막는 것이다.
1인 프론트 체제라 지금은 커밋 메시지 경고로 두지만, 협업이 늘면 재검토할 것.

**되돌릴 때는 최소 범위로.** 머지 커밋을 통째로 revert하는 게 간단해 보이지만,
한 PR에 성격이 다른 커밋이 섞여 있으면 안전한 것까지 날아간다.
어느 커밋이 문제인지 먼저 특정하는 편이 결과적으로 빠르다.

## 관련

- 이벤트 수집 계약: `src/shared/analytics/` (`types.ts` · `track.ts` · `sessionKey.ts`)
- 정본은 노션 📡 API 명세서. 코드와 어긋나면 **명세서가 맞다**
