"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface NewChatButtonProps {
  onClick: () => void;
  className?: string;
}

/**
 * 로고와 버튼을 가르는 구분선 — 높이를 24px 로 못박는다.
 *
 * 버튼에 `border-l` 로 그리면 선 길이가 버튼 높이(터치 타깃 44px)를 따라간다.
 * 두 헤더는 로고 높이가 달라(판매자는 워드마크+SELLER 2단) 같은 클래스로도
 * 선 길이가 어긋났다. 선은 장식이고 44px 는 손가락을 위한 값이라, 둘을 분리해
 * 구분선만 고정 높이로 그린다.
 */
function HeaderDivider() {
  return (
    <span
      aria-hidden
      className="hidden h-6 w-px shrink-0 bg-border sm:inline-block"
    />
  );
}

/**
 * 헤더 로고 옆에 놓는 "새 대화" — 구매자(/chat)·판매자(/seller/chat) 공용.
 *
 * 대화 영역이 아니라 헤더에 두는 이유: 대화 영역에 띄우면(floating) 스크롤되는
 * 메시지 위에 겹쳐 첫 줄을 가리고, 두 챗 화면의 위치가 서로 달라진다.
 * 헤더는 두 화면 모두 같은 자리라 "같아 보이는 것은 같은 곳에 있다"가 지켜진다.
 *
 * 좌측 구분선은 로고와 이 버튼을 갈라 준다 — 붙어 보이면 브랜드명의 일부처럼 읽힌다.
 */
export function NewChatButton({ onClick, className }: NewChatButtonProps) {
  return (
    // 구분선 + 버튼 묶음. gap-4 로 선 좌우 여백을 같게 둔다(로고쪽 gap-4 와 대칭)
    <div className="flex shrink-0 items-center gap-2 sm:gap-4">
      <HeaderDivider />
      <button
        type="button"
        onClick={onClick}
        aria-label="새 대화"
        title="새 대화"
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-medium whitespace-nowrap text-muted-foreground min-[390px]:h-11 min-[430px]:w-auto min-[430px]:justify-start min-[430px]:gap-1 min-[430px]:px-0 sm:gap-1.5 sm:rounded-none sm:text-sm",
          // 색만 전환한다 — transition-all 은 layout·shadow 까지 잡아 불필요한 리페인트를 만든다
          "transition-[transform,color,background-color] duration-150 ease-out-strong",
          // 터치에서 탭이 hover 로 잡혀 손을 뗀 뒤에도 색이 남는 것을 막는다
          "hover:[@media(hover:hover)]:bg-muted hover:[@media(hover:hover)]:text-foreground sm:hover:[@media(hover:hover)]:bg-transparent",
          // press 피드백은 "눌렀다"만 전하면 되므로 짧고 약하게
          "active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
          className,
        )}
      >
        <Plus className="size-4 shrink-0" />
        <span className="hidden min-[430px]:inline">새 대화</span>
      </button>
    </div>
  );
}
