import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import type { Address } from "@/shared/types/address";

// 배송지 선택 + 배송 요청사항 입력.
export function ShippingSection({
  addresses,
  selectedId,
  onSelect,
  onAddClick,
  onEditClick,
  deliveryRequest,
  onDeliveryRequestChange,
}: {
  addresses: Address[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onAddClick: () => void;
  onEditClick: (address: Address) => void;
  // 주문 1회성 지시 — 배송지에 저장되지 않고 주문에만 붙는다.
  deliveryRequest: string;
  onDeliveryRequestChange: (value: string) => void;
}) {
  return (
    <section className="rounded-sm border bg-background p-5 sm:p-6">
      <h2 className="text-lg font-bold">배송지</h2>

      <ul className="mt-4 flex flex-col gap-3">
        {addresses.map((addr) => {
          const active = addr.addressId === selectedId;
          return (
            <li
              key={addr.addressId}
              className={cn(
                "relative flex items-start gap-3 rounded-sm border p-4 transition-colors",
                active ? "border-primary" : "border-input hover:bg-muted/40",
              )}
            >
              {/* 선택 버튼이 카드 전체를 덮고, 수정 버튼만 그 위로 올린다
                  (버튼 중첩은 불가하므로 stretched-link 패턴) */}
              <button
                type="button"
                onClick={() => onSelect(addr.addressId)}
                className="absolute inset-0 rounded-sm"
                aria-label={`${addr.label} 배송지 선택`}
              />
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                  active ? "border-primary bg-primary" : "border-input",
                )}
              >
                {active && <Check className="size-3 text-primary-foreground" />}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {addr.recipient} ({addr.label})
                  </span>
                  {addr.isDefault && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      기본
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {addr.recipient} · {addr.phone}
                </p>
                <p className="text-sm text-muted-foreground">
                  ({addr.zipCode}) {addr.address1}
                  {addr.address2 ? ` ${addr.address2}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onEditClick(addr)}
                className="relative shrink-0 text-sm text-muted-foreground hover:text-foreground"
              >
                수정
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onAddClick}
        className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-sm border border-dashed text-sm text-muted-foreground hover:bg-muted/40"
      >
        <Plus className="size-4" />새 배송지 추가
      </button>

      {/* 배송 요청사항 — 이 주문에만 붙는 1회성 지시(배송지에 저장되지 않음) */}
      <div className="mt-5 flex flex-col gap-2">
        <Label htmlFor="delivery-request">배송 요청사항</Label>
        <Input
          id="delivery-request"
          value={deliveryRequest}
          onChange={(e) => onDeliveryRequestChange(e.target.value)}
          placeholder="문 앞에 놓아주세요 (선택)"
          maxLength={100}
          className="h-11 rounded-sm"
        />
      </div>
    </section>
  );
}
