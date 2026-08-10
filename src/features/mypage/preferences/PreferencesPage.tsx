"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/shared/ui/skeleton";
import { ErrorState, PageTitle } from "../components/PageState";
import { DeleteEdgeDialog } from "./components/DeleteEdgeDialog";
import { EditEdgeDialog } from "./components/EditEdgeDialog";
import {
  PersonalizationControls,
  PersonalizationOffBanner,
} from "./components/PersonalizationControls";
import { PreferenceGraph } from "./components/PreferenceGraph";
import { PreferenceTree } from "./components/PreferenceTree";
import { ResetGraphDialog } from "./components/ResetGraphDialog";
import { SummaryMarkdown } from "./components/SummaryMarkdown";
import {
  useIsNarrow,
  ViewToggle,
  type PreferenceView,
} from "./components/ViewToggle";
import type { PreferenceEdge, PreferencePredicate } from "./types";
import { useDeleteEdge } from "./useDeleteEdge";
import { useEditEdge } from "./useEditEdge";
import { usePersonalization } from "./usePersonalization";
import { useResetGraph } from "./useResetGraph";
import { useGraphVersion, useProfileGraph } from "./useProfileGraph";

/**
 * 로딩 — 스켈레톤. 스피너 단독을 쓰지 않는다(CLAUDE.md).
 *
 * 요약 문단 + 컨트롤 + 관계 그룹 5개의 자리를 미리 잡아, 데이터가 도착했을 때
 * 레이아웃이 튀지 않게 한다. 그룹을 5개 그리는 것은 실제로 항상 5개가 오기
 * 때문이다(빈 관계도 자리를 지킨다).
 */
function PreferencesSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      {/* 요약 패널 자리 */}
      <div className="flex flex-col gap-3 rounded-sm border border-border/70 bg-muted/20 p-5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-3.5 w-4/5 max-w-sm" />
        <Skeleton className="h-3.5 w-2/3 max-w-xs" />
      </div>

      {/* 그래프 패널 자리 — 실제 높이와 맞춰 도착 시 레이아웃이 튀지 않게 한다 */}
      <div className="rounded-sm border border-border/70">
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-3.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-44 rounded-full" />
        </div>
        <div className="flex min-h-[420px] items-center justify-center">
          <Skeleton className="size-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * 빈 상태 — `exists: false`(신규 회원) 또는 `edges: []`.
 *
 * ⚠️ 오류가 아니다. HTTP 200이고 신규 회원의 정상 상태다.
 *
 * 공용 EmptyState를 쓰지 않는 이유: 그쪽은 Link 액션 버튼이 필수인데,
 * 여기서는 **개인화 스위치와 [전체 초기화]가 빈 상태에서도 보여야 한다**
 * (노션 2장). 그 컨트롤은 이 컴포넌트 바깥에서 그려지므로 여기서는
 * 안내 문구만 담당한다.
 */
function EmptyPreferences() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-sm bg-muted/30 px-6 py-20 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Sparkles className="size-7" strokeWidth={1.5} />
      </span>
      <p className="mt-1 text-base font-semibold tracking-tight">
        아직 파악한 취향이 없어요
      </p>
      <p className="max-w-xs text-sm text-muted-foreground">
        채팅으로 쇼핑을 시작하면 여기에 쌓여요.
      </p>
    </div>
  );
}

