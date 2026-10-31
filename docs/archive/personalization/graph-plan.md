# 개인화 마이페이지 — 계약 정합 + 방사형 그래프 작업 계획서

> 대상: `/mypage/preferences` (구현 커밋 `eef443c` 존재)
> 계약 정본: [personalization-contract-2026-08-09.md](personalization-contract-2026-08-09.md)
> 작성 2026-08-10

---

## 0. 지금 상태 — 신규 구현이 아니다

`src/features/mypage/preferences/` 에 **2,727줄이 이미 있고 동작한다.** 이번 작업은
새로 만드는 게 아니라 **두 가지를 고치는 것**이다.

| # | 무엇 | 왜 |
| --- | --- | --- |
| **A** | 8/07 초안 → **8/09 확정 계약**으로 정합 | 응답에 없는 필드를 9개나 읽고 있다. 실 API를 붙이는 순간 전부 `undefined` |
| **B** | 카드 목록 → **방사형 그래프** | 현재 화면은 노션이 "목록이 아니라 그래프"라고 못 박은 요구를 만족하지 않는다 |

> ⚠️ **A를 먼저 한다.** B는 화면 층이고 A는 데이터 층이라, 순서를 바꾸면
> 사라질 필드 위에 그래프를 얹었다가 다시 뜯게 된다.

### 살릴 것 / 고칠 것

| 파일 | 판정 |
| --- | --- |
| `useDeleteEdge` · `useEditEdge` · `useResetGraph` · `usePersonalization` · `useProfileGraph` | ✅ **그대로** — 409 분기·재시도 중단 조건·`graphVersion` 갱신·`edgeId` 교체가 계약대로 이미 맞다 |
| `DeleteEdgeDialog` · `ResetGraphDialog` · `PersonalizationControls` | ✅ **그대로** |
| `SummaryMarkdown` · `parseSummary` (+테스트) | ✅ **그대로** |
| `api.ts` | 🔧 `USE_MOCK` 유지, 타입만 따라감 |
| `types.ts` | 🔴 **대폭 축소** — 아래 §1 |
| `mock.ts` | 🔴 확정 응답 모양으로 재작성 |
| `EditEdgeDialog` | 🔧 `nodes[]` → `edges[].object` 기반 자동완성으로 |
| `PreferenceTree` · `PreferenceGroup` · `PreferenceItem` | 🔧 목록 뷰로 **유지**(버리지 않는다 — §3에서 재활용) |
| `ScreenReaderList` | ✅ 주석 해제해 켠다 (방사형은 `aria-hidden`) |

---

## A. 계약 정합

### 1. `types.ts` — 없어지는 것들

확정 응답에 **없는** 필드를 지운다. 남기면 "있는 줄 알고 쓰는" 코드가 계속 생긴다.

```ts
// 삭제
PreferenceNode / indexNodes()        // nodes[] 배열 자체가 없음 → object 인라인
edge.to                              // → edge.object
edge.source, origin, confidence      // 응답에 없음
edge.firstSeenAt                     // 응답에 없음
edge.verified, derivedFromSensitive  // 응답에 없음
graph.nodes, usagePolicy             // 응답에 없음
graph.unprojectedCount, truncated    // 응답에 없음 (서버 상한 폐지)
personalization.disabledAt           // 응답에 없음
purged.nodes, purged.facts           // edges·transcriptTurns 둘뿐
CONFIDENCE_LABEL / SOURCE_LABEL      // 쓸 데가 없어짐
PreferenceConfidence / Source / Origin
```

확정 후 `PreferenceEdge`는 이만큼이다.

```ts
export interface PreferenceEdge {
  edgeId: string;                    // ★ 수정하면 바뀐다
  predicate: PreferencePredicate;
  object: { nodeId: string; type: PreferenceNodeType; label: string };
  editable: boolean;                 // false = 구매 파생 (✏️만 비활성, 🗑은 활성)
  challenged: boolean;
  lastConfirmedAt?: string;          // 📮 요청 중 — optional로 두고 없으면 미표시
}
```

- `lastConfirmedAt`을 **`?` 로 둔다.** 요청은 넣었지만 안 와도 화면이 완결되어야 한다.
- `indexNodes()` 제거로 `PreferenceTree`·`PreferencesPage`의 룩업이 사라진다 —
  라벨이 `edge.object.label`로 바로 온다.

### 2. 서버 상한 폐지 → 화면 상한은 FE 소유

`truncated`·200개 상한이 없어졌다. `edges`가 **전량** 온다.
→ `GROUP_DISPLAY_LIMIT = 12`의 근거가 사라졌으므로 **방사형 기준으로 다시 정한다**(§3.2).

### 3. 검증

