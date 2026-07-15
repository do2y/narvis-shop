import { useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { AppHeader } from "@/shared/ui/AppHeader";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  Address,
  CheckoutState,
  OrderCompleteState,
} from "./types";
import {
  MOCK_FAIL_CARD,
  PAYMENT_METHODS,
  PLACEHOLDER_ADDRESSES,
} from "./placeholder";
import { OrderItems } from "./components/OrderItems";
import { ShippingSection } from "./components/ShippingSection";
import { AddressFormModal } from "./components/AddressFormModal";
import { PaymentSection } from "./components/PaymentSection";
import { OrderSummary } from "./components/OrderSummary";

export default function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  // 상세 "바로 구매"에서 넘어온 주문 항목. 직접 진입/새로고침 시 없음.
  const state = location.state as CheckoutState | null;
  const items = useMemo(() => state?.items ?? [], [state]);

  const defaultAddressId =
    PLACEHOLDER_ADDRESSES.find((a) => a.isDefault)?.id ??
    PLACEHOLDER_ADDRESSES[0]?.id ??
    "";
  // 배송지 목록은 로컬 소유(추가분 반영). 계약 후 배송지 조회 API로 대체.
  const [addresses, setAddresses] = useState<Address[]>(PLACEHOLDER_ADDRESSES);
  const [addressId, setAddressId] = useState(defaultAddressId);
  const [addrModalOpen, setAddrModalOpen] = useState(false);
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [cardNumber, setCardNumber] = useState("");
  const [agreed, setAgreed] = useState(false);

  // 모의 결제 처리 상태. paying=승인 대기 중, payError=실패 안내(재시도 유도).
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // 새 배송지 임시 id 카운터 — 서버 id 부여 전 로컬 구분용.
  const nextIdRef = useRef(1);

  const handleAddAddress = (addr: Omit<Address, "id">) => {
    const id = `new-${nextIdRef.current++}`;
    setAddresses((prev) => [...prev, { ...addr, id }]);
    setAddressId(id); // 방금 추가한 배송지를 선택
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

  // 카드 결제인데 "실패 카드"면 승인 실패로 처리. 공백 차이는 무시하고 비교.
  const isFailCard =
    method === "신용 · 체크카드" &&
    cardNumber.replace(/\s/g, "") === MOCK_FAIL_CARD.replace(/\s/g, "");

  // 결제대행 계약 전 — 실제 결제는 목. 동의 시에만 활성화.
  const handleSubmit = () => {
    const address = addresses.find((a) => a.id === addressId);
    if (!address || paying) return;

    setPayError(null);
    setPaying(true);

    // 승인 대기를 흉내낸 지연 후 성공/실패 분기.
    // TODO: 주문 생성 API 연결 → 실제 승인 응답으로 성공/실패·주문번호 교체.
    setTimeout(() => {
      setPaying(false);

      if (isFailCard) {
        // 자동 재시도하지 않고 안내만 — 사용자가 카드 수정 후 다시 시도.
        setPayError(
          "카드 승인에 실패했어요. 카드 정보를 확인한 뒤 다시 시도해주세요.",
        );
        return;
      }

      const orderNo = `ORD-${new Date().getFullYear()}${String(Date.now()).slice(-8)}`;
      const order: OrderCompleteState["order"] = {
        orderNo,
        items,
        address,
        method,
        itemsTotal,
        discount,
        finalTotal: itemsTotal - discount,
      };

      // replace로 이동 — 뒤로가기로 결제 화면에 돌아와 중복 결제하는 것을 막는다.
      navigate("/checkout/complete", { state: { order }, replace: true });
    }, 800);
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
              onSelect={setAddressId}
              onAddClick={() => setAddrModalOpen(true)}
            />
            <PaymentSection
              method={method}
              onMethodChange={(m) => {
                setMethod(m);
                setPayError(null); // 수단 변경 시 이전 실패 안내 제거
              }}
              cardNumber={cardNumber}
              onCardNumberChange={(v) => {
                setCardNumber(v);
                setPayError(null); // 카드 수정 시 이전 실패 안내 제거
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
              paying={paying}
              error={payError}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </main>

      <AddressFormModal
        open={addrModalOpen}
        onOpenChange={setAddrModalOpen}
        onSubmit={handleAddAddress}
      />
    </div>
  );
}
