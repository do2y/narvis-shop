"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/shared/ui/skeleton";
import { ErrorState, PageTitle } from "@/shared/ui/PageState";
import { DeleteEdgeDialog } from "./components/DeleteEdgeDialog";
import { EditEdgeDialog } from "./components/EditEdgeDialog";
import { EmptySummaryCard } from "./components/EmptySummaryCard";
import {
  PersonalizationControls,
  PersonalizationOffBanner,
} from "./components/PersonalizationControls";
import { PreferenceGraph } from "./components/PreferenceGraph";
import { CompactPreferenceGraph } from "./components/CompactPreferenceGraph";
import { PreferenceTree } from "./components/PreferenceTree";
import { ResetGraphDialog } from "./components/ResetGraphDialog";
import { SummaryCard } from "./components/SummaryCard";
import { useIsNarrow } from "./components/useIsNarrow";
import { buildSummaryStats } from "./summaryStats";
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
 * 빈 상태에서 관계도·목록 자리를 대신하는 한 줄.
 *
 * 두 섹션을 통째로 숨기므로, 그게 **없는 기능이 아니라 아직 이른 것**임을
 * 알려준다. 카드도 테두리도 두지 않는 이유: 여기에 상자를 하나 더 두면
 * 대표 카드와 경쟁해 "빈 카드가 둘"이라는 원래 문제로 돌아간다.
 * CTA 도 반복하지 않는다 — 바로 위 카드에 이미 있다.
 *
 * break-keep: 한국어 기본 줄바꿈은 글자 단위라 어절 한가운데가 잘린다.
 */