export default function PreferencesPage() {
  const { data, isPending, isError, refetch } = useProfileGraph();
  const graphVersion = useGraphVersion();
  const deleteMutation = useDeleteEdge();
  const editMutation = useEditEdge();
  const personalizationMutation = usePersonalization();
  const resetMutation = useResetGraph();

  // 삭제 확인 대상. edge 자체를 들고 있는 이유: 확인창에 항목 이름을 넣어야
  // 하고(오터치 확인), 구매 기록인지에 따라 안내 문구가 달라진다.
  const [deleting, setDeleting] = useState<PreferenceEdge | null>(null);
  const [editing, setEditing] = useState<PreferenceEdge | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  // 좁은 화면에서는 방사형이 성립하지 않아(라벨 겹침) 목록으로 고정한다.
  const isNarrow = useIsNarrow();
  const [preferredView, setPreferredView] = useState<PreferenceView>("graph");
  const view: PreferenceView = isNarrow ? "list" : preferredView;

  // 그래프에서 한 관계만 확대하는 포커스 모드. 목록 뷰는 자체 포커스를 쓴다.
  const [focused, setFocused] = useState<PreferencePredicate | null>(null);

  /**
   * 그래프의 "N개 모두 보기"로 목록에 넘어올 때 펼쳐 둘 관계.
   *
   * 방사형은 한 가지에 8개가 한계라(GRAPH_ITEMS_FOCUSED) 그보다 많은 그룹은
   * 확대해도 전부 못 보여준다. 그래서 그 버튼은 **목록 뷰로 보내고**, 어느
   * 그룹을 펼지 이 값으로 전달한다 — 목록만 바뀌고 그룹이 접혀 있으면
   * 방금 누른 동작이 무시된 것처럼 보인다.
   *
   * 뷰를 되돌릴 때 비운다. 남겨 두면 나중에 사용자가 직접 목록으로 갔을 때
   * 영문 모를 그룹이 펼쳐져 있다.
   */
  const [showAllOf, setShowAllOf] = useState<PreferencePredicate | null>(null);

  const showAllInList = (predicate: PreferencePredicate) => {
    setFocused(null); // 그래프 확대는 풀고 목록으로 넘긴다
    setShowAllOf(predicate);
    setPreferredView("list");
  };

  // ESC로 포커스 모드 해제 — 바깥 클릭은 SVG가 직접 받는다.
  useEffect(() => {
    if (!focused) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocused(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focused]);

  // exists: false 와 edges: [] 를 같은 화면으로 묶는다 — 사용자에겐
  // "아직 아무것도 없다"는 한 가지 사실이고, 둘을 가르면 문구만 늘어난다.
  const isEmpty = !!data && (!data.exists || data.edges.length === 0);

  // 확인창에 항목 이름을 넣는다 — 아이콘이 작아 오터치 가능성이 있는데
  // "이 취향을 삭제할까요?"만 뜨면 어느 것을 눌렀는지 확인할 방법이 없다.
  // 대상이 edge 안에 인라인돼 있어 룩업 없이 바로 읽는다.
  const deletingLabel = deleting?.object.label ?? "";

  // 수정 창의 자동완성 후보 — 대상 검색 API가 계약에 없어 화면에 있는 대상을 쓴다.
  // 확정 계약에는 nodes[] 배열이 없고 대상이 edge마다 인라인되므로, 같은 대상이
  // 여러 관계에 걸쳐 있으면 중복이 생긴다. nodeId로 한 벌만 남긴다.
  const candidates = useMemo(() => {
    const byNodeId = new Map(
      (data?.edges ?? []).map((e) => [e.object.nodeId, e.object]),
    );
    return [...byNodeId.values()];
  }, [data?.edges]);

  return (
    <div>
      {/*
        헤더 — 제목·설명(좌)과 개인화 설정(우)을 한 줄에 묶는다.
        설정이 콘텐츠 위에 따로 떠 있으면 무엇에 대한 설정인지 읽히지 않는다.
      */}
      <header className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="min-w-0">
          <PageTitle>AI가 이해한 내 취향</PageTitle>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            대화와 구매 내역에서 파악한 내용이에요. 틀린 게 있으면 바로 고칠 수
            있어요.
          </p>
        </div>

        {/* 빈 상태에서도 그대로 보인다 — 개인화 설정은 취향 유무와 무관하고,
            초기화는 대화 기록도 지우므로 취향이 없어도 지울 것이 남아 있다 */}
        {data ? (
          <PersonalizationControls
            enabled={data.personalization.enabled}
            isToggling={personalizationMutation.isPending}
            isResetting={resetMutation.isPending}
            onToggle={(next) => personalizationMutation.mutate(next)}
            onResetClick={() => setResetOpen(true)}
          />
        ) : null}
      </header>

      <div className="mt-5">
        {isPending ? (
          <PreferencesSkeleton />
        ) : isError ? (
          <ErrorState
            message="취향 정보를 불러오지 못했어요."
            onRetry={() => refetch()}
          />
        ) : (
          <div className="flex flex-col gap-5">
            {/*
              개인화가 꺼져 있어도 이 아래 전부가 보이고 편집도 된다.
              "개인화를 켜야 편집할 수 있습니다" 화면을 만들지 않는 이유:
              보존된 데이터를 정리하려고 개인화를 다시 켜야 하는 모순이
              생긴다. 그래서 아래 어디에도 enabled 로 잠그는 분기가 없다.
            */}
            {data.personalization.enabled ? null : <PersonalizationOffBanner />}

            {/* 요약 패널 — markdown 이 null 이면(신규 회원) 자리를 비운다.
                빈 상태 안내가 아래에서 같은 말을 하므로 두 번 적지 않는다. */}
            {data.markdown ? (
              <section className="rounded-sm border border-border/70 bg-muted/20 px-5 py-4">
                <SummaryMarkdown markdown={data.markdown} />
              </section>
            ) : null}

            {isEmpty ? (
              <EmptyPreferences />
            ) : (
              <section
                // 개인화 OFF에서는 채도를 낮춘다 — **숨기지 않는다**.
                // 편집은 그대로 동작하므로 pointer-events 를 막지 않는다.
                className={cn(
                  "overflow-hidden rounded-sm border border-border/70 transition-opacity",
                  data.personalization.enabled ? undefined : "opacity-70",
                )}
              >
                {/* 툴바 — 패널 제목과 뷰 전환을 한 줄에. 전환 버튼이 빈 공간에
                    따로 떠 있으면 무엇을 전환하는 것인지 읽히지 않는다 */}
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border/70 bg-muted/20 px-5 py-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold tracking-tight">
                      취향 관계도
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {view === "graph"
                        ? "항목을 누르면 고칠 수 있어요."
                        : "항목마다 고치거나 지울 수 있어요."}
                    </p>
                  </div>

                  {/* 좁은 화면은 목록 고정이라 전환 버튼을 숨긴다 — 누를 수 없는
                      버튼을 보여주면 왜 안 되는지 설명할 길이 없다 */}
                  {isNarrow ? null : (
                    <ViewToggle
                      view={view}
                      onChange={(next) => {
                        setPreferredView(next);
                        // 뷰를 옮기면 그래프의 확대 상태는 의미가 없어진다
                        setFocused(null);
                        // 사용자가 직접 옮긴 것이므로 "모두 보기"로 펼쳐 둘
                        // 그룹도 지운다 — 안 지우면 나중에 목록으로 갔을 때
                        // 영문 모를 그룹이 펼쳐져 있다
                        setShowAllOf(null);
                      }}
                    />
                  )}
                </div>

                {view === "graph" ? (
                  <div className="relative">
                    <div className="px-1 pb-2 pt-1">
                      <PreferenceGraph
                        edges={data.edges}
                        focused={focused}
                        onFocus={setFocused}
                        onShowAll={showAllInList}
                        // 그래프에서는 아이콘을 놓을 자리가 없어 항목을 누르면
                        // 바로 수정 창을 연다. 삭제는 목록 뷰에서 하도록 두
                        // 경로를 나눈다 — 파괴적인 동작을 좁은 타겟에 붙이면
                        // 오터치가 늘어난다.
                        onSelect={(edge) => edge.editable && setEditing(edge)}
                      />
                    </div>

                    {focused ? (
                      // 키보드 사용자에게도 빠져나갈 길을 알린다
                      <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-muted-foreground">
                        다른 곳을 누르거나 ESC를 눌러 전체 보기로 돌아가요.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="p-5">
                    <PreferenceTree
                      graph={data}
                      initialFocus={showAllOf}
                      onEdit={setEditing}
                      onDelete={setDeleting}
                    />
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>

      {/*
        삭제 확인창. deleting 이 있을 때만 마운트해 라벨·문구가 항상 대상과
        일치하게 한다(닫히는 애니메이션 중 라벨이 비는 것을 감수한다 —
        잘못된 이름이 잠깐 보이는 것보다 낫다).
      */}
      {/*
        전체 초기화 확인창. 개인화가 꺼져 있어도 초기화는 가능해야 하므로
        enabled 로 잠그지 않는다(노션 3.6 — 버튼 비활성화 금지).
      */}
      {data ? (
        <ResetGraphDialog
          open={resetOpen}
          onOpenChange={setResetOpen}
          edgeCount={data.edges.length}
          isPending={resetMutation.isPending}
          onConfirm={() => {
            if (!graphVersion) return;
            resetMutation.mutate(graphVersion, {
              onSettled: () => setResetOpen(false),
            });
          }}
        />
      ) : null}

      {editing && data ? (
        <EditEdgeDialog
          edge={editing}
          candidates={candidates}
          isPending={editMutation.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(body) => {
            if (!graphVersion) return;
            editMutation.mutate(
              { edgeId: editing.edgeId, body, graphVersion },
              // 성공·실패 모두 창을 닫는다. 409면 화면이 최신으로 갱신되므로
              // 사용자가 새 내용을 보고 다시 고치는 것이 정상 경로다.
              { onSettled: () => setEditing(null) },
            );
          }}
        />
      ) : null}

      {deleting ? (
        <DeleteEdgeDialog
          open
          onOpenChange={(open) => {
            if (!open) setDeleting(null);
          }}
          label={deletingLabel}
          isPurchaseRecord={!deleting.editable}
          isPending={deleteMutation.isPending}
          onConfirm={() => {
            // graphVersion 이 없으면(첫 조회 전) If-Match 를 만들 수 없다.
            // 트리가 보이는 시점엔 항상 있지만, 타입상 null 가능성을 좁힌다.
            if (!graphVersion) return;
            deleteMutation.mutate(
              { edgeId: deleting.edgeId, graphVersion },
              // 성공·실패 모두 창을 닫는다. 실패 문구는 토스트가 전하고,
              // 열어두면 사용자가 같은 버튼을 다시 눌러 중복 요청이 나간다.
              { onSettled: () => setDeleting(null) },
            );
          }}
        />
      ) : null}
    </div>
  );
}
