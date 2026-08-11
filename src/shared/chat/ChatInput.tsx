"use client";

import { useRef, useState } from "react";
import { ArrowUp, Loader2, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ProductImageUploadError,
  uploadProductImage,
} from "@/shared/api/productImage";
import { canSubmit, imageUrlsFor, type AttachState } from "./attachment";

interface ChatInputProps {
  /**
   * imageUrls 는 **이번 턴에 새로 첨부한 이미지**만 담긴다. 후속 턴에 다시 실으면
   * AI 가 매 턴 사진을 재분석해 상품명이 흔들리므로, 전송 후 여기서 비운다.
   */
  onSend: (message: string, imageUrls?: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  /** 이미지 첨부 허용(판매자 상품 등록). 기본은 꺼짐 — 구매자 챗엔 쓸 곳이 없다 */
  allowImage?: boolean;
  /** 입력 포커스 시 바깥 레이아웃이 반응해야 할 때(모바일 바텀시트 확장) */
  onFocus?: () => void;
}


/** 업로드 실패 줄 — retryFile 이 있을 때만 재시도를 권한다(형식 오류는 재시도해도 같다) */
function UploadFailed({
  message,
  retryFile,
  onRetry,
  onDismiss,
}: {
  message: string;
  retryFile: File | null;
  onRetry: (file: File) => void;
  onDismiss: () => void;
}) {
  return (
    <>
      <span className="flex-1 text-xs text-destructive">{message}</span>
      {retryFile && (
        <button
          type="button"
          onClick={() => onRetry(retryFile)}
          className="text-xs font-semibold text-brand underline-offset-4 hover:[@media(hover:hover)]:underline"
        >
          다시 시도
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="첨부 취소"
        className="text-muted-foreground transition-colors duration-150 hover:[@media(hover:hover)]:text-foreground"
      >
        <X className="size-4" />
      </button>
    </>
  );
}

export function ChatInput({
  onSend,
  disabled,
  placeholder,
  allowImage = false,
  onFocus,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [attach, setAttach] = useState<AttachState>({ status: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);

  const uploading = attach.status === "uploading";

  const startUpload = async (file: File) => {
    // 미리보기는 업로드 완료 전부터 보여준다 — 판매자가 문장을 쓰는 동안
    // "무엇을 올리는 중인지"가 보여야 한다
    const previewUrl = URL.createObjectURL(file);
    setAttach({ status: "uploading", previewUrl });

    try {
      const imageUrl = await uploadProductImage(file);
      setAttach({ status: "ready", previewUrl, imageUrl });
    } catch (e) {
      URL.revokeObjectURL(previewUrl);
      const err =
        e instanceof ProductImageUploadError
          ? e
          : new ProductImageUploadError("이미지를 올리지 못했어요.", true);
      setAttach({
        status: "failed",
        message: err.message,
        // 형식 오류는 같은 파일을 다시 올려도 결과가 같다 — 재시도를 권하지 않는다
        retryFile: err.retryable ? file : null,
      });
    }
  };

  const clearAttach = () => {
    if (attach.status === "uploading" || attach.status === "ready") {
      URL.revokeObjectURL(attach.previewUrl);
    }
    setAttach({ status: "idle" });
  };

  const submit = () => {
    if (!canSubmit({ text: value, attach, disabled })) return;

    onSend(value.trim(), imageUrlsFor(attach));

    setValue("");
    // 전송한 이미지는 여기서 비운다 — 남겨두면 다음 턴에도 실려 재분석된다
    clearAttach();
  };

  return (
    <div className="flex flex-col gap-2">
      {/* 첨부 미리보기 — 입력창 위에 둔다(입력창 안에 넣으면 좁은 화면에서 글자가 밀린다) */}
      {attach.status !== "idle" && (
        <div className="flex items-center gap-2 rounded-sm border bg-background px-3 py-2">
          {attach.status === "failed" ? (
            <UploadFailed
              message={attach.message}
              retryFile={attach.retryFile}
              onRetry={startUpload}
              onDismiss={clearAttach}
            />
          ) : (
            <>
              <div className="relative size-10 shrink-0 overflow-hidden rounded-sm bg-muted">
                {/* 로컬 blob 미리보기 — 업로드 완료 후에도 그대로 쓴다(같은 파일이다) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attach.previewUrl}
                  alt=""
                  className="size-full object-cover"
                />
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-foreground/40">
                    <Loader2 className="size-4 animate-spin text-background" />
                  </div>
                )}
              </div>
              <span className="flex-1 truncate text-xs text-muted-foreground">
                {uploading ? "이미지 올리는 중…" : "이미지 1장 첨부됨"}
              </span>
              <button
                type="button"
                onClick={clearAttach}
                aria-label="첨부 제거"
                className="text-muted-foreground transition-colors duration-150 hover:[@media(hover:hover)]:text-foreground"
              >
                <X className="size-4" />
              </button>
            </>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-center gap-2 rounded-full border bg-background/80 px-4 py-2 shadow-sm backdrop-blur transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-brand/40"
      >
        {allowImage && (
          <>
            <input
              ref={fileRef}
              type="file"
              // 전송 형식(WebP)보다 넓게 받는다 — 업로드 전 canvas 가 변환하므로
              // HEIC(아이폰 기본 촬영 포맷)도 고를 수 있어야 한다. accept 를 좁히면
              // 사진 앱에서 아예 선택이 안 돼 "왜 내 사진이 회색이지"가 된다.
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                // 같은 파일을 다시 고를 수 있게 값을 비운다(안 그러면 onChange 가 안 뜬다)
                e.target.value = "";
                if (!file) return;
                // MVP 는 1장 — 2장째 선택은 교체로 처리한다
                clearAttach();
                void startUpload(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={disabled}
              aria-label="사진 첨부"
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground",
                "transition-colors duration-150 ease-out-strong",
                "hover:[@media(hover:hover)]:bg-muted hover:[@media(hover:hover)]:text-foreground",
                "disabled:pointer-events-none disabled:opacity-40",
              )}
            >
              <Paperclip className="size-4" />
            </button>
          </>
        )}

        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={onFocus}
          placeholder={placeholder ?? "특별히 바꾸고 싶은 점이 있으신가요?"}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />

        {/* 업로드 중 전송을 막는다 — URL 없이 나가면 이미지 없는 초안이 된다 */}
        <button
          type="submit"
          disabled={disabled || uploading || !value.trim()}
          aria-label="전송"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground transition-all duration-150 hover:opacity-90 active:scale-90 disabled:scale-100 disabled:opacity-40"
        >
          <ArrowUp className="size-4" />
        </button>
      </form>
    </div>
  );
}
