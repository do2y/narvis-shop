"use client";

import { Section } from "./Section";

/**
 * 상품 정보 — label/value 목록.
 *
 * 종전에는 외곽 border + 셀마다 divide + 라벨 열 회색 배경의 `<table>` 이었다.
 * 그 조합은 관리자 화면의 데이터 그리드 언어라, 상품을 소개하는 자리에서는
 * "표를 읽어야 하는 화면"처럼 느껴진다. 칸을 그리지 않아도 정보는 전달된다 —
 * 정렬만 정확하면 된다(§16 단순함: 요소마다 제 자리를 벌어야 한다).
 *
 * `<table>` 대신 `<dl>` 을 쓴다. 이건 행·열로 교차 조회하는 격자가 아니라
 * "이름과 값" 쌍의 목록이라, dl 이 구조를 정확히 말한다.
 *
 * PC 2열: 정보가 4~6줄이면 1열로는 오른쪽이 통째로 비어 페이지가 성기게 보인다.
 * 다만 항목이 3개 이하일 때는 2열로 쪼개면 한쪽만 남아 되레 어색해 1열로 둔다.
 */
export function SpecTable({
  rows,
}: {
  rows: { label: string; value: string }[];
}) {
  const twoColumn = rows.length > 3;

  return (
    <Section title="상품 정보">
      {/* 위쪽 경계선 하나로 목록의 시작을 알린다 — 외곽을 두르지 않아도
          "여기서부터 정보"가 읽힌다. 행 사이는 아래 border-b 가 맡는다. */}
      <dl
        className={
          twoColumn
            ? "grid grid-cols-1 gap-x-10 border-t sm:grid-cols-2"
            : "grid grid-cols-1 border-t"
        }
      >
        {rows.map((row) => (
          // 라벨과 값을 한 행에 묶는다. grid 부모 안에서 각 쌍이 독립된 셀이 되도록
          // div 로 감싼다 — dt/dd 를 직접 grid 자식으로 두면 2열에서 라벨과 값이
          // 서로 다른 열로 흩어진다.
          <div
            key={row.label}
            className="flex items-start gap-4 border-b py-3.5 text-sm"
          >
            {/* 라벨은 고정 폭 — 값의 좌측 정렬선이 행마다 흔들리면 목록으로 안 읽힌다.
                줄바꿈을 막아 두 줄짜리 라벨이 생기지 않게 한다. */}
            <dt className="w-24 shrink-0 text-muted-foreground">{row.label}</dt>
            {/* break-words: 공백 없는 긴 문자열(URL·모델명)이 열을 밀어내
                가로 스크롤이 생기는 것을 막는다(종전 표에서와 같은 이유). */}
            <dd className="min-w-0 flex-1 break-words">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
