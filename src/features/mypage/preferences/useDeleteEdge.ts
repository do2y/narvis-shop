"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/shared/api/client";
import { deleteEdge } from "./api";
import { useGraphCacheWriter } from "./useProfileGraph";
import { isServerFault, isVersionConflict, PROFILE_EDGE_NOT_FOUND } from "./types";

/**
 * 취향 항목 삭제 (M-13) — **되돌릴 수 없다.**
 *
 * 409(버전 충돌)에서 **삭제만 자동 재시도한다**(노션 6.2). 기준은 "의도가 상태
 * 변화에 흔들리는가"다 — 삭제는 "이걸 없애줘"이고 대상이 edgeId로 고정돼 있어
 * 그 사이 다른 게 바뀌어도 결과가 달라지지 않는다. 수정·초기화는 병합 여부나
 * 범위가 달라지므로 자동 재시도하지 않는다.
 *
 * ⚠️ 중단 조건이 있다: 재조회했을 때 그 edgeId가 **없으면 재시도하지 않는다.**
 * 그 사이 내용이 바뀌었다는 뜻이라, 밀어붙이면 사용자가 의도하지 않은 것을
 * 건드린다.
 *
 * React Query의 `retry`를 쓰지 않는 이유: 재시도 사이에 M-11 재조회와
 * "edgeId가 살아 있는지" 판정이 끼어들어야 하는데, retry 옵션은 같은 요청을
 * 그대로 다시 보낼 뿐이라 그 사이에 로직을 넣을 수 없다.
 */
export function useDeleteEdge() {
  const cache = useGraphCacheWriter();
  // 자동 재시도 카운터. 401(토큰 만료) 재시도는 인터셉터가 따로 세므로
  // 여기서는 409 전용이다 — 두 재시도가 겹칠 수 있어 카운터를 각각 둔다(노션 6.3).
  const [conflictRetried, setConflictRetried] = useState(false);

  const mutation = useMutation({
    mutationFn: async ({
      edgeId,
      graphVersion,
    }: {
      edgeId: string;
      graphVersion: string;
    }) => {
      try {
        return await deleteEdge(edgeId, graphVersion);
      } catch (error) {
        if (!(error instanceof ApiError) || !isVersionConflict(error.code)) {
          throw error;
        }

        // ── 409 버전 충돌: 재조회 → 대상이 살아 있으면 1회만 재시도 ──
        //
        // 409 응답에 최신 버전이 동봉돼 오지만(error.detail.graphVersion) 그것만
        // 갈아끼우지 않는다. 버전만 바꾸면 화면은 여전히 옛 내용이라, 사용자가
        // 보는 정보가 틀린 채로 요청이 나간다.
        const fresh = await cache.refetch();

        // 재시도는 1회까지. 두 번 연속이면 다른 일이 벌어지고 있다는 뜻이다.
        if (conflictRetried) throw error;

        // ★ 중단 조건 — 재조회 결과에 그 항목이 없으면 밀어붙이지 않는다
        const stillThere = fresh?.edges.some((e) => e.edgeId === edgeId);
        if (!fresh || !stillThere) {
          throw new ApiError(
            {
              code: PROFILE_EDGE_NOT_FOUND,
              message: "이미 삭제되었거나 변경된 항목이에요. 목록을 새로 불러왔어요.",
            },
            404,
          );
        }

        setConflictRetried(true);
        return await deleteEdge(edgeId, fresh.graphVersion);
      }
    },

    // 자동 재시도는 위에서 직접 하므로 React Query 재시도는 끈다.
    // 켜두면 409마다 재조회가 3번 돌고, 중복 담기 방지 원칙(CLAUDE.md)도 깨진다.
    retry: false,

    onSuccess: (data) => {
      // ★ 성공 응답의 graphVersion으로 보관값 갱신 — 빠뜨리면 다음 요청이 409
      cache.setVersion(data.graphVersion);
      // 목록에서 항목을 빼기 위해 재조회한다. 낙관적으로 캐시에서 제거하지 않는
      // 이유: 서버가 연쇄로 노드를 정리할 수 있어(고아 노드) 화면과 어긋난다.
      void cache.refetch();
      setConflictRetried(false);

      // 실행취소 버튼을 두지 않는다 — 되돌리기(M-14)가 폐기됐으므로
      // 버튼이 있으면 되돌릴 수 있다는 거짓 신호가 된다(노션 3.5·7장).
      toast.success("삭제했어요.");
    },

    onError: (error) => {
      setConflictRetried(false);

      // 5xx는 서버가 스스로 터진 것이라 문구가 시스템 언어다 — 화면 말투로 덮는다.
      // 삭제는 되돌릴 수 없는 동작이라 "안 지워졌다"가 분명히 읽혀야 한다.
      if (error instanceof ApiError && isServerFault(error.status)) {
        toast.error("지금은 삭제할 수 없어요. 잠시 후 다시 시도해주세요.");
        return;
      }

      toast.error(
        error instanceof ApiError
          ? error.displayMessage
          : "삭제하지 못했어요. 잠시 후 다시 시도해주세요.",
      );
    },
  });

  return mutation;
}
