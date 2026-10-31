# 홈 스크롤 인터랙션 성능 검토

> 점검일: 2026-08-11
>
> 범위:
> - 홈의 `soft snap` 스크롤 연결
> - 카테고리 / 추천 상품 / 인기 상품의 reveal 애니메이션
> - 이 변경과 함께 체감 성능에 영향을 줄 수 있는 주변 코드
>
> 기준:
> - **정적 코드 리뷰 기반**
> - 브라우저 Performance 프로파일러 / 실기기 측정은 아직 하지 않음

## 결론

- **치명적인 병목은 보이지 않는다.**
- 이번에 추가한 `scroll-snap` / `useRevealOnce` 구조 자체는 비교적 가볍다.
- 오히려 홈 화면에서 더 먼저 눈에 띄는 비용 후보는 아래 3가지다.

| 우선순위 | 후보 | 위치 | 판단 |
|---|---|---|---|
| 1 | 추천이 아닌 상품 카드에도 노출 observer 생성 | `src/features/home/components/ProductCard.tsx:34-46` | **불필요한 비용이 실제로 존재** |
| 2 | 모든 상품 이미지에 상시 `will-change-transform` 적용 | `src/features/home/components/ProductCard.tsx:72-76` | 카드 수가 늘면 레이어 메모리 비용 가능 |
| 3 | 히어로 placeholder 타이핑으로 `Hero` 전체가 주기적으로 리렌더 | `src/features/home/hooks/useTypingText.ts:28-79`, `src/features/home/components/Hero.tsx:24-130` | 현재는 버틸 가능성이 높지만 지속적인 scripting 발생 |

별도 참고:
- 히어로 무한 애니메이션 자체는 이미 [`docs/hero-animation-perf-review.md`](./hero-animation-perf-review.md)에서 따로 점검됨

## 이번 변경에서 성능상 안전한 부분

### 1. 스크롤 스냅은 CSS만 사용한다

홈 스크롤 연결은 `wheel` / `touchmove`를 가로채지 않고, 루트에 `scroll-snap-type: y proximity`만 적용한다.

- 위치: `src/app/globals.css:265-279`
- 특징:
  - JS `scrollIntoView()` 반복 호출 없음
  - `preventDefault()` 기반 스크롤 하이재킹 없음
  - `mandatory`가 아니라 `proximity`
  - `prefers-reduced-motion`에서 비활성화

즉, 스크롤 중 메인 스레드가 별도 계산을 반복하는 구조가 아니다.

### 2. reveal observer는 섹션 단위 1회성이다

이번에 추가한 `useRevealOnce`는 섹션이 한 번 보이면 observer를 끊는다.

- 위치: `src/features/home/hooks/useRevealOnce.ts:12-49`
- 적용 대상:
  - 카테고리 섹션
  - 추천 상품 섹션
  - 인기 상품 섹션

이 구조는 스크롤 이벤트 핸들러보다 훨씬 안전하고, 현재 규모에서는 observer 수 자체도 매우 적다.

### 3. reveal 애니메이션 속성도 비교적 안전하다

카드 / 섹션 진입 애니메이션은 `opacity + transform` 위주다.

- 위치:
  - `src/features/home/components/CategoryGrid.tsx:22-57`
  - `src/features/home/components/RecommendedProducts.tsx:54-71`
  - `src/features/home/components/PopularProducts.tsx:16-44`

이 조합은 레이아웃 재계산보다 합성 단계에서 처리될 가능성이 높아, 과한 `top/left`, `height`, `filter` 애니메이션보다 훨씬 안전하다.

## 병목 후보 상세

### 1. 추천이 아닌 상품 카드에도 노출 observer가 붙는다

가장 먼저 볼 만한 후보다.

#### 왜 문제인가

`ProductCard`는 추천 상품 여부와 관계없이 항상 `useVisibleOnce()`를 호출한다.

```tsx
const cardRef = useVisibleOnce<HTMLButtonElement>(
  () => {
    if (!recommendation) return;
    track(...);
  },
  recommendation ? `${recommendation.listId}:${product.productId}` : undefined,
);
```

- 위치: `src/features/home/components/ProductCard.tsx:34-46`
- observer 구현: `src/shared/analytics/useVisibleOnce.ts:24-77`

여기서 `recommendation`이 없는 **인기 상품 카드도**:

- `IntersectionObserver`를 생성하고
- 노출 1초 타이머를 만들고
- 결국 콜백 안에서 `return`만 한 뒤 observer를 끊는다

즉, **수집할 이벤트가 없는 카드에도 관찰 비용이 들어간다.**

#### 현재 영향

- 홈에서는 카드 수가 아직 많지 않아 **당장 큰 문제는 아닐 가능성이 높다**
- 하지만 같은 카드 컴포넌트가 더 긴 목록에 재사용되면 observer 수와 timer 수가 같이 늘어난다

#### 후속 권장

가장 먼저 손볼 가치가 있다.

- `recommendation`이 있을 때만 `useVisibleOnce`를 연결
- 또는 추천 카드 / 일반 카드를 분리해 일반 카드에서는 observer 자체를 만들지 않기

### 2. 모든 상품 이미지에 상시 `will-change-transform`이 붙어 있다

