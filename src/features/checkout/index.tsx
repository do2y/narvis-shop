"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Check } from "lucide-react";
import { track } from "@/shared/analytics/track";
import { ApiError } from "@/shared/api/client";
import { AppHeader } from "@/shared/ui/AppHeader";
import { buttonVariants } from "@/shared/ui/button";
import { cn } from "@/lib/utils";
import type { Address, AddressInput } from "@/shared/types/address";
import type {
  CreateOrderRequest,
  OrderCompleteState,
  PaymentFailureReason,
  PaymentMethod,
} from "./types";
import { PAYMENT_METHODS } from "./paymentMethods";
import { useCreateOrder, useRetryPayment } from "./useCreateOrder";
import {
  useAddresses,
  useAddressMutations,
} from "@/shared/hooks/useAddresses";
import { OrderItems } from "./components/OrderItems";
import { ShippingSection } from "./components/ShippingSection";
import { AddressFormModal } from "@/shared/address/AddressFormModal";
import { PaymentSection } from "./components/PaymentSection";
import { OrderSummary } from "./components/OrderSummary";
import {
  clearCheckoutState,
  getCheckoutState,
  setOrderCompleteState,
} from "@/shared/utils/checkoutHandoff";
import { useClientValue } from "@/shared/hooks/useClientOnce";

