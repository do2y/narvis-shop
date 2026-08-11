"use client";

import { ChevronDown, Lock } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { PREDICATE_STYLE } from "../predicateStyle";
import {
  groupEdgesByPredicate,
  type PreferenceEdge,
  type PreferenceNodeType,
  type PreferencePredicate,
} from "../types";

interface CompactPreferenceGraphProps {
  edges: PreferenceEdge[];
  focused: PreferencePredicate | null;
  onFocus: (predicate: PreferencePredicate | null) => void;
  onSelect: (edge: PreferenceEdge) => void;
}

const MOBILE_PREVIEW_ITEMS = 3;
const LABEL_MAX_CHARS = 9;
const MOBILE_GRAPH_AXIS_CLASS = "ml-8";
const MOBILE_GRAPH_DOT_OFFSET_CLASS = "-left-[1.5625rem]";

function truncateLabel(label: string): string {
  return label.length > LABEL_MAX_CHARS
    ? `${label.slice(0, LABEL_MAX_CHARS - 1)}…`
    : label;
}

function isDiscrete(type: PreferenceNodeType): boolean {
  return type === "product" || type === "brand";
}

function MobileEdgeChip({
  edge,
  onSelect,
}: {
  edge: PreferenceEdge;
  onSelect: (edge: PreferenceEdge) => void;
}) {
  const style = PREDICATE_STYLE[edge.predicate];
  const locked = !edge.editable;
  const label = truncateLabel(edge.object.label);

  return (
    <button
      type="button"
      onClick={() => onSelect(edge)}
      disabled={locked}
      aria-label={
        locked
          ? `${edge.object.label} - 구매 기록이라 여기서 수정할 수 없어요`
          : `${edge.object.label} 고치기`
      }
      title={
        locked
          ? "구매 기록에서 만들어진 항목은 여기서 수정할 수 없어요."
          : edge.object.label
      }
      className={cn(
        "inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border py-1 pl-2.5 pr-3 text-[13px] font-medium",
        "transition-[transform,background-color,border-color,opacity] duration-150 ease-out-strong",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
        style.chipClass,
        locked && "cursor-default opacity-70 active:scale-100",
      )}
    >
      {isDiscrete(edge.object.type) ? (
        <span
          aria-hidden
          className={cn(
            "size-2.5 shrink-0 rounded-[3px]",
            locked && "border",
          )}
          style={
            locked
              ? { borderColor: style.tint, backgroundColor: "transparent" }
              : { backgroundColor: style.tint }
          }
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            "size-2.5 shrink-0 rounded-full",
            locked && "border",
          )}
          style={
            locked
              ? { borderColor: style.tint, backgroundColor: "transparent" }
              : { backgroundColor: style.tint }
          }
        />
      )}
      <span className="truncate">{label}</span>
      {edge.challenged ? (
        <span className="shrink-0 rounded-full border border-border/70 px-1 text-[10px] font-medium leading-4 text-muted-foreground">
          !
        </span>
      ) : null}
      {locked ? (
        <Lock className="size-3 shrink-0 text-muted-foreground" aria-hidden />
      ) : null}
    </button>
  );
}

