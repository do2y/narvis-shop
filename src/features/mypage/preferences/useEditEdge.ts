"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/shared/api/client";
import { editEdge } from "./api";
import { useGraphCacheWriter } from "./useProfileGraph";
import {
  isNotEditableConflict,
  isServerFault,
  isVersionConflict,
  type EditEdgeRequest,
} from "./types";

/**
 * 취향 항목 수정 (M-12).
 *
 * 삭제와 달리 **409에서 자동 재시도하지 않는다**(노션 6.2). 수정은 "이 값으로
 * 바꿔줘"인데 병합 여부에 따라 결과가 달라지므로, 그 사이 상태가 변했다면
 * 사용자가 최신 화면을 보고 다시 판단해야 한다. 자동 재시도 금지는 FE가 알아서
 * 보내지 말라는 뜻이고, 사용자가 다시 [저장]을 누르는 건 정상 경로다.
 *
 * 409가 두 종류인데 대응이 정반대다 — 상태 코드로만 분기하면 틀린다:
 * - PROFILE_VERSION_CONFLICT  → 재조회하면 풀린다
 * - PROFILE_EDGE_NOT_EDITABLE → 구매 기록이라 몇 번을 해도 안 된다
 */
export function useEditEdge() {
  const cache = useGraphCacheWriter();

  return useMutation({
    mutationFn: (args: {
      edgeId: string;
      body: EditEdgeRequest;
      graphVersion: string;
    }) => editEdge(args.edgeId, args.body, args.graphVersion),

    // 중복 수정을 막는다(CLAUDE.md: 자동 재시도 금지). 409 처리는 onError에서
    // 재조회만 하고, 다시 보내는 것은 사용자에게 맡긴다.
    retry: false,

    onSuccess: (data) => {
      // ★ 보관값 갱신 — 빠뜨리면 다음 요청이 전부 409
      cache.setVersion(data.graphVersion);

      if (data.merged) {
        // 고친 내용이 이미 있던 다른 항목과 합쳐졌다. 목록에서 항목 하나가
        // 사라진 것처럼 보이므로 재조회가 필요하다(노션 3.4).
        void cache.refetch();
        toast.success("이미 있던 취향과 합쳐졌어요.");
        return;
      }

      /*
        ★★ edgeId 교체 — 이 계약에서 가장 놓치기 쉬운 지점.

        항목 ID는 (관계, 대상)에서 만들어져서 관계나 대상을 바꾸면 ID도 바뀐다.
        캐시의 옛 edgeId를 그대로 두면 화면은 멀쩡한데 **다음 수정·삭제가 404**다.

        여기서는 캐시를 직접 수정하지 않고 M-11 재조회로 통째로 갈아끼운다.
        서버가 라벨을 정규화하고 노드를 새로 만들 수 있어(응답의 edge.to가
        가리키는 노드가 캐시의 nodes에 없을 수 있다), 부분 갱신하면 라벨이
        "알 수 없는 항목"으로 뜬다. 재조회가 느리지만 정확하다.
      */
      void cache.refetch();

      toast.success("수정했어요. 회원님이 설정한 내용은 AI가 다시 바꾸지 않아요.");
    },

    onError: (error) => {
      if (error instanceof ApiError) {
        // 구매 기록 — 재시도해도 안 된다. 재조회도 의미가 없다
        if (isNotEditableConflict(error.code)) {
          toast.error("구매 기록에서 만들어진 항목은 수정할 수 없어요.");
          return;
        }

        // 버전 충돌 — 화면을 최신으로 되돌리고, 다시 저장할지는 사용자가 정한다.
        // 버전만 갈아끼우지 않는 이유: 화면이 옛 내용이면 사용자가 보는 정보가
        // 틀린 채로 다음 요청이 나간다.
        if (isVersionConflict(error.code)) {
          void cache.refetch();
          toast.error("그 사이 취향이 업데이트됐어요. 최신 내용으로 새로고침했어요.");
          return;
        }

        // 404 — 이미 삭제되었거나 변경된 항목
        if (error.status === 404) {
          void cache.refetch();
          toast.error("이미 삭제되었거나 변경된 항목이에요. 목록을 새로 불러왔어요.");
          return;
        }

        // 5xx — 서버 문구를 그대로 흘리지 않는다. 재조회도 하지 않는다:
        // 사용자가 보낸 값에는 문제가 없어 화면을 되돌릴 이유가 없고,
        // 서버가 앓는 중에 요청을 하나 더 얹을 뿐이다.
        if (isServerFault(error.status)) {
          toast.error("지금은 수정할 수 없어요. 잠시 후 다시 시도해주세요.");
          return;
        }

        toast.error(error.displayMessage);
        return;
      }

      toast.error("수정하지 못했어요. 잠시 후 다시 시도해주세요.");
    },
  });
}
