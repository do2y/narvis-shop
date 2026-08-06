"use client";

// 상품 정보 스펙 표 — label/value 행 목록. 계약 전이라 상위에서 rows 주입.
export function SpecTable({
  rows,
}: {
  rows: { label: string; value: string }[];
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">상품 정보</h2>
      <div className="overflow-hidden rounded-sm border">
        {/* 부차적 정보라 본문(text-sm)보다 한 단계 작게 — 표가 먼저 시선을 끌지 않게 한다 */}
        <table className="w-full table-auto text-xs">
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.label}>
                {/* 라벨 열은 기본 8rem, 더 긴 라벨이 있으면 줄바꿈 대신 그 라벨에 맞춰 늘어난다.
                    남는 폭은 값 열(w-full)이 가져가 라벨 열이 과하게 벌어지지 않는다 */}
                <th
                  scope="row"
                  className="min-w-32 bg-muted/40 px-4 py-2.5 text-left font-medium whitespace-nowrap text-muted-foreground"
                >
                  {row.label}
                </th>
                {/* 값은 반대로 줄바꿈시킨다. w-full로 남는 폭을 전부 가져가 라벨 열이
                    콘텐츠 폭 이상 벌어지지 않게 하고, break-words로 공백 없는 긴 문자열
                    (URL·모델명)이 열을 밀어내 표가 가로로 넘치는 것을 막는다 */}
                <td className="w-full px-4 py-2.5 break-words">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