`mock.ts`를 확정 모양으로 바꾸면 타입 에러가 안내를 해준다. 마지막에 `npm run build`.

---

## B. 방사형 그래프

### 1. 왜 2단인가 — 옵시디언 형태는 이 데이터로 안 나온다

옵시디언이 뭉치·허브·경로를 보여주는 건 **노트끼리 서로 링크**돼 있기 때문이다.
우리 데이터는 전부 `나 → 대상` **한 방향·한 단계**라, force-directed를 그냥 돌리면
중심 하나에 점이 매달린 그림이 나온다(노션 10.1 — *"그래프처럼 보이지만 목록보다 정보가 적다"*).

**해법: 관계 5종을 중간 노드로 넣는다.** 데이터에 실제로 있는 유일한 중간 단계다.

```
                     ● 3~5만원대
                    ╱
         ● 선호 ───── ● 노이즈캔슬링
        ╱   24     ╲
       ╱             ● 무선   … +18
   ⦿ 나
       ╲           ╱ ● 광택
         ● 좋아함 ─
             8     ╲ ● 무광 블랙  … +6

      ○ 회피 0        ○ 구매 0
```

`나 → 관계 → 대상` 2단계라 정직하고, 관계별로 뭉치가 생겨 그래프로서 값어치가 있다.

### 2. 라이브러리를 쓰지 않는다

| 후보 | 판정 |
| --- | --- |
| react-force-graph | ❌ three.js를 끌고 와 250KB+. 과하다 |
| vis-network | ❌ 자체 캔버스라 Tailwind 토큰·다크모드 통제가 안 된다 |
| d3-force | 🟡 ~30KB로 가볍지만, **지금 구조에 물리 시뮬레이션이 필요 없다** |
| **직접 계산** | ✅ **채택** |

노드가 `1 + 5 + (관계당 6)` ≈ 최대 35개로 **고정 구조**다. 관계를 항목 수에 비례해
각도 배분하고 그 아래 항목을 부채꼴로 펼치면 끝이라 삼각함수로 충분하다.
CLAUDE.md의 "새 라이브러리는 승인 먼저" 절차도 건너뛴다.

> **좌표 계산을 `layout.ts` 순수 함수로 분리한다.** 나중에 물리 시뮬레이션이
> 필요해지면 이 파일만 d3-force로 갈아끼운다. 순수 함수라 vitest로도 검증된다.

### 3. 화면 상한과 "전체 보기"

**방사형은 가지별로 잘라야 모양이 유지된다.** 관계 하나에 24개가 달리면 라벨이 겹쳐
아무것도 안 읽힌다. 관계당 **6개**가 360°를 나눠 쓸 때의 한계다.

| 동작 | 결과 |
| --- | --- |
| 가지 끝 **`+N`** | **그 관계만 확대**(포커스 모드). 나머지는 축소·흐리게. 바깥 클릭·ESC 복귀 |
| 상단 **[전체 보기]** | **목록 뷰로 전환** — 기존 카드 화면 재사용 |

**전체 보기를 방사형으로 하지 않는 이유**: 40개만 넘어도 뭉개진다. "많을 때 전부 보고
정리하고 싶다"는 요구에는 목록이 정직하고, 이미 만들어져 있다.

이 결정이 **접근성을 공짜로 해결한다** — 방사형 SVG는 스크린리더에 안 읽혀서 sr-only
목록이 필요한데, 목록 뷰가 그 역할을 겸한다.

### 4. 반응형

| 폭 | 화면 |
| --- | --- |
| ≥ 768px | 방사형 (기본) · [전체 보기]로 목록 전환 |
| < 768px | **목록 뷰 고정** — 좁은 화면에서 방사형은 라벨이 겹쳐 못 쓴다 |

뷰 전환은 CSS가 아니라 상태로 판정한다(`useMediaQuery` 또는 컨테이너 폭) — SVG를
그려놓고 숨기면 계산만 낭비된다.

### 5. 배치 규칙 (노션 10.2)

- **각도는 항목 수에 비례.** 균등 72° 금지 — `avoids`·`purchased`가 항상 비어 있어
  균등 배치하면 두 방향이 텅 빈 채 남는다
- 데이터 있는 그룹은 **위·양옆**, 빈 그룹은 **아래쪽 작게·흐리게**
- 빈 그룹은 **지우지도 강조하지도 않는다** — "아직 없어요". 클릭 불가.
  *생산 경로가 없어서 비는 것이지 사용자 탓이 아니다*
- 그룹 **안의 항목 순서는 서버 순서 그대로** (재정렬 금지)
- 관계 5색: **CLAUDE.md 토큰만 사용.** 회색 단계 + 라벨로 구분하고,
  색이 꼭 필요하면 **토큰 추가를 먼저 제안**한다. **"회피"에 빨강·경고색 금지**
