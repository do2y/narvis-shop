"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GROUP_DISPLAY_LIMIT,
  GROUP_EXPAND_STEP,
  type PreferenceEdge,
  type PreferenceGroupData,
} from "../types";
import { PreferenceItem } from "./PreferenceItem";

interface PreferenceGroupProps {
  group: PreferenceGroupData;
  /** 다른 그룹이 포커스 모드에 들어갔는가 — 그러면 이 그룹은 축소·흐리게 */
  dimmed: boolean;
  focused: boolean;
  /**
   * 접기를 눌렀을 때 상위의 포커스 상태를 푼다.
   *
   * 그래프의 "전체 보기"로 넘어오면 `focused`가 켜진 채인데, 그 상태에서
   * 접기만 하면 이펙트가 곧바로 다시 펼친다. 접기가 듣게 하려면 근원인
   * 포커스를 함께 꺼야 한다.
   */
  onClearFocus: () => void;
  onEdit: (edge: PreferenceEdge) => void;
  onDelete: (edge: PreferenceEdge) => void;
}

/**
 * 관계 그룹 하나 — 헤더(라벨 + 개수) + 항목들.
 *
 * **기본은 펼쳐진 상태다.** 이 화면의 목적이 "AI가 나에 대해 뭘 아는지 확인하고
 * 고치기"라, 처음부터 접혀 있으면 확인에 클릭이 한 번 더 든다. 그래서 12개까지는
 * 바로 보이고, 그 이상만 사용자가 단계적으로 펼친다.
 *
 * 상한이 필요한 이유는 **서버 상한이 폐지되어 edges가 전량 오기 때문**이다.
 * 제한이 없으면 82개짜리 그룹 하나가 화면을 통째로 삼켜, 그 아래 관계 4개를
 * 보려면 긴 목록을 계속 스크롤해야 한다.
 */
