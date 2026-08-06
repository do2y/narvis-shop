import { BUYER_PROGRESS_LABEL } from "@/shared/types/chat";
import type { BuyerProgress, SellerProgress } from "@/shared/types/chat";

/**
 * progress 이벤트 → 화면에 띄울 문구.
 *
 * 훅 밖에 두는 이유: 계약이 FE 에 위임한 규약 두 개(모르는 stage 는 무시 · 서버가
 * message 를 비우면 stage 로 자체 문구를 매핑)가 전부 여기 모여 있어서다.
 * 스트림 소비 흐름 안에 두면 테스트로 고정할 수가 없다.
 *
 * null 반환 = "표시할 것이 없다"가 아니라 **"이 프레임은 무시하라"**다.
 * 호출부는 null 일 때 기존 문구를 유지해야 한다 — 덮어서 지우면 직전 단계 문구까지
 * 사라져 진행 표시가 도리어 후퇴한다.
 */
export function resolveProgressText(
  data: BuyerProgress | SellerProgress,
): string | null {
  // 판매자는 자유 문자열 {text}, 구매자는 {stage, message?} — 쉐이프가 다르다(계약 CH-2).
  if (!("stage" in data)) return data.text || null;

  // 서버 문구가 우선. 계약상 서버는 빈 값이면 키 자체를 싣지 않지만,
  // 빈 문자열이 실려 와도 라벨로 폴백하도록 둔다(빈 말풍선보다 낫다).
  if (data.message) return data.message;

  // 모르는 stage 는 여기서 undefined → null 이 되어 호출부가 무시한다.
  return BUYER_PROGRESS_LABEL[data.stage] ?? null;
}
