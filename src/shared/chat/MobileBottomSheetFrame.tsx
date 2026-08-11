"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";

interface MobileBottomSheetFrameProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  collapsedPeek?: number;
  expandedTopInset?: number;
  children: React.ReactNode;
  className?: string;
}

interface DragState {
  pointerId: number;
  startY: number;
  startTranslate: number;
  currentTranslate: number;
  lastY: number;
  lastTime: number;
  velocity: number;
}

const DRAG_SNAP_DISTANCE = 44;
const DRAG_SNAP_VELOCITY = 0.12;
export const MOBILE_BOTTOM_SHEET_COLLAPSED_PEEK = 48;
const DEFAULT_EXPANDED_TOP_INSET = 220;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function MobileBottomSheetFrame({
  expanded,
  onExpandedChange,
  collapsedPeek = MOBILE_BOTTOM_SHEET_COLLAPSED_PEEK,
  expandedTopInset = DEFAULT_EXPANDED_TOP_INSET,
  children,
  className,
}: MobileBottomSheetFrameProps) {
  const panelId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [dragTranslate, setDragTranslate] = useState<number | null>(null);

  useEffect(() => {
    const node = sheetRef.current;
    if (!node) return;

    const measure = () => setSheetHeight(node.getBoundingClientRect().height);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const collapsedOffset = Math.max(0, sheetHeight - collapsedPeek);
  const settledTranslate = expanded ? 0 : collapsedOffset;
  const currentTranslate = clamp(
    dragTranslate ?? settledTranslate,
    0,
    collapsedOffset,
  );

  const finishDrag = (cancelled: boolean) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragTranslate(null);
    if (!drag || cancelled) return;

    const moved = Math.abs(drag.currentTranslate - drag.startTranslate);
    const velocity = drag.velocity;

    if (moved < DRAG_SNAP_DISTANCE && Math.abs(velocity) < DRAG_SNAP_VELOCITY) {
      return;
    }

    const projected = drag.currentTranslate + velocity * 240;
    const midpoint = collapsedOffset / 2;
    const nextExpanded =
      Math.abs(velocity) > DRAG_SNAP_VELOCITY
        ? velocity < 0
        : projected < midpoint;

    onExpandedChange(nextExpanded);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    suppressClickRef.current = false;

    const now = performance.now();
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startTranslate: currentTranslate,
      currentTranslate,
      lastY: event.clientY,
      lastTime: now,
      velocity: 0,
    };
    setDragTranslate(currentTranslate);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const next = clamp(
      drag.startTranslate + (event.clientY - drag.startY),
      0,
      collapsedOffset,
    );
    drag.currentTranslate = next;
    setDragTranslate(next);

    const now = performance.now();
    const dt = now - drag.lastTime;
    if (dt > 0) {
      drag.velocity = (event.clientY - drag.lastY) / dt;
    }
    drag.lastY = event.clientY;
    drag.lastTime = now;

    if (Math.abs(event.clientY - drag.startY) > 6) {
      suppressClickRef.current = true;
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finishDrag(false);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finishDrag(true);
  };

  return (
    <div
      style={
        {
          "--sheet-top-inset": `${expandedTopInset}px`,
        } as CSSProperties
      }
      className="absolute inset-x-0 bottom-0 top-[var(--sheet-top-inset)] z-20 flex items-end pointer-events-none lg:static lg:order-first lg:z-auto lg:min-h-0 lg:w-[420px] lg:shrink-0 lg:items-stretch"
    >
      <div
        id={panelId}
        ref={sheetRef}
        style={
          {
            "--sheet-translate": `${currentTranslate}px`,
          } as CSSProperties
        }
        className={cn(
          "pointer-events-auto flex h-full w-full min-h-0 flex-col overflow-hidden",
          "rounded-t-[28px] border border-border/70 bg-background/96 shadow-[0_-18px_40px_-24px_rgba(15,23,42,0.28),0_-4px_16px_-10px_rgba(15,23,42,0.12)]",
          "supports-[backdrop-filter]:bg-background/88 supports-[backdrop-filter]:backdrop-blur-xl",
          "translate-y-[var(--sheet-translate)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          dragTranslate !== null && "transition-none",
          "lg:translate-y-0 lg:rounded-none lg:border-0 lg:border-r lg:bg-background lg:shadow-none lg:backdrop-blur-none",
          className,
        )}
      >
        <button
          type="button"
          aria-controls={panelId}
          aria-expanded={expanded}
          aria-label={expanded ? "채팅 패널 접기" : "채팅 패널 펼치기"}
          onClick={() => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false;
              return;
            }
            onExpandedChange(!expanded);
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className={cn(
            "flex h-8 shrink-0 touch-none select-none items-center justify-center lg:hidden",
            "cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45",
          )}
        >
          <span
            aria-hidden
            className="h-1 w-12 rounded-full bg-foreground/28"
          />
        </button>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
