import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/ui/dialog";
import { addressSchema, type AddressValues } from "../schema";
import type { AddressInput } from "../types";

// 배송지 추가 모달 — RHF + Zod. 저장 시 상위로 올려 POST /api/addresses로 전송한다.
export function AddressFormModal({
  open,
  onOpenChange,
  onSubmit,
  submitting,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (address: AddressInput) => void;
  submitting?: boolean;
  error?: string | null;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: "",
      recipient: "",
      phone: "",
      zipCode: "",
      address1: "",
      address2: "",
    },
  });

  // 저장 성공 여부는 상위가 판단하므로 여기선 값만 올린다.
  // (실패 시 모달을 열어둔 채 error를 보여주기 위해 여기서 닫지 않는다)
  const submit = (values: AddressValues) => {
    onSubmit(values);
  };

  // 닫힐 때 입력값 초기화 (다음에 다시 열면 빈 폼)
  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogTitle>새 배송지 추가</DialogTitle>

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
            {/* TODO: 우편번호 검색(다음/카카오 우편번호 API) 연동 후 검색 버튼 추가 */}
            <Input
              id="addr-zip"
              inputMode="numeric"
              placeholder="06236"
              aria-invalid={!!errors.zipCode}
              className="h-11 rounded-sm"
              {...register("zipCode")}
            />
          </Field>

          <Field
            label="주소"
            htmlFor="addr-address1"
            error={errors.address1?.message}
          >
            <Input
              id="addr-address1"
              placeholder="도로명 주소"
              aria-invalid={!!errors.address1}
              className="h-11 rounded-sm"
              {...register("address1")}
            />
          </Field>

          <Field label="상세주소" htmlFor="addr-address2">
            <Input
              id="addr-address2"
              placeholder="동·호수 등 (선택)"
              className="h-11 rounded-sm"
              {...register("address2")}
            />
          </Field>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="mt-2 flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-sm"
              onClick={() => handleOpenChange(false)}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="h-11 flex-1 rounded-sm"
            >
              {submitting ? "저장 중…" : "저장"}
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
