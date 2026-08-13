"use client";

import { useEffect, useRef, useState } from "react";
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

  // 진행 중인 업로드의 세대. 첨부가 교체·취소되면 올려서 이전 업로드 결과를 버린다.
  const uploadGenerationRef = useRef(0);

  // 살아 있는 blob URL 을 미러링한다. 언마운트 정리에서 최신 값을 읽어야 하는데,
  // attach 를 정리 이펙트의 deps 에 넣으면 첨부가 바뀔 때마다 정리가 돌아 방금 만든
  // 미리보기가 즉시 revoke 된다. 그래서 "동기화"와 "정리"를 다른 이펙트로 나눈다.
  const previewUrlRef = useRef<string | null>(null);
  useEffect(() => {
    previewUrlRef.current =
      attach.status === "uploading" || attach.status === "ready"
        ? attach.previewUrl
        : null;
  }, [attach]);

  // 첨부한 채로 화면을 떠나면(탭 전환·라우팅) createObjectURL 이 잡은 blob 이
  // 문서 수명 내내 메모리에 남는다. 판매자가 사진을 고르다 나가는 흐름이 실제로 있어
  // (등록을 그만두거나 주문 탭으로 넘어감) 쌓이는 경로다.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const startUpload = async (file: File) => {
    // 이 업로드가 아직 "현재" 첨부인지 가리는 표. 2장째를 고르거나 첨부를 취소하면
    // 세대가 올라가 뒤늦게 끝난 이전 업로드의 결과를 버린다.
    //
    // 없으면: 1장째 업로드 중에 2장째를 고르면 clearAttach 가 1장째 blob 을 revoke 하는데
    // 1장째 업로드는 계속 살아 있다가 setAttach({ready, previewUrl}) 로 되돌아온다 —
    // 화면엔 깨진 미리보기가 뜨고, 전송되는 imageUrl 은 판매자가 취소한 1장째다.
    const generation = ++uploadGenerationRef.current;
    const isStale = () => generation !== uploadGenerationRef.current;

    // 미리보기는 업로드 완료 전부터 보여준다 — 판매자가 문장을 쓰는 동안
    // "무엇을 올리는 중인지"가 보여야 한다
    const previewUrl = URL.createObjectURL(file);
    setAttach({ status: "uploading", previewUrl, fileName: file.name });

    try {
      const imageUrl = await uploadProductImage(file);
      if (isStale()) {
        // 이미 다른 첨부로 넘어갔다 — 이 blob 은 주인이 없으므로 여기서 정리한다
        URL.revokeObjectURL(previewUrl);
        return;
      }
      setAttach({ status: "ready", previewUrl, imageUrl, fileName: file.name });
    } catch (e) {
      URL.revokeObjectURL(previewUrl);
      if (isStale()) return;
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
    // 진행 중이던 업로드가 있으면 그 결과를 버린다 — 아래에서 blob 을 revoke 하므로
    // 뒤늦게 도착한 결과가 죽은 URL 로 미리보기를 되살리면 안 된다.
    uploadGenerationRef.current += 1;
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
              {/* 파일명을 보여준다 — 비슷한 사진이 여러 장일 때 썸네일만으로는
                  어느 것을 골랐는지 분간이 안 된다. 상태는 그 아래 한 줄로 분리해
                  "무엇을"과 "지금 어떤 상태인지"가 겹쳐 읽히지 않게 한다. */}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs font-medium">
                  {attach.fileName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {uploading ? "올리는 중…" : "첨부됨"}
                </span>
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
                // -ml-2: 폼의 px-4 안쪽으로 당겨 왼쪽 여백을 줄인다. 버튼 크기(size-8)와
                // 터치 타겟은 그대로 두고 자리만 옮기는 것이라 누르기 어려워지지 않는다.
                // -mr-0.5 로 입력 글자와의 간격도 한 단 좁힌다(폼 gap-2 를 일부 상쇄).
                "-ml-2 -mr-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground",
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
          placeholder={placeholder ?? "어떤 상품을 찾고 계신가요?"}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />

        {/* 업로드 중 전송을 막는다 — URL 없이 나가면 이미지 없는 초안이 된다.
            판정은 canSubmit 하나로 모은다(버튼과 submit 이 서로 다른 규칙을 갖지 않게). */}
        <button
          type="submit"
          disabled={!canSubmit({ text: value, attach, disabled })}
          aria-label="전송"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground transition-all duration-150 hover:opacity-90 active:scale-90 disabled:scale-100 disabled:opacity-40"
        >
          <ArrowUp className="size-4" />
        </button>
      </form>
    </div>
  );
}
