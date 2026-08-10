"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ChevronDown, Sparkles } from "lucide-react";
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
import {
  SummaryMarkdown,
  summaryFirstLine,
} from "./components/SummaryMarkdown";
import { useIsNarrow } from "./components/useIsNarrow";
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

  // 좁은 화면에서는 방사형이 성립하지 않아(라벨 겹침) 그래프를 아예 그리지 않는다.
  const isNarrow = useIsNarrow();

  // 그래프에서 한 관계만 확대하는 포커스 모드. 목록은 자체 포커스를 쓴다.
  const [focused, setFocused] = useState<PreferencePredicate | null>(null);

  /**
   * 그래프의 "전체 취향 보기"로 목록에 내려갈 때 펼쳐 둘 관계.
   *
   * ⚠️ **그래프와 목록은 이제 같은 화면에 세로로 함께 있다.** 예전에는 뷰
   * 전환(그래프 ⇄ 전체 보기)이었는데, 두 이름의 기준이 달랐고(표현 vs 범위)
   * 한 화면에 다 들어가는 내용을 굳이 갈라 놓아 탐색이 한 단계 늘었다.
   * 지금은 그래프가 대표 취향을 보여주고, 버튼이 아래 목록으로 스크롤한다.
   */
  const [showAllOf, setShowAllOf] = useState<PreferencePredicate | null>(null);
  const listRef = useRef<HTMLElement>(null);

  const showAllInList = (predicate: PreferencePredicate) => {
    setFocused(null); // 그래프 확대는 풀고 목록으로 넘긴다
    setShowAllOf(predicate);
    /*
      목록 섹션으로 부드럽게 이동한다.

      `scroll-behavior: smooth`(globals.css)가 걸려 있고 모션 감소에서는
      같은 파일의 미디어 쿼리가 auto 로 덮는다 — 여기서 따로 분기하지 않는다.

      다음 프레임에 부른다: 이 시점엔 아직 그룹이 펼쳐지지 않아 목록 높이가
      달라진다. 레이아웃이 확정된 뒤 스크롤해야 목표 지점이 어긋나지 않는다.
    */
    requestAnimationFrame(() => {
      listRef.current?.scrollIntoView({ block: "start" });
    });
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

  // 접힌 요약 패널의 한 줄 미리보기.
  // useMemo 를 쓰지 않는다 — 짧은 문자열 하나를 파싱하는 값싼 계산이고,
  // `[data?.markdown]` 의존성이 컴파일러가 추론한 `data` 와 어긋나 최적화가
  // 통째로 꺼진다(Compilation Skipped). 컴파일러가 알아서 메모한다.
  const summaryPreview = data?.markdown ? summaryFirstLine(data.markdown) : "";

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
          {/*
            "AI가 이해한 내 취향 / 대화와 구매 내역에서 파악한 내용이에요"에서 바꿨다.
            그 문구는 기능 설명이라 화면 이름(취향 나비게이션)의 가벼운 탐색 분위기와
            어긋났다. 사용자가 자기 취향 지도를 구경하는 쪽으로 옮긴다.

            "길·방향"은 나비게이션에서 자연스럽게 나오는 말이라 쓰되, 말장난까지는
            가지 않는다("취향 항해" 같은 표현은 한 번 웃기고 두 번째부터 걸린다).
            존댓말·"~해요"체는 앱 나머지와 같다.
          */}
          <PageTitle>내 취향은 지금 어디쯤일까요?</PageTitle>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            대화하고 쇼핑하며 발견한 취향을 모아뒀어요. 다른 길로 샜다면 원하는
            방향으로 돌려주세요.
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

            {/*
              요약 패널 — markdown 이 null 이면(신규 회원) 자리를 비운다.
              빈 상태 안내가 아래에서 같은 말을 하므로 두 번 적지 않는다.

              **접을 수 있게 둔다.** 이 문단이 펼쳐져 있으면 그래프 패널이
              415px 아래에서 시작해, 1366×768 노트북에서 그래프가 55% 만
              보였다(실측). 첫 화면에 잘린 그림이 보이는 셈이라 무슨 화면인지
              읽히지 않는다.

              기본을 접힘으로 두는 이유: 요약은 "AI 가 나를 이렇게 봤다"는
              한 문단이고, 같은 내용을 그래프가 구조로 더 잘 보여준다.
              궁금하면 펴서 읽으면 된다.
            */}
            {data.markdown ? (
              <details className="group/summary rounded-sm border border-border/70 bg-muted/20">
                <summary
                  className={cn(
                    "flex h-11 cursor-pointer list-none items-center gap-2 px-5 text-sm font-semibold tracking-tight",
                    "transition-colors duration-150 ease-out-strong",
                    "hover:[@media(hover:hover)]:text-brand",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45",
                    // Safari 는 list-none 만으로 삼각형이 안 사라진다
                    "[&::-webkit-details-marker]:hidden",
                  )}
                >
                  취향 요약
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ease-out-strong group-open/summary:rotate-180" />
                  {/* 접힌 동안 한 줄 미리보기 — 라벨만 있으면 펴볼 이유가 없다.
                      펼치면 같은 문장이 아래에 나오므로 이 줄은 감춘다 */}
                  <span className="min-w-0 truncate text-xs font-normal text-muted-foreground group-open/summary:hidden">
                    {summaryPreview}
                  </span>
                </summary>
                <div className="border-t border-border/70 px-5 py-4">
                  {/* 마크다운의 `# 취향 요약` 제목은 위 summary 와 겹치므로
                      파서 결과에서 제목 블록을 빼고 본문만 그린다 */}
                  <SummaryMarkdown markdown={data.markdown} hideHeading />
                </div>
              </details>
            ) : null}

            {isEmpty ? (
              <EmptyPreferences />
            ) : (
              /*
                그래프와 목록을 **한 화면에 세로로 함께** 둔다.

                예전에는 `그래프 / 전체 보기` 세그먼트로 갈랐는데 두 문제가 있었다:
                ① 두 이름의 기준이 달랐다 — "그래프"는 표현 방식이고 "전체 보기"는
                   범위라, 무엇과 무엇을 고르는 것인지 읽히지 않았다
                ② 한 화면에 다 들어가는 내용을 갈라 놓아 전체를 보려면 클릭이
                   한 번 더 들었다(그래프는 어차피 대표만 보여준다)

                지금은 그래프가 "구조 훑기", 목록이 "전부 확인하고 고치기"로
                역할이 나뉘고, 사이를 `전체 취향 보기` 버튼이 잇는다.
              */
              <>
                {/* 좁은 화면에서는 방사형이 성립하지 않는다(라벨이 겹쳐 아무것도
                    안 읽힌다). 그릴 수 없는 것을 억지로 넣지 않고 목록만 남긴다 */}
                {isNarrow ? null : (
                  <section
                    aria-labelledby="preference-map-heading"
                    className={cn(
                      "overflow-hidden rounded-sm border border-border/70 transition-opacity",
                      data.personalization.enabled ? undefined : "opacity-70",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border/70 bg-muted/20 px-5 py-3">
                      <div className="min-w-0">
                        <h3
                          id="preference-map-heading"
                          className="text-sm font-semibold tracking-tight"
                        >
                          취향 관계도
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          자주 보이는 취향만 모았어요. 항목을 누르면 고칠 수 있어요.
                        </p>
                      </div>

                      {/* 목적이 드러나는 문구 — "더보기"는 무엇이 더 나오는지
                          말해주지 않는다. 아래 목록으로 내려간다는 뜻이라
                          아래쪽 화살표를 함께 둔다 */}
                      <button
                        type="button"
                        onClick={() => {
                          setFocused(null);
                          setShowAllOf(null);
                          requestAnimationFrame(() =>
                            listRef.current?.scrollIntoView({ block: "start" }),
                          );
                        }}
                        className={cn(
                          "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 text-[13px] font-medium",
                          "text-muted-foreground transition-colors duration-150 ease-out-strong",
                          "hover:[@media(hover:hover)]:bg-muted hover:[@media(hover:hover)]:text-foreground",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45",
                        )}
                      >
                        전체 취향 보기
                        <ArrowDown className="size-3.5" />
                      </button>
                    </div>

                    <div className="relative">
                      <div className="px-1 pb-2 pt-1">
                        <PreferenceGraph
                          edges={data.edges}
                          focused={focused}
                          onFocus={setFocused}
                          onShowAll={showAllInList}
                          // 그래프에서는 아이콘을 놓을 자리가 없어 항목을 누르면
                          // 바로 수정 창을 연다. 삭제는 목록에서 하도록 두 경로를
                          // 나눈다 — 파괴적인 동작을 좁은 타겟에 붙이면 오터치가 는다.
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
                  </section>
                )}

                {/* 전체 목록 — 그래프의 "전체 취향 보기"가 여기로 스크롤한다.
                    scroll-mt: sticky 헤더에 제목이 가리지 않게 띄운다 */}
                <section
                  ref={listRef}
                  aria-labelledby="preference-list-heading"
                  className={cn(
                    "scroll-mt-20 overflow-hidden rounded-sm border border-border/70 transition-opacity",
                    data.personalization.enabled ? undefined : "opacity-70",
                  )}
                >
                  <div className="border-b border-border/70 bg-muted/20 px-5 py-3">
                    <h3
                      id="preference-list-heading"
                      className="text-sm font-semibold tracking-tight"
                    >
                      전체 취향
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      항목을 누르면 고치고, 오른쪽 버튼으로 지울 수 있어요.
                    </p>
                  </div>

                  <div className="p-4 sm:p-5">
                    <PreferenceTree
                      graph={data}
                      requestedFocus={showAllOf}
                      onEdit={setEditing}
                      onDelete={setDeleting}
                    />
                  </div>
                </section>
              </>
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
