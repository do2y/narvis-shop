"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/lib/utils";
import {
  EDITABLE_PREDICATES,
  PREDICATE_HINT,
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
      {/* p-6 → p-5, 그림자를 한 단계 낮춰 내용에 비해 커 보이던 인상을 줄인다 */}
      <DialogContent className="max-w-[26rem] gap-0 p-5 shadow-md sm:p-6">
        <DialogTitle className="pr-8 text-base tracking-tight">
          취향 수정하기
        </DialogTitle>
        {/*
          무엇을 고치는 중인지 창 안에 다시 적는다 — 모달이 항목을 가리므로
          이게 없으면 "지금 어느 걸 고치는 거지?"를 확인할 방법이 없다.
        */}
        <p className="mt-1.5 pr-8 text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">
            ‘{currentObject.label}’
          </span>
          에 대한 현재 취향을 알려주세요.
        </p>

        <div className="mt-5 flex flex-col gap-5">
          {/*
            라벨을 "관계"라고 쓰지 않는다 — predicate 를 그대로 옮긴 개발자
            언어다. 사용자가 하려는 일은 "지금 어떻게 느끼는지"를 고르는
            것이므로 그 말로 묻는다. ("구매"는 선택지에서 뺀다 — 의견이 아니라
            사실이라 사용자가 만들 수 없고, 보내면 서버가 400을 낸다.)

            radiogroup 으로 두는 이유: 하나만 고를 수 있는 선택지라
            스크린리더가 "4개 중 2번째"처럼 읽어주고, 방향키로 이동한다.
            aria-pressed 버튼 4개는 각각 독립 토글로 읽혀 관계가 드러나지 않는다.
          */}
          <fieldset className="flex flex-col gap-2.5">
            <legend className="text-sm font-medium">
              지금은 어떤 관계인가요?
            </legend>
            {/*
              라벨은 계약 어휘(PREDICATE_LABEL) 그대로 쓴다 — 그래프·목록의
              그룹 헤더와 같은 말이어야 "선호 그룹에 있던 걸 관심으로 옮겼다"가
              읽힌다. 다만 "선호"와 "좋아함"은 이름만으로 구분되지 않아
              뜻을 아래에 함께 적는다.
            */}
            <div role="radiogroup" className="grid grid-cols-2 gap-2">
              {EDITABLE_PREDICATES.map((p) => {
                const selected = predicate === p;
                return (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPredicate(p)}
                    className={cn(
                      "flex min-h-[3.25rem] flex-col items-start justify-center gap-0.5 rounded-sm border px-3 py-2 text-left",
                      "transition-[background-color,border-color,color] duration-150",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      "active:scale-[0.98] motion-reduce:active:scale-100",
                      selected
                        ? // 마이페이지의 선택·활성 상태는 전부 primary(검정)다 —
                          // 네비·기본 배송지 배지·개인화 스위치·뷰 토글이 같다.
                          // brand(틸그린)는 랜딩·챗봇 전용이라 여기서 쓰면
                          // 같은 화면의 뷰 토글과 어긋난다.
                          // 배경·테두리·체크를 함께 줘 색만으로 전달하지 않는다.
                          "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-foreground/25 hover:bg-muted",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {selected ? (
                        <Check
                          className="size-3.5 shrink-0"
                          strokeWidth={2.5}
                        />
                      ) : null}
                      {PREDICATE_LABEL[p]}
                    </span>
                    <span
                      className={cn(
                        "text-xs leading-tight",
                        selected
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground",
                      )}
                    >
                      {PREDICATE_HINT[p]}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* 자동완성 목록에서 선택 또는 직접 입력 */}
          <div className="flex flex-col gap-2.5">
            <label htmlFor="edit-edge-object" className="text-sm font-medium">
              어떤 취향을 수정할까요?
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
              className="h-10 rounded-sm"
              autoComplete="off"
            />

            {suggestions.length > 0 ? (
              <ul className="flex max-h-44 flex-col gap-0.5 overflow-y-auto rounded-sm border border-border p-1">
                {suggestions.map((node) => (
                  <li key={node.nodeId}>
                    <button
                      type="button"
                      onClick={() => {
                        setPicked(node);
                        setQuery(node.label);
                      }}
                      className="flex h-9 w-full items-center rounded-sm px-2.5 text-left text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    >
                      {node.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        {/* 모바일은 세로로 쌓아 전체 너비 — 좁은 화면에서 두 버튼이 나란히
            있으면 각각이 좁아져 누르기 어렵다. 주 버튼이 위로 온다 */}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2.5">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-full px-5 transition-transform active:scale-[0.98] motion-reduce:active:scale-100"
            onClick={onClose}
            disabled={isPending}
          >
            취소
          </Button>
          {/* 저장 중에는 비활성 — 연타로 두 번 보내지 않게 한다 */}
          <Button
            type="button"
            className="h-10 rounded-full px-5 transition-transform active:scale-[0.98] motion-reduce:active:scale-100"
            onClick={submit}
            disabled={!canSave}
          >
            {isPending ? "저장 중…" : "취향 저장하기"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
