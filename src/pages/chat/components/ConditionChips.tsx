interface ConditionChipsProps {
  conditions: string[];
}

// AI가 추출한 조건을 표시. 조건 완화는 suggestions 이벤트가 담당하므로 여기선 표시 전용.
export function ConditionChips({ conditions }: ConditionChipsProps) {
  if (conditions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {conditions.map((c) => (
        <span
          key={c}
          className="animate-in rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground duration-200 fade-in zoom-in-95"
        >
          {c}
        </span>
      ))}
    </div>
  );
}
