"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/lib/utils";
import {
  EDITABLE_PREDICATES,
  PREDICATE_LABEL,
  type EditEdgeObject,
  type EditEdgeRequest,
  type PreferenceEdge,
  type PreferenceObject,
  type PreferencePredicate,
} from "../types";

interface EditEdgeDialogProps {
  edge: PreferenceEdge;
  /**
   * 자동완성 후보 — 화면에 있는 모든 대상.
   *
   * 확정 계약에는 nodes[] 배열이 없고 대상이 edge마다 인라인되므로,
   * 호출부가 edges에서 object를 모아 중복을 제거해 넘긴다.
   */
  candidates: PreferenceObject[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (body: EditEdgeRequest) => void;
}

/**
 * 취향 수정 창.
 *
 * **확인 다이얼로그를 두지 않는다**(노션 3.4) — [저장]을 누르는 것 자체가 확인
 * 단계이고, 잘못 고쳐도 결과가 화면에 보여 바로 다시 고칠 수 있다.
 *
 * 노션은 "항목 옆 팝오버 / 모바일은 바텀시트"를 제안하지만 모달로 간다.
 * shared/ui에 popover·sheet 부품이 없고, 노션도 "어려우면 모달로 가세요"를
 * 허용한다. 모달이 오히려 "수정 중인 항목을 가리지 않게" 요구를 자동으로
 * 만족한다(중앙 정렬 + 대상 이름을 창 안에 다시 적음).
 *
 * 자동완성 후보는 화면에 있는 대상들이다 — 대상 검색 API가 계약에 없다.
 * 고른 경우 nodeId를, 새로 입력한 경우에만 type+label을 보낸다.
 */
export function EditEdgeDialog({
  edge,
  candidates,
  isPending,
  onClose,
  onSubmit,
}: EditEdgeDialogProps) {
  const currentObject = edge.object;

  const [predicate, setPredicate] = useState<PreferencePredicate>(edge.predicate);
  const [query, setQuery] = useState(currentObject.label);
  // 자동완성에서 고른 대상. null이면 사용자가 직접 입력한 것으로 본다.
  const [picked, setPicked] = useState<PreferenceObject | null>(currentObject);

  const trimmed = query.trim();

  // 입력과 겹치는 후보. 이미 고른 것과 라벨이 같으면 목록을 띄우지 않는다
  // (고른 직후에 목록이 남아 있으면 눌러야 할 것이 남은 것처럼 보인다).
  const suggestions = useMemo(() => {
    if (trimmed.length === 0) return [];
    if (picked && picked.label === trimmed) return [];
    const lower = trimmed.toLowerCase();
    return candidates
      .filter((n) => n.label.toLowerCase().includes(lower))
      .slice(0, 6);
  }, [candidates, picked, trimmed]);

  const predicateChanged = predicate !== edge.predicate;
  // 대상이 바뀌었나 — 고른 대상이 다르거나, 직접 입력한 문자열이 원래와 다르거나
  const objectChanged = picked
    ? picked.nodeId !== currentObject.nodeId
    : trimmed.length > 0 && trimmed !== currentObject.label;

  // 둘 중 최소 하나는 바뀌어야 한다. 아무것도 안 바꾸고 [저장]을 누르면
  // 그대로 보내지 말고 창만 닫는다 — 서버는 400을 낸다(노션 3.4).
  const hasChange = predicateChanged || objectChanged;

  // [저장]을 hasChange 로 잠그지 않는다. 잠그면 "아무것도 안 바꾸고 저장을
  // 누르면 창만 닫는다"는 규약이 실행될 수 없고(버튼이 죽어 있어서), 사용자는
  // 왜 저장이 안 되는지 모른 채 취소를 찾아야 한다. 대상이 비었을 때만 막는다
  // — 그건 보낼 값 자체가 없는 경우다.
  const canSave = trimmed.length > 0 && !isPending;

  const submit = () => {
    if (!hasChange) {
      onClose();
      return;
    }
    if (trimmed.length === 0) return;

    const body: EditEdgeRequest = {};
    if (predicateChanged) body.predicate = predicate;

    if (objectChanged) {
      /*
        자동완성으로 골랐으면 nodeId를 쓴다(권장).

        type+label로 보내면 서버가 라벨을 다시 정규화하면서 사용자가 고른 것과
        다른 대상으로 튈 수 있다. 둘을 함께 실으면 400이다.

        직접 입력한 경우에만 type+label을 쓰는데, type은 원래 대상의 것을
        물려받는다 — 사용자에게 "이건 브랜드인가 속성인가"를 묻는 UI는 계약에
        근거가 없고, 대개 같은 축에서 이름만 바꾸려는 것이다.
      */
      const object: EditEdgeObject =
        picked && picked.label === trimmed
          ? { nodeId: picked.nodeId }
          : { type: currentObject.type, label: trimmed };
      body.object = object;
    }

    onSubmit(body);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="pr-8 text-base">취향 수정</DialogTitle>

        <div className="mt-5 flex flex-col gap-5">
          {/* 관계 — "구매"는 선택지에서 뺀다. 서버가 400으로 거절한다
              (구매는 의견이 아니라 사실이라 사용자가 만들 수 없다). */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">관계</span>
            <div className="flex flex-wrap gap-2">
              {EDITABLE_PREDICATES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPredicate(p)}
                  aria-pressed={predicate === p}
                  className={cn(
                    "h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                    predicate === p
                      ? "border-foreground bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {PREDICATE_LABEL[p]}
                </button>
              ))}
            </div>
          </div>

          {/* 대상 — 자동완성 목록에서 선택 또는 직접 입력 */}
          <div className="flex flex-col gap-2">
            <label htmlFor="edit-edge-object" className="text-sm font-medium">
              대상
            </label>
            <Input
              id="edit-edge-object"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                // 직접 타이핑하면 "고른 것"이 아니게 된다 — nodeId 대신
                // type+label로 나가야 하므로 선택을 해제한다.
                setPicked(null);
              }}
              placeholder="예: 노이즈캔슬링"
              className="h-11 rounded-sm"
              autoComplete="off"
            />

            {suggestions.length > 0 ? (
              <ul className="flex flex-col gap-1 rounded-sm border border-border p-1">
                {suggestions.map((node) => (
                  <li key={node.nodeId}>
                    <button
                      type="button"
                      onClick={() => {
                        setPicked(node);
                        setQuery(node.label);
                      }}
                      className="flex h-11 w-full items-center rounded-sm px-3 text-left text-sm transition-colors hover:bg-muted"
                    >
                      {node.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full px-5"
            onClick={onClose}
            disabled={isPending}
          >
            취소
          </Button>
          {/* 저장 중에는 비활성 — 연타로 두 번 보내지 않게 한다 */}
          <Button
            type="button"
            className="h-11 rounded-full px-5"
            onClick={submit}
            disabled={!canSave}
          >
            {isPending ? "저장 중…" : "저장"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
