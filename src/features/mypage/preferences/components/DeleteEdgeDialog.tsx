"use client";

import { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";

interface DeleteEdgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 지울 항목의 표시 이름 — 확인창에 그대로 넣는다 */
  label: string;
  /** 구매 기록(editable: false)인가 — 안내 문구가 달라진다 */
  isPurchaseRecord: boolean;
  isPending: boolean;
  onConfirm: () => void;
}

/**
 * 삭제 확인 다이얼로그 — **되돌릴 수 없는 동작이라 확인이 필수다.**
 *
 * 요구사항(노션 3.5):
 * - **확인창에 항목 이름을 넣는다.** 아이콘이 작아 오터치 가능성이 있는데
 *   "이 취향을 삭제할까요?"만 뜨면 어느 것을 눌렀는지 확인할 방법이 없다
 * - **"되돌릴 수 없습니다"를 반드시 포함**
 * - **기본 포커스는 [취소]** — Enter 연타로 삭제되면 안 된다
 * - `role="alertdialog"` + 포커스 트랩
 * - [삭제]와 [취소]를 시각적으로 구분하고 서로 붙여 놓지 않는다
 *
 * 만들지 않는 것: "다시 묻지 않기" 체크박스(되돌릴 수 없는 동작의 확인을 끌 수
 * 있게 하면 안 된다), 실행취소 토스트(되돌릴 수 있다는 잘못된 신호).
 */
export function DeleteEdgeDialog({
  open,
  onOpenChange,
  label,
  isPurchaseRecord,
  isPending,
  onConfirm,
}: DeleteEdgeDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 기본 포커스를 [취소]로. base-ui는 팝업 첫 요소에 포커스를 주는데, 그게
  // [삭제]가 되면 Enter 연타로 되돌릴 수 없는 동작이 실행된다.
  useEffect(() => {
    if (!open) return;
    // 팝업이 마운트되고 base-ui가 초기 포커스를 옮긴 뒤에 가져와야 한다
    const id = requestAnimationFrame(() => cancelRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // alertdialog — 단순 안내가 아니라 사용자의 응답을 기다리는 경고다.
        // 스크린리더가 즉시 읽고, 바깥 클릭으로 흘려보내지 않는다.
        role="alertdialog"
        className="max-w-sm"
      >
        <DialogTitle className="pr-8 text-base">
          “{label}”을(를) 삭제할까요?
        </DialogTitle>

        <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
          <p>삭제하면 되돌릴 수 없습니다.</p>
          {isPurchaseRecord ? (
            // 구매 기록은 삭제만 가능하다(수정 불가). 다만 "지웠으니 다시
            // 추천되겠지"는 성립하지 않는다 — 재구매 중복 방지는 주문 이력이라는
            // 별도 경로로 동작한다(노션 3.5).
            <p>목록에서 지워요. 이미 산 상품이 다시 추천되지는 않습니다.</p>
          ) : null}
        </div>

        {/* [취소]와 [삭제]를 시각적으로 구분하고 사이를 벌린다 */}
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
          <Button
            type="button"
            variant="destructive"
            className="h-11 rounded-full px-5"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "삭제 중…" : "삭제"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
