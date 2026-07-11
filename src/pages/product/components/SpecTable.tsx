// 상품 정보 스펙 표 — label/value 행 목록. 계약 전이라 상위에서 rows 주입.
export function SpecTable({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">상품 정보</h2>
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.label}>
                <th
                  scope="row"
                  className="w-32 bg-muted/40 px-4 py-3 text-left font-medium text-muted-foreground"
                >
                  {row.label}
                </th>
                <td className="px-4 py-3">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
