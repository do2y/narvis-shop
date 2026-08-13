/**
 * 채팅 입력창의 이미지 첨부 상태 (판매자 상품 등록).
 *
 * 상태를 파일에 분리한 이유는 전송 규칙을 테스트로 고정하기 위해서다. 이 규칙 하나가
 * 깨지면 AI 가 매 턴 사진을 다시 분석해 상품명이 흔들리는데, 화면만 보고는 알아채기
 * 어렵다(응답이 그럴듯하게 오기 때문에).
 */

export type AttachState =
  | { status: "idle" }
  | { status: "uploading"; previewUrl: string; fileName: string }
  | {
      status: "ready";
      previewUrl: string;
      imageUrl: string;
      fileName: string;
    }
  | {
      status: "failed";
      message: string;
      /** 재시도 대상. 형식 오류처럼 다시 올려도 같은 결과면 null 이다 */
      retryFile: File | null;
    };

/**
 * 이번 턴에 실을 imageUrls.
 *
 * **ready 일 때만 값이 나온다.** 업로드 중이면 URL 이 아직 없고, 전송 후에는 호출부가
 * 상태를 idle 로 되돌리므로 다음 턴은 자동으로 undefined 가 된다 —
 * "새로 첨부한 턴에만 보낸다"는 계약이 이 두 가지로 지켜진다.
 */
export function imageUrlsFor(attach: AttachState): string[] | undefined {
  return attach.status === "ready" ? [attach.imageUrl] : undefined;
}

/**
 * 지금 전송해도 되는지.
 *
 * uploading 을 막는 것이 핵심이다 — 통과시키면 URL 없이 요청이 나가 이미지 없는
 * 초안이 만들어지고, 판매자는 사진을 올렸다고 믿는다.
 * failed 는 막지 않는다: 이미지 없이 보내는 선택은 판매자에게 남긴다.
 */
export function canSubmit(params: {
  text: string;
  attach: AttachState;
  disabled?: boolean;
}): boolean {
  const { text, attach, disabled } = params;
  if (disabled) return false;
  if (attach.status === "uploading") return false;
  // 텍스트가 없어도 이미지가 준비됐으면 보낼 수 있다 — 사진만 올리고 "초안 작성해줘"를
  // 이어서 말하는 흐름이 계약에 있고(2턴 시나리오), AI 가 사진만으로 되묻는다.
  return Boolean(text.trim()) || attach.status === "ready";
}