export function CompactPreferenceGraph({
  edges,
  focused,
  onFocus,
  onSelect,
}: CompactPreferenceGraphProps) {
  const groups = useMemo(() => groupEdgesByPredicate(edges), [edges]);

  return (
    <div className="pb-1 pt-1">
      {/* 루트 `나`와 아래 spine 이 같은 x축을 써야 한 줄로 읽힌다. */}
      <div className={cn(MOBILE_GRAPH_AXIS_CLASS, "flex w-0 flex-col items-center")}>
        <span className="flex size-11 items-center justify-center rounded-full bg-brand text-lg font-bold text-brand-foreground ring-8 ring-brand/[0.08]">
          나
        </span>
        <span
          aria-hidden
          className="mt-2 h-6 w-px bg-[linear-gradient(180deg,rgba(42,99,184,0.32),rgba(42,99,184,0.06))]"
        />
      </div>

      <div className={cn(MOBILE_GRAPH_AXIS_CLASS, "relative border-l border-border/70 pl-5")}>
        <div className="flex flex-col gap-4">
          {groups.map((group, index) => {
            const style = PREDICATE_STYLE[group.predicate];
            const isEmpty = group.edges.length === 0;
            const expanded = focused === group.predicate;
            const previewLimit = expanded
              ? group.edges.length
              : MOBILE_PREVIEW_ITEMS;
            const visibleEdges = group.edges.slice(0, previewLimit);
            const overflow = Math.max(0, group.edges.length - visibleEdges.length);
            const dimmed = focused !== null && focused !== group.predicate;
            const canExpand = group.edges.length > MOBILE_PREVIEW_ITEMS;

            return (
              <section
                key={group.predicate}
                aria-labelledby={`compact-group-${group.predicate}`}
                className={cn(
                  "relative transition-opacity duration-200 motion-reduce:transition-none",
                  dimmed && "opacity-35",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-3 size-2.5 rounded-full ring-4",
                    MOBILE_GRAPH_DOT_OFFSET_CLASS,
                  )}
                  style={{
                    backgroundColor: style.tint,
                    boxShadow: expanded
                      ? `0 0 0 6px ${style.tint}26`
                      : `0 0 0 4px ${style.tint}14`,
                  }}
                />

                {isEmpty ? (
                  <div className="flex min-h-11 flex-col justify-center gap-2 py-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        id={`compact-group-${group.predicate}`}
                        className="text-sm font-semibold tracking-tight text-foreground"
                      >
                        {group.label}
                      </h3>
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground tabular-nums">
                        0
                      </span>
                    </div>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      {style.emptyHint}
                    </p>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        onFocus(expanded ? null : group.predicate)
                      }
                      aria-expanded={expanded}
                      aria-controls={`compact-group-panel-${group.predicate}`}
                      className={cn(
                        "flex min-h-11 w-full items-start justify-between gap-3 py-0.5 text-left",
                        "transition-[transform,color,opacity] duration-150 ease-out-strong",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        "active:scale-[0.985] motion-reduce:transition-none motion-reduce:active:scale-100",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3
                            id={`compact-group-${group.predicate}`}
                            className="text-sm font-semibold tracking-tight text-foreground"
                          >
                            {group.label}
                          </h3>
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                              style.countClass,
                            )}
                          >
                            {group.edges.length}
                          </span>
                          {overflow > 0 ? (
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {expanded ? "접기" : `+${overflow} 더`}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                          {expanded
                            ? style.hint
                            : "대표 취향만 먼저 보여드려요"}
                        </p>
                      </div>

                      {canExpand ? (
                        <ChevronDown
                          className={cn(
                            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-150",
                            expanded && "rotate-180",
                          )}
                        />
                      ) : null}
                    </button>

                    <ul
                      id={`compact-group-panel-${group.predicate}`}
                      className="mt-2 flex flex-wrap gap-1.5"
                    >
                      {visibleEdges.map((edge) => (
                        <li key={edge.edgeId} className="min-w-0">
                          <MobileEdgeChip edge={edge} onSelect={onSelect} />
                        </li>
                      ))}
                      {overflow > 0 ? (
                        <li>
                          <button
                            type="button"
                            onClick={() => onFocus(group.predicate)}
                            className={cn(
                              "inline-flex h-8 items-center rounded-full border border-border/70 px-2.5 text-[12px] font-medium text-muted-foreground",
                              "transition-[transform,background-color,color] duration-150 ease-out-strong",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                              "active:scale-[0.97] hover:[@media(hover:hover)]:bg-muted motion-reduce:transition-none motion-reduce:active:scale-100",
                            )}
                          >
                            +{overflow}개 더
                          </button>
                        </li>
                      ) : null}
                    </ul>
                  </>
                )}

                {index === groups.length - 1 ? null : (
                  <span
                    aria-hidden
                    className="absolute -bottom-2 left-0 h-2 w-px bg-border/70"
                    style={{ transform: "translateX(-1.25rem)" }}
                  />
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
