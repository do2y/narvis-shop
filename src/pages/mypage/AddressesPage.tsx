import { useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAddresses, useAddressMutations } from "./useAddresses";
import { AddressCard } from "./components/AddressCard";
import { AddressFormModal } from "./components/AddressFormModal";
import type { Address, AddressInput } from "./types";

function AddressesSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-sm border bg-background p-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-5 w-12" />
          </div>
          <Skeleton className="mt-3 h-4 w-40" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
      ))}
    </div>
  );
}

export default function AddressesPage() {
  const { data: addresses, isPending, isError, refetch } = useAddresses();
  const { add, update, remove, setDefault } = useAddressMutations();

  // 모달 상태 — editing 있으면 수정, null이면 추가(open으로 구분).
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);

  const openAdd = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (address: Address) => {
    setEditing(address);
    setOpen(true);
  };

  const handleSubmit = (input: AddressInput) => {
    const onDone = () => setOpen(false);
    if (editing) {
      update.mutate({ addressId: editing.addressId, input }, { onSuccess: onDone });
    } else {
      add.mutate(input, { onSuccess: onDone });
    }
  };

  const handleRemove = (address: Address) => {
    if (window.confirm(`'${address.label}' 배송지를 삭제할까요?`)) {
      remove.mutate(address.addressId);
    }
  };

  const busy = remove.isPending || setDefault.isPending;

  return (
    <div>
      <h2 className="text-lg font-bold">배송지 관리</h2>

      <div className="mt-5">
        {isPending ? (
          <AddressesSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed py-16 text-center">
            <p className="text-sm text-muted-foreground">
              배송지를 불러오지 못했어요.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-10 rounded-full px-5",
              )}
            >
              다시 시도
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {addresses.map((address) => (
              <AddressCard
                key={address.addressId}
                address={address}
                busy={busy}
                onEdit={() => openEdit(address)}
                onRemove={() => handleRemove(address)}
                onSetDefault={() => setDefault.mutate(address.addressId)}
              />
            ))}

            {/* 배송지 추가 — 점선 버튼 */}
            <button
              type="button"
              onClick={openAdd}
              className="flex h-14 items-center justify-center gap-1.5 rounded-sm border border-dashed text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <Plus className="size-4" />
              배송지 추가
            </button>
          </div>
        )}
      </div>

      <AddressFormModal
        open={open}
        onOpenChange={setOpen}
        address={editing ?? undefined}
        onSubmit={handleSubmit}
        isPending={add.isPending || update.isPending}
      />
    </div>
  );
}