export function PreferenceGroup({
  group,
  dimmed,
  focused,
  onClearFocus,
  onEdit,
  onDelete,
}: PreferenceGroupProps) {
  const total = group.edges.length;
  const isEmpty = total === 0;

  /**
   * 지금 몇 개까지 보여주는가.
   *
   * ⚠️ 한때 `focused ? 전량 : 12개`였다. 두 가지가 문제였다:
   * ① **접을 수 없었다** — 한 번 펼치면 되돌릴 방법이 없어, 실수로 눌렀거나
   *    다 보고 난 뒤에도 그 길이를 안고 스크롤해야 했다
   * ② **한 번에 전부 펼쳤다** — 82개짜리 그룹이 통째로 쏟아지고, 그 아래
   *    관계 4개가 화면 밖으로 밀려나 다른 취향을 보러 가기 어려웠다
   *
   * 그래서 **단계적으로 늘린다**. 한 번 누를 때마다 STEP 만큼만 더 보여주고,
   * 늘어난 상태에서는 접기 버튼이 함께 나온다.
   */
  /*
    포커스(그래프의 "전체 보기"로 넘어온 경우)는 그 관계를 보러 온 것이므로
    한 단계 더 넉넉히 편다. 다만 전량은 아니다 — 200개가 한 번에 펼쳐지면
    여기서도 같은 문제가 생긴다.

    ⚠️ 이펙트로 되돌리지 않는다. `useEffect(() => setShown(...), [focused])` 는
    두 가지가 틀린다:
    ① 연쇄 렌더 — React 컴파일러 규칙 위반(setState in effect)
    ② **접기가 듣지 않는다** — 접기를 눌러 shown 을 줄여도 focused 가 그대로면
       이펙트가 곧바로 다시 펼친다. onClearFocus 로 근원을 끄더라도 한 프레임
       늦어 화면이 깜빡인다.

    대신 **렌더 중에 키를 비교해 조정한다** — props 변화에 state 를 맞추는
    React 공식 패턴이다. focused 가 바뀐 그 렌더에서 곧바로 새 값이 된다.
  */
  const desired = focused
    ? Math.min(total, GROUP_EXPAND_STEP * 2)
    : GROUP_DISPLAY_LIMIT;
  const [state, setState] = useState({ focused, shown: desired });
  if (state.focused !== focused) {
    // 렌더 중 setState — 같은 컴포넌트의 즉시 재렌더라 화면에 잔상이 남지 않는다
    setState({ focused, shown: desired });
  }
  const shown = state.focused === focused ? state.shown : desired;
  const setShown = (next: number | ((n: number) => number)) =>
    setState((s) => ({
      focused,
      shown: typeof next === "function" ? next(s.shown) : next,
    }));

  const visible = group.edges.slice(0, shown);
  const remaining = Math.max(0, total - shown);
  const isExpanded = shown > GROUP_DISPLAY_LIMIT;

  return (
    <section
      className={cn(
        "flex flex-col gap-2.5 transition-all duration-200",
        // 다른 그룹이 확대됐을 때 — 숨기지 않고 물러나게만 한다
        dimmed && "opacity-40",
        // 빈 그룹은 아래쪽에 작게·흐리게. 지우지도 강조하지도 않는다
        isEmpty && "opacity-60",
      )}
    >
      {/* 관계명 + 개수. 개수를 알약으로 감싸 그래프의 관계 노드와 같은 정보를
          같은 모양으로 전한다 — 뷰를 옮겨도 읽는 방식이 바뀌지 않게 */}
      <h3 className="flex items-center gap-2 px-0.5 text-sm font-semibold tracking-tight">
        {group.label}
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums",
            isEmpty
              ? "text-muted-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {total}
        </span>
      </h3>

      {isEmpty ? (
        /*
          avoids·purchased는 당분간 항상 비어 있다 — 이 관계를 만드는 경로가
          아직 없어서다. 사용자가 등록을 안 해서가 아니므로 "죽은 가지"가 아니라
          "아직 안 자란 것"으로 읽혀야 사실과 맞는다(노션 10.4).
          지우면 "회피는 등록할 수 없나?" 싶고, 강조하면 오류처럼 보인다.
        */
        <p className="px-0.5 text-xs text-muted-foreground">아직 없어요</p>
      ) : (
        <>
          {/*
            그룹을 컨테이너 하나로 묶는다.

            이전에는 항목마다 캡슐 테두리를 둘러서, 세로로 반복되는 테두리가
            소음이 됐다(짧은 단어 하나에 테두리 하나). 테두리는 여기서 한 번만
            두르고 항목끼리는 얇은 선으로 나눈다.

            **2열 그리드**: 라벨이 "무선"·"소니"처럼 짧아 한 열로 두면 오른쪽이
            통째로 빈다. 넓은 화면에서 2열이면 같은 스크롤로 두 배를 훑는다.
            좁아지면 1열로 접는다 — 2열에서 라벨이 잘리는 것보다 낫다.

            구분선을 grid gap 대신 border 로 그리는 이유: gap 은 열 사이에도
            선이 필요한데 CSS 로 "행 사이만"을 표현할 수 없다. 각 항목이
            위쪽 테두리를 갖고 첫 행만 제거하는 방식이 열 수가 바뀌어도 맞는다.
          */}
          <ul
            className={cn(
              "grid grid-cols-1 overflow-hidden rounded-sm border border-border/70 lg:grid-cols-2",
              // 항목 사이 구분선 — 위쪽 테두리를 각자 갖고, 첫 행만 지운다.
              // lg에서는 2열이라 첫 두 개가 첫 행이다.
              "[&>li]:border-t [&>li]:border-border/60",
              "[&>li:first-child]:border-t-0",
              "lg:[&>li:nth-child(2)]:border-t-0",
              // 세로 구분선 — 왼쪽 열에만 오른쪽 테두리를 준다
              "lg:[&>li:nth-child(odd)]:border-r lg:[&>li:nth-child(odd)]:border-border/60",
            )}
          >
            {/* 그룹 안 항목 순서는 서버 순서 그대로 — 클라이언트 재정렬 금지 */}
            {visible.map((edge) => (
              <PreferenceItem
                key={edge.edgeId}
                edge={edge}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </ul>

          {/*
            더 보기 / 접기.

            둘을 한 줄에 나란히 둔다 — 펼친 뒤 접으려고 목록 끝까지 내려갔다
            다시 올라오는 일이 없게, 조작 지점을 한곳에 모은다.
          */}
          {remaining > 0 || isExpanded ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {remaining > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    setShown((n) => Math.min(total, n + GROUP_EXPAND_STEP))
                  }
                  className={cn(
                    "inline-flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-medium",
                    "text-muted-foreground transition-colors duration-150 ease-out-strong",
                    "hover:[@media(hover:hover)]:bg-muted hover:[@media(hover:hover)]:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45",
                  )}
                >
                  <ChevronDown className="size-3.5" />
                  {/* 남은 수를 그대로 적지 않는다 — 이 버튼은 remaining 개가
                      아니라 STEP 개만 더 보여준다. 실제로 일어날 일을 적는다 */}
                  {Math.min(remaining, GROUP_EXPAND_STEP)}개 더 보기
                  <span className="tabular-nums opacity-60">
                    ({shown}/{total})
                  </span>
                </button>
              ) : null}

              {isExpanded ? (
                <button
                  type="button"
                  onClick={() => {
                    setShown(GROUP_DISPLAY_LIMIT);
                    // 그래프에서 이 관계를 확대해 넘어온 상태라면 그것도 푼다 —
                    // 안 그러면 focused 가 true 로 남아 이펙트가 다시 펼친다
                    if (focused) onClearFocus();
                  }}
                  className={cn(
                    "inline-flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-medium",
                    "text-muted-foreground transition-colors duration-150 ease-out-strong",
                    "hover:[@media(hover:hover)]:bg-muted hover:[@media(hover:hover)]:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45",
                  )}
                >
                  <ChevronUp className="size-3.5" />
                  접기
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

/**
 * 포커스 모드 상태 — 그래프의 "전체 보기"로 넘어온 그룹을 강조하고
 * 나머지는 흐리게 둔다.
 *
 * ESC와 바깥 클릭으로 전체 보기에 복귀한다. 훅으로 분리한 이유는 키 핸들러
 * 등록이 트리 쪽 관심사가 아니어서다.
 */
export function useGroupFocus(requested: string | null = null) {
  /*
    그래프의 "전체 보기"가 어느 그룹을 펼지 지정한다.

    ⚠️ `useState(requested)` 로 두면 **마운트 때 한 번만** 읽는다. 목록은 그래프와
    같은 화면에 늘 떠 있어 언마운트되지 않으므로, 그래프에서 버튼을 눌러
    requested 가 바뀌어도 목록은 꿈쩍하지 않는다(실측: "선호 전체 보기"를 눌러도
    12/82 그대로였다).

    그래서 렌더 중에 값을 비교해 따라간다. 이후 사용자가 ESC·바깥 클릭으로 끄면
    그건 목록 자신의 상태로 남는다(같은 요청이 다시 오기 전까지).
  */
  const [state, setState] = useState({ requested, focused: requested });
  if (state.requested !== requested) {
    setState({ requested, focused: requested });
  }
  const focused = state.requested === requested ? state.focused : requested;
  const setFocused = (next: string | null) =>
    setState((s) => ({ requested: s.requested, focused: next }));

  useEffect(() => {
    if (!focused) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocused(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focused]);

  return { focused, setFocused };
}