- `nodeId` 노출 금지 → `object.label`
- 노드 크기·가지 굵기 = 항목 수

### 6. 상호작용

| | |
| --- | --- |
| 항목 클릭/호버 | ✏️ 🗑 노출 (SVG 안에 `foreignObject`로 버튼) |
| 터치 타겟 | 44×44px · 아이콘 간격 16px 이상 · ✏️ 왼쪽 / 🗑 오른쪽 |
| 포커스 모드 | 진입·복귀 200ms |
| 개인화 OFF | 채도만 낮춤 — **숨기지 않고 편집도 그대로** |

> SVG 안에서 편집 아이콘을 다루기 어려우면 **항목 클릭 → 기존 다이얼로그**로 간다.
> 노션도 *"어려우면 모달로 가세요"*를 허용한다. 다이얼로그는 이미 있다.

---

## 파일 구조

```
src/features/mypage/preferences/
├─ types.ts                    🔴 축소
├─ mock.ts                     🔴 재작성
├─ api.ts                      🔧 타입만
├─ use*.ts (5개)               ✅ 그대로
└─ components/
   ├─ PreferenceGraph.tsx      🆕 방사형 SVG
   ├─ graphLayout.ts           🆕 좌표 계산 (순수 함수)
   ├─ graphLayout.test.ts      🆕 vitest
   ├─ ViewToggle.tsx           🆕 그래프 ⇄ 목록
   ├─ PreferenceTree.tsx       🔧 목록 뷰로 유지
   ├─ PreferenceGroup/Item     🔧 object 기반으로
   ├─ ScreenReaderList.tsx     ✅ 켠다
   └─ (다이얼로그 3종)          ✅ 그대로
```

---

## 작업 순서

| 단계 | 내용 | 검증 |
| --- | --- | --- |
| **1** | `types.ts` 축소 + `mock.ts` 재작성 | 타입 에러가 고칠 지점을 전부 짚어준다 |
| **2** | 타입 에러 따라 `PreferenceTree`·`Group`·`Item`·`EditEdgeDialog` 정합 | **목록 뷰가 확정 계약으로 동작** — 여기까지가 A |
| **3** | `graphLayout.ts` + 테스트 | 비례 배분·빈 그룹 자리·겹침 없음 |
| **4** | `PreferenceGraph.tsx` (SVG 렌더) | 5그룹·항목·`+N` |
| **5** | 포커스 모드 + `ViewToggle` + 모바일 분기 | ESC·바깥 클릭·768px |
| **6** | `ScreenReaderList` 켜기 + 접근성 점검 | 스크린리더로 항목·버튼이 읽히는가 |
| **7** | `npm run build` | **진짜 게이트** |

**2단계에서 한 번 끊긴다.** 거기까지만 해도 계약에 맞는 화면이 완성되므로,
시간이 부족하면 **3~6을 미뤄도 출시 가능하다.**

---

## 결정 기록

| 항목 | 결정 | 이유 |
| --- | --- | --- |
| 그래프 라이브러리 | **안 씀** | 고정 구조 35노드라 각도 계산으로 충분. `layout.ts`만 갈아끼우면 나중에 d3 전환 가능 |
| 옵시디언식 force-directed | **안 함** | 대상끼리 링크가 없어 뭉치·경로가 안 생긴다(노션 10.1). 대신 관계를 중간 노드로 |
| 전체 보기 | **목록 뷰 전환** | 방사형은 40개면 뭉개진다. sr-only 목록도 겸한다 |
| 관계당 표시 | **6개** | 360° 나눠 쓸 때 라벨이 안 겹치는 한계 |
| 모바일 | **목록 고정** | 좁은 화면 방사형은 라벨 겹침 |
| 관계 5색 | **안 씀 (회색+라벨)** | CLAUDE.md 토큰 규칙. 필요하면 토큰 추가를 제안 |
| 목록 뷰 | **버리지 않음** | 전체 보기·모바일·스크린리더 3역을 겸한다 |
| `lastConfirmedAt` | **optional** | 요청은 넣었지만 안 와도 완결되어야 한다 |
| 수정 기능 | **1단계 포함** | 이미 구현돼 있어 뺄 이유가 없다 |

## 미결

| 항목 | 대응 |
| --- | --- |
| 실 API 미배포 | `USE_MOCK = true` 유지. 붙으면 `api.ts` 한 줄 |
| `markdown` dev 반영 | `null` 가드 이미 있음. dev에서 직접 확인 |
| 브랜드 항목이 추천에 미반영 | FE가 할 일 없음. 묻지 않는다 |
| "수정·삭제를 둔다"는 기획 승인 | 프론트 1인 체제 — 본인 결정으로 확정, 기록만 남김 |
