import { cn } from "@/lib/utils";

/**
 * 대시보드 섹션 제목 — 모든 구역이 같은 규칙을 쓰게 하는 단일 지점.
 *
 * 종전에는 제목이 `text-sm text-muted-foreground` 라 본문·지표와 같은 크기·같은
 * 흐린 색이었다. 그래서 화면을 훑을 때 "여기서 구역이 갈린다"는 신호가 없었다.
 * 제목만 한 단 올려(base + semibold + foreground) 본문보다 진하게 둔다 —
 * 크기를 크게 키우는 대신 **대비와 여백**으로 위계를 만든다.
 *
 * trailing 은 제목 오른쪽에 붙는 보조 정보다(합계·건수). 제목과 같은 줄에 두되
 * 절대 제목보다 강하지 않게 — 굵기·색을 낮춰 "제목에 딸린 값"으로 읽히게 한다.
 */
export function SectionHeading({
  title,
  trailing,
  action,
}: {
  title: string;
  /** 제목 바로 옆 보조 정보 — 배지·건수 등. 제목보다 약하게 보여야 한다 */
  trailing?: React.ReactNode;
  /** 오른쪽 끝 링크 등 — 제목 줄의 반대편 */
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {trailing}
      </div>
      {action}
    </div>
  );
}

/**
 * 제목 옆 보조 배지 — "진행 중 12건"처럼 제목에 딸린 상태값.
 *
 * 회색 면 위 작은 글자라 제목과 경쟁하지 않는다. 경고색은 쓰지 않는다 —
 * 여기 오는 값은 대개 정상 상태이고, 빨갛게 두면 매번 경고로 읽힌다.
 */
export function SectionBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
