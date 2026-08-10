"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/shared/api/client";
import { setPersonalization } from "./api";
import { useGraphCacheWriter } from "./useProfileGraph";
import { isServerFault } from "./types";

/**
 * 개인화 ON/OFF (M-16).
 *
 * 5종 중 유일하게 If-Match가 선택이라 보내지 않는다. 연타도 막을 필요가 없다 —
 * 같은 값을 다시 보내도 서버가 replayed: true로 정상 200을 준다.
 *
 * **끈다고 데이터가 지워지지 않는다.** 사용·수집만 멈추고 보존되며, 다시 켜면
 * 복원된다. 그래서 확인 다이얼로그를 두지 않는다(되돌릴 수 있는 동작).
 */
export function usePersonalization() {
  const cache = useGraphCacheWriter();

  return useMutation({
    mutationFn: (enabled: boolean) => setPersonalization(enabled),
    retry: false,

    onSuccess: (data) => {
      // 성공 응답의 graphVersion·personalization을 캐시에 반영한다.
      // 재조회하지 않는 이유: 취향 목록은 이 동작으로 바뀌지 않으므로
      // 200개를 다시 받아올 이유가 없다.
      cache.setPersonalization(data.graphVersion, data.personalization);

      if (data.personalization.enabled) {
        toast.success("개인화를 켰어요.");
        return;
      }

      // ⚠️ "즉시 반영"을 약속하지 않는다 — 홈 추천에 최대 10분간 이전 결과가
      // 남는다(서버 캐시, 노션 3.1). 약속하면 사용자가 홈에서 옛 추천을 보고
      // 기능이 고장난 줄 안다.
      toast.success("개인화를 껐어요. 홈 화면 반영까지 몇 분 걸릴 수 있어요.");
    },

    onError: (error) => {
      // 5xx — 서버 문구를 그대로 흘리지 않는다. 스위치는 서버 값으로만
      // 그리므로(낙관적 갱신 없음) 실패하면 화면이 알아서 이전 상태로 남는다.
      if (error instanceof ApiError && isServerFault(error.status)) {
        toast.error("지금은 설정을 바꿀 수 없어요. 잠시 후 다시 시도해주세요.");
        return;
      }

      toast.error(
        error instanceof ApiError
          ? error.displayMessage
          : "설정을 바꾸지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    },
  });
}
