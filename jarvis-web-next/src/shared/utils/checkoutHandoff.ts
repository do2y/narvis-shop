import type { CheckoutState } from "@/shared/types/checkout";

/**
 * 페이지 간 state 전달 — react-router의 `navigate(path, { state })` 대체.
 *
 * Next의 `router.push`에는 state 개념이 없어 sessionStorage를 경유한다.
 * 원본과 동일하게 "새로고침하면 사라져도 되는" 성격의 데이터만 넣는다
 * (주문 데이터는 아직 서버 원본이 없음 — 원본 주석과 동일한 전제).
 *
 * [알고 수용한 차이] history.state는 히스토리 엔트리별이고 sessionStorage는 탭별이다.
 * 결제 A → 뒤로 → 다른 상품 바로구매 B → 뒤로가기로 A의 checkout 엔트리에 복귀하면
 * 원래는 A state가 보였지만 이제는 B state가 보인다. checkout 흐름 특성상
 * 실사용 영향이 낮다고 판단해 수용 — 관련 버그 리포트가 오면 이 차이부터 의심할 것.
 *
 * 읽은 뒤 지우지 않는다: 원본 history.state는 새로고침에도 살아남으므로
 * 지우면 동작이 달라진다. 다음 진입 시 set이 덮어쓴다.
 */

const CHECKOUT_KEY = "checkout:state";

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // 저장소 접근 차단(프라이버시 모드)·JSON 파손 — state 없음으로 취급해
    // 호출부의 기존 null 분기를 타게 한다.
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 용량 초과 등 — 전달 실패 시 수신측이 null 분기로 안내한다.
  }
}

export const setCheckoutState = (state: CheckoutState) =>
  write(CHECKOUT_KEY, state);

export const getCheckoutState = () => read<CheckoutState>(CHECKOUT_KEY);

// 주문 완료 화면(`/checkout/complete`)용 전달.
// 페이로드 타입(OrderCompleteState)이 checkout 페이지 폴더에 있어 여기서 참조하면
// shared → features 역방향 의존이 된다. 제네릭으로 두고 호출부가 타입을 지정한다.
const ORDER_COMPLETE_KEY = "checkout:complete";

export const setOrderCompleteState = <T>(state: T) =>
  write(ORDER_COMPLETE_KEY, state);

export const getOrderCompleteState = <T>() => read<T>(ORDER_COMPLETE_KEY);
