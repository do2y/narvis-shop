import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { addressSchema, type AddressFormValues } from "../addressSchema";
import type { Address, AddressInput } from "../types";

// 배송지 추가/수정 모달 — RHF + Zod. address(수정 대상) 있으면 수정 모드.
export function AddressFormModal({
  open,
  onOpenChange,
  address,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address?: Address; // 있으면 수정 모드
  onSubmit: (input: AddressInput) => void;
  isPending?: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: "",
      recipient: "",
      phone: "",
      zipCode: "",
      address: "",
      detail: "",
    },
  });

  // 모달이 열릴 때 수정 대상 값으로 채우거나(수정) 초기화(추가).
  // 수정 시 상세주소 분리는 목 단계라 생략 — 저장된 주소 전체를 기본주소에 채운다.
  useEffect(() => {
    if (!open) return;
    reset(
      address
        ? {
            label: address.label,
            recipient: address.recipient,
            phone: address.phone,
            zipCode: address.zipCode,
            address: address.address,
            detail: "",
          }
        : {
            label: "",
            recipient: "",
            phone: "",
            zipCode: "",
            address: "",
            detail: "",
          },
    );
  }, [open, address, reset]);

  const submit = (values: AddressFormValues) => {
    const full = values.detail
      ? `${values.address} ${values.detail}`
      : values.address;
    onSubmit({
      label: values.label,
      recipient: values.recipient,
      phone: values.phone,
      zipCode: values.zipCode,
      address: full,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{address ? "배송지 수정" : "새 배송지 추가"}</DialogTitle>

        <form
          onSubmit={handleSubmit(submit)}
          className="mt-5 flex flex-col gap-4"
          noValidate
        >
          <Field label="배송지명" htmlFor="addr-label" error={errors.label?.message}>
            <Input
              id="addr-label"
              placeholder="집, 회사 등"
              aria-invalid={!!errors.label}
              className="h-11 rounded-sm"
              {...register("label")}
            />
          </Field>

          <Field
            label="받는 분"
            htmlFor="addr-recipient"
            error={errors.recipient?.message}
          >
            <Input
              id="addr-recipient"
              autoComplete="name"
              aria-invalid={!!errors.recipient}
              className="h-11 rounded-sm"
              {...register("recipient")}
            />
          </Field>

          <Field label="연락처" htmlFor="addr-phone" error={errors.phone?.message}>
            <Input
              id="addr-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="010-1234-5678"
              aria-invalid={!!errors.phone}
              className="h-11 rounded-sm"
              {...register("phone")}
            />
          </Field>

          <Field
            label="우편번호"
            htmlFor="addr-zip"
            error={errors.zipCode?.message}
          >
            {/* TODO: 우편번호 검색(다음/카카오 API) 연동 후 검색 버튼 추가 */}
            <Input
              id="addr-zip"
              inputMode="numeric"
              placeholder="06292"
              aria-invalid={!!errors.zipCode}
              className="h-11 rounded-sm"
              {...register("zipCode")}
            />
          </Field>

          <Field label="주소" htmlFor="addr-address" error={errors.address?.message}>
            <Input
              id="addr-address"
              placeholder="도로명 주소"
              aria-invalid={!!errors.address}
              className="h-11 rounded-sm"
              {...register("address")}
            />
          </Field>

          <Field label="상세주소" htmlFor="addr-detail">
            <Input
              id="addr-detail"
              placeholder="동·호수 등 (선택)"
              className="h-11 rounded-sm"
              {...register("detail")}
            />
          </Field>

          <div className="mt-2 flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-sm"
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="h-11 flex-1 rounded-sm"
            >
              {isPending ? "저장 중…" : "저장"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