#### 왜 문제인가

상품 카드 이미지에 아래 클래스가 기본으로 들어가 있다.

```tsx
className="size-full object-contain transition-transform duration-200 ease-out will-change-transform ..."
```

- 위치: `src/features/home/components/ProductCard.tsx:72-76`

`will-change`는 “곧 자주 바뀔 속성”을 미리 브라우저에 알려 레이어 승격을 유도할 수 있지만,
**요소가 많을 때는 GPU 메모리와 합성 비용을 늘릴 수 있다.**

#### 현재 영향

- 홈 첫 화면 카드 수는 적어서 급한 문제는 아닐 수 있다
- 하지만 이 카드가 추천 / 인기 / 채팅 추천 / 더 긴 목록에서 재사용되면 누적 비용 후보가 된다

#### 후속 권장

- 기본 상태의 `will-change-transform` 제거 검토
- 정말 필요하면 hover 가능한 환경에서만 한정
- 또는 실제 상호작용 직전 / 직후에만 적용

### 3. 히어로 placeholder 타이핑이 `Hero` 전체를 자주 리렌더한다

#### 왜 문제인가

`useTypingText`는 35~80ms 간격으로 state를 갱신한다.

- 위치: `src/features/home/hooks/useTypingText.ts:28-79`

이 값은 `Hero` 컴포넌트에서 바로 사용되기 때문에,

- 위치: `src/features/home/components/Hero.tsx:24-130`

placeholder 한 글자가 바뀔 때마다:

- 히어로 제목
- 검색창
- 질문 칩
- 히어로 레이아웃 subtree

가 함께 리렌더된다.

#### 현재 영향

- DOM 규모가 아주 크지는 않아 **즉시 문제일 가능성은 낮다**
- 다만 홈 첫 화면에서 사용자가 머무는 동안 계속 scripting이 발생한다
- 여기에 기존 히어로 배경 애니메이션이 함께 돌아가므로, 저사양 환경에서는 합산 비용 후보가 된다

#### 후속 권장

- 타이핑 placeholder를 별도 작은 컴포넌트로 분리
- 또는 input placeholder를 직접 갱신하는 더 좁은 구조로 축소
- 히어로가 viewport 밖으로 나가면 타이핑 일시정지 검토

## 낮은 우선순위 후보

### 4. reveal용 wrapper DOM이 카드마다 한 겹씩 늘었다

추천 / 인기 상품은 각 카드마다 reveal wrapper를 한 겹 추가했다.

- 위치:
  - `src/features/home/components/RecommendedProducts.tsx:63-78`
  - `src/features/home/components/PopularProducts.tsx:37-48`

현재 카드 수에서는 문제가 되기 어렵다. 다만 앞으로 첫 화면 카드 수가 크게 늘어나면:

- DOM depth 증가
- inline `transitionDelay` 증가
- 초기 스타일 계산량 증가

가 누적될 수 있다.

현재 단계에서는 **문제라기보다 “리스트가 커지면 다시 볼 포인트”**에 가깝다.

## 지금 바로 우려하지 않아도 되는 것

### scroll-snap 전역 적용

홈에서만 `data-home-scroll="true"`를 달고, 데스크톱 이상에서만 `scroll-snap-type: y proximity`를 켠다.

- 위치:
  - `src/features/home/index.tsx:12-19`
  - `src/app/globals.css:265-279`

이는 전역 scroll listener보다 훨씬 가볍고, reduced motion 대응도 있다. 구조상 병목 후보로 보긴 어렵다.

### reveal observer 수 자체

`useRevealOnce`는 현재 섹션 3개 정도에만 붙고, 한 번 보이면 끊긴다.
이건 현재 코드에서 사실상 무시 가능한 수준이다.

## 추천 우선순위

### 1순위

**추천이 아닌 카드에서 `useVisibleOnce`를 만들지 않게 정리**

이건 “최적화 아이디어”가 아니라 **실제로 불필요한 일을 하고 있는 코드**에 가깝다.

### 2순위

**`ProductImage`의 기본 `will-change-transform` 제거 여부 확인**

긴 목록 페이지까지 고려하면 레이어 메모리 측면에서 이득일 가능성이 있다.

### 3순위

**히어로 타이핑 placeholder의 리렌더 범위 축소**

체감 병목이 보고될 때 제일 먼저 확인할 후보 중 하나다.

## 다음 측정 제안

정적 리뷰만으로는 “후보”까지만 말할 수 있다. 실제 우선순위를 확정하려면 아래를 보는 게 좋다.

1. Chrome Performance 탭에서 홈 진입 후 5~8초 idle 녹화
2. 히어로에서 카테고리 / 상품 영역까지 실제 스크롤 녹화
3. 다음 항목 확인
   - Main thread의 scripting 비중
   - Layer 수 증가 여부
   - Product card 이미지 레이어 메모리
   - observer callback / timer wakeup 빈도
4. CPU 4x slowdown 기준으로 한 번 더 비교

## 한 줄 요약

이번 `soft snap + reveal` 추가 자체는 저위험이다.  
성능상 더 먼저 의심할 부분은 **상품 카드의 불필요한 observer**, **상시 `will-change`**, **히어로 타이핑 리렌더**다.
