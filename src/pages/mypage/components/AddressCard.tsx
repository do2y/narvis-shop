import type { Address } from "@/shared/types/address";

export function AddressCard({
  address,
  onEdit,
  onRemove,
  onSetDefault,
  busy,
  deletable = true,
}: {
  address: Address;
  onEdit: () => void;
  onRemove: () => void;
  onSetDefault: () => void;
  busy?: boolean;
  // 서버 규칙: 유일한 배송지만 삭제 불가(ADDRESS_LAST_UNDELETABLE).
  // 기본 배송지도 다른 게 있으면 삭제되고, 가장 오래된 주소가 자동 승격된다.
  deletable?: boolean;
}) {
  return (
    <article className="rounded-sm border bg-background p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-tight">{address.label}</span>
          {address.isDefault && (
            <span className="inline-flex h-6 items-center rounded-full bg-primary px-2.5 text-xs font-medium text-primary-foreground">
              기본
            </span>
          )}
        </div>

        {/* 액션 — 기본이면 수정만, 아니면 기본 설정·수정·삭제 */}
        <div className="flex shrink-0 items-center gap-3 text-sm">
          {!address.isDefault && (
            <button
              type="button"
              onClick={onSetDefault}
              disabled={busy}
              className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              기본 설정
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="text-muted-foreground hover:text-foreground"
          >
            수정
          </button>
          {deletable && (
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              className="text-destructive hover:text-destructive/80 disabled:opacity-50"
            >
              삭제
            </button>
          )}
        </div>
      </div>

      <p className="mt-3 text-sm">
        {address.recipient} · {address.phone}
      </p>
      {/* 상세주소는 선택 — 서버가 null 또는 ""로 주므로 둘 다 빈 값으로 다룬다 */}
      <p className="mt-1 text-sm text-muted-foreground">
        ({address.zipCode}) {[address.address1, address.address2]
          .filter(Boolean)
          .join(" ")}
      </p>
    </article>
  );
}