export default function CheckoutPage() {
  const router = useRouter();
  // 상세 "바로 구매"·장바구니에서 넘어온 주문 항목. 직접 진입 시 없음.
  // 원본은 location.state였지만 Next에는 없어 sessionStorage 경유(계획서 3장 스니펫).
  // useClientValue: sessionStorage는 서버에 없으므로 첫 렌더에서 읽으면 하이드레이션이
  // 깨진다. 서버·첫 패스에서는 null, 그 뒤 클라이언트 값으로 확정된다.
  const state = useClientValue(getCheckoutState);
  const items = useMemo(() => state?.items ?? [], [state]);

  const { data: addresses = [] } = useAddresses();
  const { add: createAddress, update: updateAddress } = useAddressMutations();

  // 선택된 배송지. null이면 기본 배송지(없으면 첫 항목)를 따른다 —
  // 목록 로딩 전에는 값을 정할 수 없어 사용자가 고르기 전까지 파생값을 쓴다.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const addressId =
    pickedId ??
    addresses.find((a) => a.isDefault)?.addressId ??
    addresses[0]?.addressId ??
    null;
  const [addrModalOpen, setAddrModalOpen] = useState(false);
  // 수정 대상. null이면 추가 모드.
  const [editingAddr, setEditingAddr] = useState<Address | null>(null);
  // 배송 요청사항 — 주문 1회성이라 배송지가 아니라 주문 body로 보낸다.
  const [deliveryRequest, setDeliveryRequest] = useState("");
  const [method, setMethod] = useState<PaymentMethod>(PAYMENT_METHODS[0].value);
  const [agreed, setAgreed] = useState(false);

  // 결제 실패(PAYMENT_FAILED)는 HTTP 200이라 mutation 에러가 아니다.
  // 요청 자체가 거부된 경우와 구분해 따로 안내한다.
  // 사유(failureReason)까지 담는다 — 재고 부족이면 재결제가 절대 성공하지 않아
  // 버튼을 그대로 두면 사용자가 무한히 다시 누르게 된다(2026-08-05 O-1·O-2).
  const [paymentFailed, setPaymentFailed] =
    useState<{ reason: PaymentFailureReason | null } | null>(null);
  // 배송지 미선택 안내 — 결제 요청 전에 프론트가 막는 경우라 서버 에러와 구분해 담는다.
  const [addressError, setAddressError] = useState<string | null>(null);
  // 결제만 실패한 주문(PAYMENT_FAILED)의 id. 주문 자체는 서버에 남아 있으므로
  // 다시 시도할 때는 새 주문을 만들지 않고 이 주문의 결제만 재시도한다.
  const [failedOrderId, setFailedOrderId] = useState<string | null>(null);
  const createOrder = useCreateOrder();
  const retryPayment = useRetryPayment();

  // 추가·수정 겸용 — editingAddr 유무로 분기. 성공했을 때만 닫는다(실패 시 입력값 보존).
  const handleSubmitAddress = async (addr: AddressInput) => {
    try {
      if (editingAddr) {
        await updateAddress.mutateAsync({
          addressId: editingAddr.addressId,
          input: addr,
        });
      } else {
        const { addressId: newId } = await createAddress.mutateAsync(addr);
        setPickedId(newId); // 방금 추가한 배송지를 선택
        setAddressError(null); // 추가했으니 안내를 걷는다
      }
      setAddrModalOpen(false);
      setEditingAddr(null);
    } catch {
      // 실패 사유는 errorMessage로 모달에 노출된다
    }
  };

  const openAddAddress = () => {
    setEditingAddr(null);
    setAddrModalOpen(true);
  };

  const openEditAddress = (addr: Address) => {
    setEditingAddr(addr);
    setAddrModalOpen(true);
  };

  const { itemsTotal, discount } = useMemo(() => {
    const total = items.reduce(
      (sum, it) => sum + it.product.originalPrice * it.quantity,
      0,
    );
    const paid = items.reduce(
      (sum, it) => sum + it.product.price * it.quantity,
      0,
    );
    return { itemsTotal: total, discount: total - paid };
  }, [items]);

  // 주문서 진입 이벤트. 아래 조기 반환보다 위에 둬야 훅 순서가 깨지지 않는다.
  // 빈 주문서(직접 진입)는 결제 시작이 아니므로 제외한다.
  useEffect(() => {
    if (items.length === 0) return;
    // productIds 는 판매자 퍼널 3단의 근거다(JSON_CONTAINS 로 판매자 귀속) —
    // 개수만 남기면 산식이 깨진다(E-1 명세).
    track("checkout_start", {
      properties: {
        amount: itemsTotal - discount,
        productIds: items.map((i) => i.product.productId),
      },
    });
    // 금액은 items에서 파생되므로 items 변경 시에만 재전송한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // 주문 항목 없이 진입 — 상세에서 다시 들어오도록 안내.
  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-lg font-semibold">주문할 상품이 없어요</p>
          <p className="text-sm text-muted-foreground">
            상품 상세 페이지에서 &lsquo;바로 구매&rsquo;를 눌러 주문을 시작해주세요.
          </p>
          <Link
            href="/home"
            className={cn(buttonVariants(), "mt-2 h-11 rounded-full px-6")}
          >
            홈으로
          </Link>
        </main>
      </div>
    );
  }

  // purchase_complete 는 FE 가 쏘지 않는다 — 주문 성사는 서버가 정본이고,
  // FE 는 결제 성공 응답을 받아야만 쏠 수 있어 응답 직전에 탭이 닫히거나
  // 네트워크가 끊기면 이미 서버에 생성된 주문이 집계에서 통째로 빠진다.
  // 적재는 BE 주문 처리에서 한다.

  // 결제 실패 안내 — 사유마다 사용자가 할 일이 다르다(2026-08-05 failureReason).
  // 재고 부족은 재결제가 무의미하므로 장바구니로, 거절은 결제 수단을 바꿔 재시도로 보낸다.
  // 사유가 없으면(구버전 응답) 종전의 뭉뚱그린 문구로 물러난다.
  const paymentFailedMessage = !paymentFailed
    ? null
    : paymentFailed.reason === "OUT_OF_STOCK"
      ? "재고가 부족해 결제되지 않았어요. 장바구니에서 수량을 조정해주세요."
      : paymentFailed.reason === "MOCK_DECLINED"
        ? "결제가 거절됐어요. 결제 수단을 확인한 뒤 다시 시도해주세요."
        : "결제에 실패했어요. 결제 수단을 확인한 뒤 다시 시도해주세요.";

  // 다시 눌러도 성공할 수 없는 실패 — 결제 버튼을 장바구니 이동으로 바꾼다.
  // 두 경로가 같은 "재고 없음"인데 응답이 갈린다:
  //   200 PAYMENT_FAILED + OUT_OF_STOCK — 선검증을 통과한 뒤 경합으로 밀린 건
  //   400 ORDER_PRODUCT_UNAVAILABLE     — 선검증에서 걸린 건(품절·판매중지)
  // 400 쪽이 빠져 있어 "장바구니에서 빼고 다시 시도하세요"라고 안내하면서도
  // 결제 버튼이 살아 있었다(08-05 재고 선검증이 400으로 갈라질 때 누락).
  const orderRejected =
    createOrder.error instanceof ApiError &&
    createOrder.error.code === "ORDER_PRODUCT_UNAVAILABLE";
  const unrecoverable = paymentFailed?.reason === "OUT_OF_STOCK" || orderRejected;

  const handleSubmit = async () => {
    if (createOrder.isPending || retryPayment.isPending) return;

    // 배송지가 없거나 고르지 않았으면 알려준다 — 조용히 return 하면 버튼이 눌리는데도
    // 아무 일이 없어 사용자가 이유를 알 수 없다(배송지 0건일 때 실제로 겪음).
    const address = addresses.find((a) => a.addressId === addressId);
    if (!address) {
      setAddressError("배송지를 선택해주세요.");
      return;
    }
    setAddressError(null);
    setPaymentFailed(null);

    // 이미 만들어진 주문의 결제만 실패한 경우 — 새 주문을 만들면 실패 주문이 쌓이므로
    // 결제 수단만 바꿔 이 주문을 다시 결제한다.
    if (failedOrderId !== null) {
      try {
        const retried = await retryPayment.mutateAsync({
          orderId: failedOrderId,
          paymentMethod: method,
        });
        if (retried.status === "PAYMENT_FAILED") {
          // 재고 부족이면 재결제는 몇 번을 해도 실패한다 — 사유를 담아 결제 버튼을
          // 막고 장바구니로 유도한다(failedOrderId는 그대로 둔다. 지우면 다음 제출이
          // 새 주문 경로로 가서 실패 주문이 하나 더 쌓인다).
          setPaymentFailed({ reason: retried.failureReason ?? null });
          return;
        }
        setOrderCompleteState<OrderCompleteState>({
          order: {
            orderId: retried.orderId,
            orderNo: retried.orderNo,
            items,
            address,
            method,
            itemsTotal,
            discount,
            finalTotal: itemsTotal - discount,
          },
        });
        // 주문이 성사됐으니 결제 항목을 비운다 — 남겨두면 나중에 /checkout에 직접
        // 들어왔을 때 이미 산 상품이 다시 떠서 재결제 가능한 것처럼 보인다.
        clearCheckoutState();
        // 결제 화면이 히스토리에 남으면 뒤로가기로 재결제되므로 replace (원본과 동일).
        router.replace("/checkout/complete");
      } catch {
        // 요청 거부(상태 전이 불가 등)는 retryPayment.errorMessage로 안내된다
      }
      return;
    }

    // 라인아이템 출처는 정확히 하나만 보낸다(둘 다 보내면 400).
    // 장바구니에서 넘어온 항목은 cartItemId를 갖고, 상세 "바로 구매"는 없다.
    const cartItemIds = items
      .map((it) => it.cartItemId)
      .filter((id): id is string => id != null);
    const fromCart = cartItemIds.length === items.length && items.length > 0;

    const body: CreateOrderRequest = {
      ...(fromCart
        ? { cartItemIds }
        : {
            items: items.map((it) => ({
              productId: it.product.productId,
              ...(it.optionId != null ? { optionId: it.optionId } : {}),
              quantity: it.quantity,
            })),
          }),
      // 배송지는 서버 목록에서만 고르므로 항상 addressId로 보낸다
      // (addressId와 address를 함께 보내면 400).
      addressId: address.addressId,
      // 빈 값은 보내지 않는다(선택 항목)
      ...(deliveryRequest.trim()
        ? { deliveryRequest: deliveryRequest.trim() }
        : {}),
      paymentMethod: method,
    };

    try {
      const result = await createOrder.mutateAsync(body);

      // 결제 실패도 200 — status로 구분한다. 자동 재시도하지 않고 안내만.
      // 선검증(O-1)이 붙은 뒤에도 재고 경합은 남아 OUT_OF_STOCK이 여기로 올 수 있다.
      if (result.status === "PAYMENT_FAILED") {
        setPaymentFailed({ reason: result.failureReason ?? null });
        setFailedOrderId(result.orderId);
        return;
      }

      const order: OrderCompleteState["order"] = {
        orderId: result.orderId,
        orderNo: result.orderNo,
        items,
        address,
        method,
        itemsTotal,
        discount,
        finalTotal: itemsTotal - discount,
      };

      // replace로 이동 — 뒤로가기로 결제 화면에 돌아와 중복 결제하는 것을 막는다.
      setOrderCompleteState<OrderCompleteState>({ order });
      clearCheckoutState();
      router.replace("/checkout/complete");
    } catch {
      // 요청 거부(검증·권한 등)는 createOrder.errorMessage로 안내된다.
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl p-4 pb-20 sm:p-6">
        <h1 className="text-2xl font-bold sm:text-3xl">결제</h1>

        <div className="mt-6 flex flex-col gap-6 lg:flex-row">
          {/* 좌: 주문 정보 입력 */}
          <div className="flex flex-1 flex-col gap-6">
            <OrderItems items={items} />
            <ShippingSection
              addresses={addresses}
              selectedId={addressId}
              onSelect={(id) => {
                setPickedId(id);
                setAddressError(null); // 고르면 안내를 걷는다
              }}
              onAddClick={openAddAddress}
              onEditClick={openEditAddress}
              deliveryRequest={deliveryRequest}
              onDeliveryRequestChange={setDeliveryRequest}
            />
            <PaymentSection
              method={method}
              onMethodChange={(m) => {
                setMethod(m);
                setPaymentFailed(null); // 수단 변경 시 이전 실패 안내 제거
                createOrder.reset();
                retryPayment.reset(); // 재결제 거부 사유도 화면에 노출되므로 함께 지운다
              }}
            />

            {/* 동의 */}
            <section className="rounded-sm border bg-background p-5 sm:p-6">
              {/* 개인정보 제3자 제공 동의 — 법적 성격의 컨트롤이라 체크 상태가
                  보조기술에도 그대로 전달돼야 한다. 모양은 커스텀이지만 역할은
                  체크박스이므로 role·aria-checked 를 명시한다(그냥 button 이면
                  스크린리더에 "동의함/안 함"이 아예 읽히지 않는다). */}
              <button
                type="button"
                role="checkbox"
                aria-checked={agreed}
                onClick={() => setAgreed((v) => !v)}
                // role=checkbox 는 Space 로도 토글돼야 한다(ARIA 규약).
                // button 기본 동작은 Enter 뿐이라 직접 처리한다.
                onKeyDown={(e) => {
                  if (e.key === " ") {
                    e.preventDefault(); // 스페이스의 기본 스크롤을 막는다
                    setAgreed((v) => !v);
                  }
                }}
                className="flex w-full items-start gap-3 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                    agreed ? "border-primary bg-primary" : "border-input",
                  )}
                >
                  {agreed && (
                    <Check className="size-3 text-primary-foreground" />
                  )}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-medium">
                    주문 내용을 확인했으며, 결제에 동의합니다
                  </span>
                  <span className="text-xs text-muted-foreground">
                    개인정보 제3자 제공, 결제대행 서비스 이용약관에 동의합니다.
                  </span>
                </span>
              </button>
            </section>
          </div>

          {/* 우: 결제 금액 요약 */}
          <div className="lg:w-80 lg:shrink-0">
            <OrderSummary
              itemsTotal={itemsTotal}
              discount={discount}
              canSubmit={agreed}
              paying={createOrder.isPending || retryPayment.isPending}
              // 배송지 미선택(프론트 차단) → 결제 승인 실패 → 요청 거부 순으로 안내.
              // 재결제 경로의 거부 사유(retryPayment)도 함께 본다 — 재결제 중이면
              // createOrder는 호출되지 않아 그쪽 메시지는 비어 있다.
              error={
                addressError ??
                paymentFailedMessage ??
                createOrder.errorMessage ??
                retryPayment.errorMessage
              }
              // 재고 부족은 재결제해도 실패하므로 결제 버튼 자체를 장바구니 이동으로 바꾼다
              unrecoverable={unrecoverable}
              onSubmit={handleSubmit}
              // 결제 항목은 sessionStorage 스냅샷이라 장바구니에서 빼고 와도 그대로 남는다.
              // 비우지 않으면 뒤로가기로 돌아왔을 때 방금 뺀 상품이 다시 보인다.
              onLeave={clearCheckoutState}
            />
          </div>
        </div>
      </main>

      <AddressFormModal
        open={addrModalOpen}
        onOpenChange={(next) => {
          setAddrModalOpen(next);
          if (!next) {
            // 닫을 때 이전 실패 안내·수정 대상 제거
            createAddress.reset();
            updateAddress.reset();
            setEditingAddr(null);
          }
        }}
        editing={editingAddr}
        onSubmit={handleSubmitAddress}
        submitting={createAddress.isPending || updateAddress.isPending}
        error={createAddress.errorMessage ?? updateAddress.errorMessage}
      />
    </div>
  );
}
