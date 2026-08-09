"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";

import { cn } from "@/lib/utils";
import { ChevronDownIcon } from "lucide-react";

// 네이티브 <select>를 대체하는 목록 상자.
// 네이티브 <option>은 자식 요소를 넣을 수 없어(배지·행 배경 불가) 상태를 글자색으로만
// 표현하게 된다. 품절처럼 "고를 수 없음"을 한눈에 보여야 하는 곳에서 쓴다.
// 그 외 단순 선택은 네이티브로 충분하다.

// 값 타입은 string 으로 고정한다 — 이 프로젝트의 선택지는 전부 문자열 ID다
// (64비트 ID를 숫자로 바꾸면 끝자리가 조용히 바뀐다).
function Select({ ...props }: SelectPrimitive.Root.Props<string>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-11 w-full items-center justify-between gap-2 rounded-sm border bg-background px-4 text-left text-sm font-medium outline-none",
        "transition-colors duration-150 ease-out-strong",
        "hover:[@media(hover:hover)]:bg-muted/40",
        "focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="pointer-events-none shrink-0 text-muted-foreground">
        <ChevronDownIcon className="size-4" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("min-w-0 truncate", className)}
      {...props}
    />
  );
}

function SelectContent({
  className,
  children,
  sideOffset = 4,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<SelectPrimitive.Positioner.Props, "sideOffset">) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        className="isolate z-50 outline-none"
        sideOffset={sideOffset}
        // 트리거 폭에 맞춰야 목록이 입력칸의 연장으로 읽힌다.
        alignItemWithTrigger={false}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "z-50 max-h-(--available-height) w-(--anchor-width) origin-(--transform-origin) overflow-y-auto rounded-sm bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none",
            // 트리거에서 자라나게 — 목록이 어디서 왔는지 보이게 한다.
            "duration-150 ease-out-strong data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        >
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex cursor-default items-center justify-between gap-3 rounded-sm px-3 py-2 text-sm outline-none select-none",
        "transition-colors duration-150 ease-out-strong",
        // 키보드 하이라이트와 마우스 hover 를 같은 표현으로 묶는다 —
        // 둘이 다르면 어느 항목이 선택될지 두 가지로 읽힌다.
        "data-highlighted:bg-muted data-selected:font-semibold",
        // 고를 수 없는 항목은 hover 반응을 전부 걷어낸다. 밝아지기만 해도
        // 누를 수 있는 것처럼 보인다.
        "data-disabled:pointer-events-none data-disabled:bg-muted/60 data-disabled:text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </SelectPrimitive.Item>
  );
}

function SelectItemText({
  className,
  ...props
}: SelectPrimitive.ItemText.Props) {
  return (
    <SelectPrimitive.ItemText
      data-slot="select-item-text"
      className={cn("min-w-0 truncate", className)}
      {...props}
    />
  );
}

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectItemText,
};
