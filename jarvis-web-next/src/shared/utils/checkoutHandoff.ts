import type { CheckoutState } from "@/shared/types/checkout";

/**
 * 페이지 간 state 전달 — react-router의 `navigate(path, { state })` 대체.
 *
 * Next의 `router.push`에는 state가 없어 sessionStorage를 경유하되,
 * **"직접 진입에서는 값이 없어야 한다"는 원본의 성질을 함께 복원한다.**
 *
 * 왜 sessionStorage만으로는 안 되는가:
 * 원본 `location.state`는 히스토리 엔트리에 묶여 있어 주소창으로 `/checkout`에 직접
 * 들어오면 값이 없다. 그런데 sessionStorage는 탭 전체에 남으므로 직접 진입에서도
 * 이전 주문이 읽혀 **결제 폼이 옛 상품으로 채워졌다**(실제 발생한 버그).
 *
 * 해결: 값에 "아직 도착하지 않음(pending)" 플래그를 달아 보낸다.
 *  - 수신 화면이 처음 읽을 때 pending을 해제하고 그 엔트리를 소유자로 표시한다
 *  - 이후 새로고침·뒤로가기로 같은 화면에 다시 오면 계속 읽힌다(원본과 동일)
 *  - 다른 경로에서 주소창으로 직접 들어오면 이미 소비된 값이라 무시된다
 *
 * 원본과의 동작 대조:
 *  - 정상 이동 → 값 있음 ✓
 *  - 새로고침 → 값 유지 ✓ (원본 history.state도 살아남음)
 *  - 주소창 직접 진입(다른 곳에서) → 값 없음 ✓
 */

const CHECKOUT_KEY = "checkout:state";
const ORDER_COMPLETE_KEY = "checkout:complete";

interface Envelope<T> {
  /** 아직 수신 화면이 읽지 않은 상태. 읽는 순간 false로 확정된다. */
  pending: boolean;
  /** 이 값을 소비한 화면의 경로. 그 화면에서만 계속 읽힌다. */
  owner?: string;
  value: T;
}

function load<T>(key: string): Envelope<T> | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Envelope<T>) : null;
  } catch {
    // 저장소 차단(프라이버시 모드)·JSON 파손 — 값 없음으로 취급한다.
    return null;
  }
}

function save<T>(key: string, env: Envelope<T>): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(env));
  } catch {
    // 용량 초과 등 — 수신측이 빈 상태 안내로 떨어진다.
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  save(key, { pending: true, value });
}

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  const env = load<T>(key);
  if (!env) return null;

  const here = window.location.pathname;

  if (env.pending) {
    // 이동 직후 첫 읽기 — 이 화면이 값의 주인이 된다.
    save(key, { ...env, pending: false, owner: here });
    return env.value;
  }

  // 이미 소비된 값: 그 화면(새로고침·뒤로가기 포함)에서만 계속 보인다.
  // 다른 경로에서 주소창으로 들어온 경우엔 여기서 걸러진다.
  return env.owner === here ? env.value : null;
}

export const setCheckoutState = (state: CheckoutState) =>
  write(CHECKOUT_KEY, state);

export const getCheckoutState = () => read<CheckoutState>(CHECKOUT_KEY);

/**
 * 결제가 성사되면 주문 항목을 비운다.
 *
 * 이게 없으면 결제를 마친 뒤 나중에 주소창으로 `/checkout`에 들어왔을 때 이미 주문한
 * 상품이 그대로 떠서 다시 결제할 수 있는 것처럼 보인다. 원본은 히스토리 엔트리가
 * 바뀌어 자연히 비었지만, sessionStorage는 탭에 남으므로 명시적으로 지워야 한다.
 */
export function clearCheckoutState(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(CHECKOUT_KEY);
  } catch {
    // 저장소 접근 불가 — 다음 결제 진입 시 어차피 덮어쓴다.
  }
}

// 주문 완료 화면(`/checkout/complete`)용 전달.
// 페이로드 타입(OrderCompleteState)이 checkout 페이지 폴더에 있어 여기서 참조하면
// shared → features 역방향 의존이 된다. 제네릭으로 두고 호출부가 타입을 지정한다.
export const setOrderCompleteState = <T>(state: T) =>
  write(ORDER_COMPLETE_KEY, state);

export const getOrderCompleteState = <T>() => read<T>(ORDER_COMPLETE_KEY);
