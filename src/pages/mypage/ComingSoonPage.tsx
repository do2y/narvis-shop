// 아직 미구현인 마이페이지 하위 메뉴 공통 placeholder.
// 각 라우트에서 title만 주입해 재사용.
export default function ComingSoonPage({ title }: { title: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-5 flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center">
        <p className="text-sm font-medium">준비 중인 메뉴예요</p>
        <p className="text-sm text-muted-foreground">곧 만나보실 수 있어요.</p>
      </div>
    </div>
  );
}
