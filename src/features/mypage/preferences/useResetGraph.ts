"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/shared/api/client";
import { resetGraph } from "./api";
import { useGraphCacheWriter } from "./useProfileGraph";
import { isServerFault, isVersionConflict } from "./types";

/**
 * 개인화 전체 초기화 (M-15) — **되돌릴 수 없다. 대화 기록까지 지워진다.**
 *
 * 409에서 **자동 재시도하지 않는다**(노션 6.2). "전부 지워줘"는 그 사이 내용이
 * 바뀌면 파괴 범위 자체가 달라지므로, 사용자가 최신 화면을 보고 확인창부터
 * 다시 거쳐야 한다.
 *
 * 프로필이 없는 회원도 오류가 아니다 — purged가 전부 0으로 정상 200이다.
 */
export function useResetGraph() {
  const cache = useGraphCacheWriter();

  return useMutation({
    mutationFn: (graphVersion: string) => resetGraph(graphVersion),
    retry: false,

    onSuccess: (data) => {
      cache.setVersion(data.graphVersion);
      // 목록이 비었으므로 재조회로 빈 화면을 받아온다
      void cache.refetch();

      /*
        결과를 개수로 안내한다(노션 3.6).

        대화 기록을 반드시 함께 적는다 — 사용자가 가장 놓치기 쉬운 항목이라,
        빠뜨리면 "취향만 지워진 줄" 알고 나중에 대화가 사라진 것을 발견한다.
      */
      const { edges, transcriptTurns } = data.purged;
      toast.success(
        `취향 ${edges}건과 대화 ${transcriptTurns}건이 삭제되었습니다.`,
      );
    },

    onError: (error) => {
      if (error instanceof ApiError && isVersionConflict(error.code)) {
        // 화면을 최신으로 되돌린다. 다시 초기화할지는 사용자가 확인창부터
        // 새로 판단한다 — 자동 재시도는 금지다.
        void cache.refetch();
        toast.error("그 사이 취향이 업데이트됐어요. 최신 내용으로 새로고침했어요.");
        return;
      }

      /*
        5xx — 서버 문구를 그대로 흘리지 않는다.

        초기화만 문구가 한 겹 더 조심스럽다. 다른 동작과 달리 실패했을 때
        "지워졌나 안 지워졌나"가 사용자에게 남는 질문이라, 여기서 단정하면
        서버가 절반쯤 지운 경우에 거짓말이 된다. 화면을 직접 확인하도록
        안내하는 편이 정확하다.
      */
      if (error instanceof ApiError && isServerFault(error.status)) {
        toast.error(
          "지금은 초기화할 수 없어요. 잠시 후 목록을 다시 확인해주세요.",
        );
        return;
      }

      toast.error(
        error instanceof ApiError
          ? error.displayMessage
          : "초기화하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    },
  });
}
