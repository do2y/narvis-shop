import { cn } from "@/lib/utils";
import type { BrandCategory } from "../types";

// 카테고리 칩 — brand.categories(서버가 준 필터 축)를 그대로 쓴다.
// 선택 시 카테고리 ID를 쿼리로 보내 서버가 필터링한다.
export function CategoryFilter({
  categories,
  selected,
  onSelect,
}: {
  categories: BrandCategory[];
  selected: number | null;
  onSelect: (categoryId: number | null) => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex w-max gap-2">
        <Chip active={selected === null} onClick={() => onSelect(null)}>
          전체
        </Chip>
        {categories.map((category) => (
          <Chip
            key={category.id}
            active={selected === category.id}
            onClick={() => onSelect(category.id)}
          >
            {category.name}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        // press 즉시 반응(apple-design §1). reduced-motion에선 스케일 없이 색만 바뀐다
        "h-11 shrink-0 rounded-full border px-5 text-sm font-medium transition duration-100 ease-out active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100",
        active
          ? "border-foreground bg-foreground text-background"
          : "bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
