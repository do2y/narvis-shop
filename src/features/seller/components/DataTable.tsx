"use client";

import { cn } from "@/lib/utils";

/**
 * 판매자 목록 표의 공통 껍데기 — 주문·상품이 같은 규칙을 쓰게 한다.
 *
 * 종전에는 두 화면이 각자 `<div overflow-x-auto><table min-w-[...]>` 를 손으로 짰고,
 * 열 너비를 브라우저 자동 계산에 맡겼다. 그래서 "판매량" 같은 짧은 헤더가 좁은 열에
 * 걸리면 글자 단위로 세로로 쪼개졌고(판/매/량), min-w 가 컨테이너보다 커서 넓은
 * 화면에서도 가로 스크롤바가 항상 페이지네이션 위에 떠 있었다.
 *
 * 해결의 핵심은 **colgroup 으로 열 너비를 직접 지정**하는 것이다. 브라우저에게 맡기면
 * 내용 길이에 따라 매 페이지 열 폭이 흔들리고, 짧은 헤더가 먼저 희생된다.
 */

export interface DataTableColumn {
  key: string;
  header: string;
  /**
   * colgroup 에 들어갈 너비. 고정폭 열은 px, 남은 공간을 먹을 열은 "auto" 로 둔다.
   * 표 전체가 table-fixed 라 여기 적은 값이 그대로 열 폭이 된다.
   */
  width?: string;
  align?: "left" | "right";
  /** 좁은 화면에서 숨길 열 — 핵심 정보가 아닌 보조 열에만 쓴다 */
  hideBelow?: "sm" | "md" | "lg";
}

/** 열 정의의 hideBelow → 그 열의 th/td 에 함께 걸 반응형 숨김 클래스 */
export function columnHiddenClass(col: DataTableColumn): string | undefined {
  switch (col.hideBelow) {
    case "sm":
      return "hidden sm:table-cell";
    case "md":
      return "hidden md:table-cell";
    case "lg":
      return "hidden lg:table-cell";
    default:
      return undefined;
  }
}

/**
 * 표 컨테이너 + colgroup + thead 까지 그린다. tbody 는 호출부가 넣는다
 * (행 구성은 화면마다 달라 공통화하면 오히려 분기가 늘어난다).
 *
 * `minWidth`: 이 폭 아래로는 열이 뭉개지므로 그때만 가로 스크롤을 허용한다.
 * 데스크톱에서는 컨테이너가 이보다 넓어 스크롤바가 생기지 않는다.
 */
export function DataTable({
  columns,
  minWidth,
  children,
}: {
  columns: DataTableColumn[];
  /** 예: "min-w-[860px]" — 이 폭 미만에서만 가로 스크롤 */
  minWidth: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-sm border bg-background">
      <table
        className={cn(
          // table-fixed: colgroup 의 너비를 그대로 따르게 한다. auto 면 브라우저가
          // 내용에 맞춰 다시 계산해 colgroup 이 무시된다.
          "w-full table-fixed border-collapse text-sm",
          minWidth,
        )}
      >
        <colgroup>
          {columns.map((c) => (
            <col key={c.key} style={c.width ? { width: c.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          {/* 헤더는 고정하지 않는다.
              표가 가로 스크롤을 위해 overflow-x-auto 안에 있는데, overflow 가
              auto/hidden/clip 중 무엇이든 그 div 가 sticky 의 스크롤 컨테이너가
              된다. 그러면 th 는 뷰포트가 아니라 그 상자 기준으로 top 만큼
              내려간 자리에 박혀 첫 행을 덮는다. 한 페이지 10건 남짓이라
              고정의 이득도 크지 않다. */}
          <tr
            className={cn(
              "text-xs text-muted-foreground",
              "[&>th]:border-b [&>th]:bg-muted [&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold",
              // 헤더는 절대 쪼개지지 않는다 — 열이 좁아도 글자를 세로로 흘리지 않는다
              "[&>th]:whitespace-nowrap",
            )}
          >
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  c.align === "right" ? "text-right" : "text-left",
                  columnHiddenClass(c),
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        {children}
      </table>
    </div>
  );
}

/**
 * 본문 행 — 주문·상품이 같은 높이·같은 hover 를 갖게 한다.
 *
 * 행 hover 는 넓은 표에서 눈이 가로로 이동할 때 줄을 놓치지 않게 해준다.
 * 터치에는 잔상이 남으므로 hover:hover 로 게이팅한다.
 */
export const dataTableRow =
  "border-b transition-colors duration-150 ease-out-strong last:border-0 hover:[@media(hover:hover)]:bg-muted/40";

/** 셀 기본 패딩 — 두 표의 행 높이를 맞추는 값 */
export const dataTableCell = "px-4 py-3";
