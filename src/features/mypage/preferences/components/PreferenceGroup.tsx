"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  GROUP_DISPLAY_LIMIT,
  type PreferenceEdge,
  type PreferenceGroupData,
} from "../types";
import { PreferenceItem } from "./PreferenceItem";

interface PreferenceGroupProps {
  group: PreferenceGroupData;
  /** 다른 그룹이 포커스 모드에 들어갔는가 — 그러면 이 그룹은 축소·흐리게 */
  dimmed: boolean;
  focused: boolean;
  onFocus: () => void;
  onEdit: (edge: PreferenceEdge) => void;
  onDelete: (edge: PreferenceEdge) => void;
}

/**
 * 관계 그룹 하나 — 헤더(라벨 + 개수) + 항목들.
 *
 * **접기/펼치기가 없다.** 이 화면의 목적이 "AI가 나에 대해 뭘 아는지 확인하고
 * 고치기"인데 접혀 있으면 확인에 클릭이 한 번 더 든다. 보통 10~30개라
 * 대부분은 상한에 걸리지 않고 전부 보인다.
 *
 * 대신 그룹당 표시 상한이 있다 — **서버 상한이 폐지되어 edges가 전량 오므로**
 * 제한이 없으면 한 그룹이 화면을 통째로 삼킨다. 상한은 접기가 아니라
 * 잘라내는 것이고, 넘친 만큼은 `+N개 더`로 그 그룹만 펼친다.
 */
export function PreferenceGroup({
  group,
  dimmed,
  focused,
  onFocus,
  onEdit,
  onDelete,
}: PreferenceGroupProps) {
  const total = group.edges.length;
  const isEmpty = total === 0;
  const overflow = Math.max(0, total - GROUP_DISPLAY_LIMIT);

  // 포커스 모드에서는 전부, 아니면 12개까지
  const visible = focused ? group.edges : group.edges.slice(0, GROUP_DISPLAY_LIMIT);

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

          {overflow > 0 && !focused ? (
            <button
              type="button"
              onClick={onFocus}
              className={cn(
                "h-9 self-start rounded-full px-3 text-[13px] font-medium",
                "text-muted-foreground transition-colors duration-150 ease-out-strong",
                "hover:[@media(hover:hover)]:bg-muted hover:[@media(hover:hover)]:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45",
              )}
            >
              {overflow}개 더 보기
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}

/**
 * 포커스 모드 상태 — `+N개 더`로 한 그룹만 확대하고 나머지는 축소·흐리게.
 *
 * ESC와 바깥 클릭으로 전체 보기에 복귀한다. 훅으로 분리한 이유는 키 핸들러
 * 등록이 트리 쪽 관심사가 아니어서다.
 */
export function useGroupFocus(initial: string | null = null) {
  // 그래프의 "N개 모두 보기"가 목록으로 넘어오면서 어느 그룹을 펼지 지정한다.
  // 초기값으로만 받는다 — 이후 접고 펴는 것은 목록 자신의 상태다.
  const [focused, setFocused] = useState<string | null>(initial);

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
