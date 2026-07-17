import { cn } from "@/lib/utils";

interface StatusTabsProps<T extends string> {
  tabs: { key: T; label: string; count?: number; alert?: boolean }[];
  value: T;
  onChange: (key: T) => void;
}

/** 목록 상단 상태 탭 — 주문·상품 목록 공용 */
export function StatusTabs<T extends string>({
  tabs,
  value,
  onChange,
}: StatusTabsProps<T>) {
  return (
    <div className="-mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      <div className="flex gap-1">
        {tabs.map((t) => {
          const active = t.key === value;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm transition-colors",
                active
                  ? "border-foreground font-bold text-foreground"
                  : "border-transparent font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    t.alert
                      ? "bg-destructive/10 text-destructive"
                      : active
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
