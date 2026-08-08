"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Skeleton } from "@/shared/ui/skeleton";
import { ErrorState, PageTitle } from "../components/PageState";
import { DeleteEdgeDialog } from "./components/DeleteEdgeDialog";
import { EditEdgeDialog } from "./components/EditEdgeDialog";
import {
  PersonalizationControls,
  PersonalizationOffBanner,
} from "./components/PersonalizationControls";
import { PreferenceTree } from "./components/PreferenceTree";
import { ResetGraphDialog } from "./components/ResetGraphDialog";
import { SummaryMarkdown } from "./components/SummaryMarkdown";
import { indexNodes, type PreferenceEdge } from "./types";
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
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-full max-w-sm" />
          <Skeleton className="h-4 w-4/5 max-w-xs" />
          <Skeleton className="h-4 w-2/3 max-w-[16rem]" />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Skeleton className="h-11 w-28 rounded-full" />
          <Skeleton className="h-11 w-28 rounded-full" />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="h-4 w-20" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-9 w-28 rounded-full" />
              <Skeleton className="h-9 w-36 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
            </div>
          </div>
        ))}
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

  // exists: false 와 edges: [] 를 같은 화면으로 묶는다 — 사용자에겐
  // "아직 아무것도 없다"는 한 가지 사실이고, 둘을 가르면 문구만 늘어난다.
  const isEmpty = !!data && (!data.exists || data.edges.length === 0);

  // 확인창 라벨·수정 창 초기값용. nodeId를 그대로 보여주지 않으므로
  // label을 찾아야 한다.
  const nodeIndex = indexNodes(data?.nodes ?? []);
  const deletingLabel = deleting
    ? (nodeIndex.get(deleting.to)?.label ?? "이 취향")
    : "";

  return (
    <div>
      <PageTitle>AI가 이해한 내 취향</PageTitle>
      <p className="mt-2 text-sm text-muted-foreground">
        대화와 구매 내역에서 파악한 내용이에요. 틀린 게 있으면 바로 고칠 수
        있어요.
      </p>

      <div className="mt-6">
        {isPending ? (
          <PreferencesSkeleton />
        ) : isError ? (
          <ErrorState
            message="취향 정보를 불러오지 못했어요."
            onRetry={() => refetch()}
          />
        ) : (
          <div className="flex flex-col gap-8">
            {/*
              개인화가 꺼져 있어도 이 아래 전부가 보이고 편집도 된다.
              "개인화를 켜야 편집할 수 있습니다" 화면을 만들지 않는 이유:
              보존된 데이터를 정리하려고 개인화를 다시 켜야 하는 모순이
              생긴다(노션 2장). 그래서 아래 어디에도 enabled 로 잠그는 분기가 없다.
            */}
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
              {/* 좌상단 요약 문단. markdown 이 null 이면(신규 회원) 자리를 비운다 —
                  빈 상태 안내가 아래에서 같은 말을 하므로 두 번 적지 않는다. */}
              <div className="min-w-0 flex-1">
                {data.markdown ? (
                  <SummaryMarkdown markdown={data.markdown} />
                ) : null}
              </div>

              {/* 우상단 컨트롤 — 빈 상태에서도 그대로 보인다 */}
              <PersonalizationControls
                enabled={data.personalization.enabled}
                isToggling={personalizationMutation.isPending}
                isResetting={resetMutation.isPending}
                onToggle={(next) => personalizationMutation.mutate(next)}
                onResetClick={() => setResetOpen(true)}
              />
            </div>

            {data.personalization.enabled ? null : <PersonalizationOffBanner />}

            {isEmpty ? (
              <EmptyPreferences />
            ) : (
              <div
                // 개인화 OFF에서는 채도를 낮춘다 — **숨기지 않는다**(노션 10.5).
                // 편집은 그대로 동작하므로 pointer-events 를 막지 않는다.
                className={
                  data.personalization.enabled ? undefined : "opacity-70"
                }
              >
                <PreferenceTree
                  graph={data}
                  onEdit={setEditing}
                  onDelete={setDeleting}
                />
              </div>
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
          nodes={data.nodes}
          currentNode={nodeIndex.get(editing.to)}
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