function EmptySectionsNote() {
  return (
    <p className="px-1 text-[13px] leading-relaxed break-keep text-muted-foreground">
      취향이 쌓이면 여기에 관계도와 전체 목록이 생겨요. 하나씩 눌러 고치거나
      지울 수도 있어요.
    </p>
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

  // 좁은 화면에서는 방사형 대신 모바일용 축약 그래프를 쓴다.
  const isNarrow = useIsNarrow();

  // 그래프에서 한 관계만 확대하는 포커스 모드. 목록은 자체 포커스를 쓴다.
  const [focused, setFocused] = useState<PreferencePredicate | null>(null);

  /** 목록 섹션 — 그래프 상단의 `전체 취향 보기`가 여기로 스크롤한다 */
  const listRef = useRef<HTMLElement>(null);

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

  // 요약 카드 수치 — 지금 있는 필드만으로 계산한다(summaryStats 주석)
  const stats = buildSummaryStats(data?.edges ?? []);

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
      <header className="flex flex-col gap-3 border-b border-border/70 pb-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-8 sm:pb-5">
        <div className="min-w-0">
          {/*
            "AI가 이해한 내 취향 / 대화와 구매 내역에서 파악한 내용이에요"에서 바꿨다.
            그 문구는 기능 설명이라 화면 이름(취향 나비게이션)의 가벼운 탐색 분위기와
            어긋났다. 사용자가 자기 취향 지도를 구경하는 쪽으로 옮긴다.

            "길·방향"은 나비게이션에서 자연스럽게 나오는 말이라 쓰되, 말장난까지는
            가지 않는다("취향 항해" 같은 표현은 한 번 웃기고 두 번째부터 걸린다).
            존댓말·"~해요"체는 앱 나머지와 같다.
          */}
          <PageTitle>내 취향 나비게이션</PageTitle>
          <p className="mt-1 max-w-lg text-[13px] leading-[1.6] text-muted-foreground sm:mt-1.5 sm:max-w-xl sm:text-sm">
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

      <div className="mt-3.5 sm:mt-5">
        {isPending ? (
          <PreferencesSkeleton />
        ) : isError ? (
          <ErrorState
            message="취향 정보를 불러오지 못했어요."
            onRetry={() => refetch()}
          />
        ) : (
          <div className="flex flex-col gap-4 sm:gap-5">
            {/*
              개인화가 꺼져 있어도 이 아래 전부가 보이고 편집도 된다.
              "개인화를 켜야 편집할 수 있습니다" 화면을 만들지 않는 이유:
              보존된 데이터를 정리하려고 개인화를 다시 켜야 하는 모순이
              생긴다. 그래서 아래 어디에도 enabled 로 잠그는 분기가 없다.
            */}
            {data.personalization.enabled ? null : <PersonalizationOffBanner />}

            {/*
              ① 대표 카드 — 이 페이지의 첫인상.
              아래 두 섹션과 달리 옅은 브랜드 배경 + 로고색 라인을 줘 무게를
              한 단계 올린다(SummaryCard 주석). markdown 이 null 이어도
              수치 요약은 나오므로 카드 자체는 그린다.

              빈 상태(`exists: false` 또는 `edges: []` — 오류가 아니라 신규
              회원의 정상 상태다)에서는 **카드를 통째로 갈아끼운다.**
              SummaryCard 는 내용이 전부 조건부라 데이터가 없으면 "0개" 한 줄만
              남은 반쯤 빈 카드가 되고, 그 아래 빈 상태 안내가 같은 사실을 한 번
              더 말하게 된다. 두 블록을 EmptySummaryCard 하나로 합친다.

              ⚠️ 빈 상태에서 **아래 관계도·목록 섹션은 그리지 않는다.** 셋 다
              비면 같은 말("아직 없어요")이 세 번 나오고, 빈 그래프 캔버스와
              빈 그룹 5개가 화면을 세 배로 늘린다. 대표 empty state 하나만
              강하게 두고, 두 섹션이 사라진 것처럼 보이지 않도록 카드 아래에
              한 줄 안내만 남긴다(EmptySectionsNote).

              ⚠️ 로딩·오류와 섞지 않는다 — 위쪽 분기에서 스켈레톤·ErrorState 로
              이미 갈렸고, 여기 도달했다는 것은 요청이 정상 종료됐다는 뜻이다.
            */}
            {isEmpty ? (
              <>
                <EmptySummaryCard />
                <EmptySectionsNote />
              </>
            ) : (
              <>
                <SummaryCard stats={stats} markdown={data.markdown} />

                {/*
                  ② 관계도(구조 훑기) → ③ 전체 목록(확인하고 고치기).

                  둘은 같은 화면에 세로로 있고 역할만 나뉜다. 대표 카드와 달리
                  배경 없이 테두리만 둬, 시각적 무게가 ①보다 낮게 읽히도록 한다.
                */}

                <section
                  aria-labelledby="preference-map-heading"
                  className={cn(
                    "overflow-hidden rounded-lg border border-border/70 transition-opacity",
                    data.personalization.enabled ? undefined : "opacity-70",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-4 sm:px-6">
                    <div className="min-w-0">
                      <h2
                        id="preference-map-heading"
                        className="text-base font-bold tracking-tight"
                      >
                        취향이 이어지는 방식
                      </h2>
                      <p className="mt-0.5 text-[13px] text-muted-foreground">
                        {isNarrow
                          ? "모바일에선 대표 가지만 먼저 보여드려요. 눌러서 넓게 볼 수 있어요."
                          : "자주 나타난 취향을 모아 연결해봤어요. 하나씩 눌러 살펴보세요."}
                      </p>
                    </div>

                    {/* 전체를 보는 경로는 이 버튼 하나로 모았다 —
                        그래프 안에 관계마다 알약을 띄우면 그것만 5개라
                        정작 취향 라벨보다 버튼이 먼저 보인다 */}
                    <button
                      type="button"
                      onClick={() => {
                        setFocused(null);
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
                    {isNarrow ? (
                      <div className="px-4 pb-4 pt-2">
                        <CompactPreferenceGraph
                          edges={data.edges}
                          focused={focused}
                          onFocus={setFocused}
                          onSelect={(edge) => edge.editable && setEditing(edge)}
                        />
                      </div>
                    ) : (
                      <>
                        {/* 그래프가 컨테이너를 넉넉히 쓰게 좌우 여백을 줄인다 —
                            가운데 작게 떠 있으면 핵심 콘텐츠로 안 읽힌다 */}
                        <div className="px-2 pb-3">
                          <PreferenceGraph
                            edges={data.edges}
                            focused={focused}
                            onFocus={setFocused}
                            // 그래프에서는 아이콘을 놓을 자리가 없어 항목을 누르면
                            // 바로 수정 창을 연다. 삭제는 목록에서 하도록 두 경로를
                            // 나눈다 — 파괴적인 동작을 좁은 타겟에 붙이면 오터치가 는다.
                            onSelect={(edge) => edge.editable && setEditing(edge)}
                          />
                        </div>

                        {focused ? (
                          // 키보드 사용자에게도 빠져나갈 길을 알린다
                          <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs text-muted-foreground">
                            다른 곳을 누르거나 ESC를 눌러 전체 보기로 돌아가요.
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                </section>

                {/* 전체 목록 — 위 버튼이 여기로 스크롤한다.
                    scroll-mt: sticky 헤더에 제목이 가리지 않게 띄운다 */}
                <section
                  ref={listRef}
                  aria-labelledby="preference-list-heading"
                  className={cn(
                    "scroll-mt-20 rounded-lg border border-border/70 px-5 py-5 transition-opacity sm:px-6",
                    data.personalization.enabled ? undefined : "opacity-70",
                  )}
                >
                  <h2
                    id="preference-list-heading"
                    className="text-base font-bold tracking-tight"
                  >
                    지금까지 발견한 취향
                  </h2>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    마음에 꼭 맞는지 둘러보고, 다른 부분은 눌러서 고칠 수
                    있어요.
                  </p>

                  <div className="mt-5">
                    <PreferenceTree
                      graph={data}
                      highlighted={focused}
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
