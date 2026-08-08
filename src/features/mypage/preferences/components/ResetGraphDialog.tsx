"use client";

import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";

/**
 * 전체 초기화 확인 다이얼로그 — **개별 삭제보다 훨씬 파괴적이다.**
 *
 * 확인의 무게도 그만큼 달라야 한다(노션 3.6):
 * - 삭제 대상 개수를 나열한다
 * - 버튼 문구를 "초기화"가 아니라 **"모두 삭제"** 로
 * - **대화 기록이 함께 지워지는 것을 숨기지 않는다**
 * - 기본 포커스는 [취소]
 *
 * 문구 규약:
 *   ✅ "대화 기록을 포함한 개인화 데이터를 모두 초기화합니다. 되돌릴 수 없습니다."
 *   ❌ "모든 데이터를 삭제합니다"  — 변경 기록이 남으므로 사실과 다르다
 *   ❌ "취향을 초기화합니다"       — 대화 기록이 지워지는 걸 숨긴다
 */
export function ResetGraphDialog({
  open,
  onOpenChange,
  edgeCount,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 지금 화면에 있는 취향 개수 */
  edgeCount: number;
  isPending: boolean;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 기본 포커스를 [취소]로 — Enter 연타로 되돌릴 수 없는 동작이 실행되면 안 된다
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => cancelRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent role="alertdialog" className="max-w-sm">
        <DialogTitle className="pr-8 text-base">
          개인화 데이터를 모두 초기화할까요?
        </DialogTitle>

        <div className="mt-4 flex flex-col gap-4 text-sm">
          <ul className="flex flex-col gap-1 text-muted-foreground">
            <li>· 취향 {edgeCount}건</li>
            {/*
              대화 기록은 개수를 적지 않는다 — M-11에 사전 카운트 필드가 없다
              (계약상 purged 응답에만 있다). 계약에 없는 필드를 임의로 만들지
              않고, 대신 "전체"로 정직하게 적는다. 개수는 완료 토스트에서 알린다.
              (BE 협의 시 사전 카운트 필드를 요청할 항목)
            */}
            <li>· 대화 기록 전체</li>
          </ul>

          <p className="text-muted-foreground">
            대화 기록을 포함한 개인화 데이터를 모두 초기화합니다. 되돌릴 수
            없습니다.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-6">
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            className="h-11 rounded-full px-5"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            취소
          </Button>
          {/* "초기화"가 아니라 "모두 삭제" — 무엇이 일어나는지를 동사로 적는다 */}
          <Button
            type="button"
            variant="destructive"
            className="h-11 rounded-full px-5"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "삭제 중…" : "모두 삭제"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
