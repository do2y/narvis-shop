"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { useLoginPromptStore } from "@/shared/stores/loginPromptStore";

/**
 * 게스트가 로그인 필요한 동작(바로 구매·찜)을 눌렀을 때 뜨는 안내.
 *
 * 종전에는 곧장 /login 으로 보냈다. 이동이 이미 확정된 뒤라 사용자에게 남는 선택지가
 * 뒤로가기뿐이었는데, 그러면 보고 있던 상품 화면의 스크롤·선택 상태까지 잃는다.
 * 로그인할 마음이 없는 사람에게는 그 이동 자체가 방해다.
 *
 * 그래서 이동 **전에** 묻는다 — [취소]로 하던 일을 그대로 이어갈 수 있다.
 * 토스트가 아니라 모달인 이유가 이것이다. 토스트는 알리기만 할 뿐 거절할 수단이 없다.
 *
 * 파괴적 동작이 아니므로 ResetGraphDialog 와 달리 기본 포커스를 [취소]로 옮기지
 * 않는다 — 여기서 Enter 로 실행되는 것은 로그인 화면 이동뿐이라 되돌리기 쉽고,
 * 오히려 하려던 일을 잇는 쪽이 기본이어야 손이 덜 간다.
 */
export function LoginPromptDialog() {
  const router = useRouter();
  const prompt = useLoginPromptStore((s) => s.prompt);
  const close = useLoginPromptStore((s) => s.close);

  const goLogin = () => {
    if (!prompt) return;
    // 먼저 닫는다 — 열린 채로 이동하면 로그인 화면 위에 모달이 잠깐 남는다.
    close();
    router.push(`/login?returnUrl=${encodeURIComponent(prompt.returnUrl)}`);
  };

  return (
    <Dialog open={prompt !== null} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-sm">
        <div className="flex flex-col gap-2">
          {/* 제목이 없는 순간에도 Dialog 는 마운트돼 있으므로(닫힘 상태) 빈 문자열을
              넣지 않도록 prompt 를 먼저 확인한다 */}
          <DialogTitle className="pr-8 text-base">
            {prompt?.title ?? ""}
          </DialogTitle>
          <DialogDescription>{prompt?.description ?? ""}</DialogDescription>
        </div>

        {/* 모바일에서 버튼 둘이 나란히 서면 좁아진다 — 좁은 화면은 세로로 쌓고,
            그때 주 동작(로그인)이 위로 오게 한다(엄지가 닿는 자리) */}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full px-5"
            onClick={close}
          >
            취소
          </Button>
          <Button
            type="button"
            className="h-11 rounded-full px-5"
            onClick={goLogin}
          >
            로그인하기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
