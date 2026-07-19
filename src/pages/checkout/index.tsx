import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { AppHeader } from "@/shared/ui/AppHeader";
import { buttonVariants } from "@/shared/ui/button";
import { cn } from "@/lib/utils";
import type { AddressInput } from "@/shared/types/address";
import type {
  CheckoutState,
  CreateOrderRequest,
  OrderCompleteState,
  PaymentMethod,
} from "./types";
import { PAYMENT_METHODS } from "./placeholder";
import { useCreateOrder } from "./useCreateOrder";
import { useAddresses, useCreateAddress } from "./useAddresses";
import { OrderItems } from "./components/OrderItems";
import { ShippingSection } from "./components/ShippingSection";
import { AddressFormModal } from "@/shared/ui/AddressFormModal";
import { PaymentSection } from "./components/PaymentSection";
import { OrderSummary } from "./components/OrderSummary";

export default function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  // 상세 "바로 구매"에서 넘어온 주문 항목. 직접 진입/새로고침 시 없음.
  const state = location.state as CheckoutState | null;
  const items = useMemo(() => state?.items ?? [], [state]);

  const { data: addresses = [] } = useAddresses();
  const createAddress = useCreateAddress();

  // 선택된 배송지. null이면 기본 배송지(없으면 첫 항목)를 따른다 —
  // 목록 로딩 전에는 값을 정할 수 없어 사용자가 고르기 전까지 파생값을 쓴다.
  const [pickedId, setPickedId] = useState<number | null>(null);
  const addressId =
    pickedId ??
    addresses.find((a) => a.isDefault)?.addressId ??
    addresses[0]?.addressId ??
    null;
  const [addrModalOpen, setAddrModalOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>(PAYMENT_METHODS[0].value);
  const [agreed, setAgreed] = useState(false);

  // 결제 실패(PAYMENT_FAILED)는 HTTP 200이라 mutation 에러가 아니다.
  // 요청 자체가 거부된 경우와 구분해 따로 안내한다.
  const [paymentFailed, setPaymentFailed] = useState(false);
  const createOrder = useCreateOrder();

  const handleAddAddress = async (addr: AddressInput) => {
    try {
      const { addressId: newId } = await createAddress.mutateAsync(addr);
      setPickedId(newId); // 방금 추가한 배송지를 선택
      setAddrModalOpen(false); // 성공했을 때만 닫는다(실패 시 입력값 보존)
    } catch {
      // 실패 사유는 createAddress.errorMessage로 모달에 노출된다
    }
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
            to="/"
            className={cn(buttonVariants(), "mt-2 h-11 rounded-full px-6")}
          >
            홈으로
          </Link>
        </main>
      </div>
    );
  }

  const handleSubmit = async () => {
    const address = addresses.find((a) => a.addressId === addressId);
    if (!address || createOrder.isPending) return;

    setPaymentFailed(false);

    // 라인아이템 출처는 정확히 하나만 보낸다(둘 다 보내면 400).
    // 장바구니에서 넘어온 항목은 cartItemId를 갖고, 상세 "바로 구매"는 없다.
    const cartItemIds = items
      .map((it) => it.cartItemId)
      .filter((id): id is number => id != null);
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
      paymentMethod: method,
    };

    try {
      const result = await createOrder.mutateAsync(body);

      // 결제 실패도 200 — status로 구분한다. 자동 재시도하지 않고 안내만.
      if (result.status === "PAYMENT_FAILED") {
        setPaymentFailed(true);
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
      navigate("/checkout/complete", { state: { order }, replace: true });
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
              onSelect={setPickedId}
              onAddClick={() => setAddrModalOpen(true)}
            />
            <PaymentSection
              method={method}
              onMethodChange={(m) => {
                setMethod(m);
                setPaymentFailed(false); // 수단 변경 시 이전 실패 안내 제거
                createOrder.reset();
              }}
            />

            {/* 동의 */}
            <section className="rounded-sm border bg-background p-5 sm:p-6">
              <button
                type="button"
                onClick={() => setAgreed((v) => !v)}
                className="flex w-full items-start gap-3 text-left"
              >
                <span
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
              paying={createOrder.isPending}
              // 결제 승인 실패와 요청 거부를 각각 안내
              error={
                paymentFailed
                  ? "결제에 실패했어요. 결제 수단을 확인한 뒤 다시 시도해주세요."
                  : createOrder.errorMessage
              }
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </main>

      <AddressFormModal
        open={addrModalOpen}
        onOpenChange={(next) => {
          setAddrModalOpen(next);
          if (!next) createAddress.reset(); // 닫을 때 이전 실패 안내 제거
        }}
        onSubmit={handleAddAddress}
        submitting={createAddress.isPending}
        error={createAddress.errorMessage}
      />
    </div>
  );
}
