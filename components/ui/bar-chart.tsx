// Single-row bar, optionally split into segments (e.g. billable vs
// non-billable). `max` is passed in so a whole list of bars shares one
// scale — each bar can't compute a meaningful max from just itself.
export function Bar({
  label,
  sublabel,
  segments,
  max,
  displayValue,
}: {
  label: string;
  sublabel?: string;
  segments: { value: number; color: string }[];
  max: number;
  displayValue: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
        <span className="min-w-0 truncate font-medium text-fg">
          {label}
          {sublabel && <span className="ml-1.5 font-normal text-fg-subtle">{sublabel}</span>}
        </span>
        <span className="flex-none text-fg-muted">{displayValue}</span>
      </div>
      <div className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full bg-surface-3">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={seg.color}
            style={{ width: max > 0 ? `${Math.min(100, (seg.value / max) * 100)}%` : "0%" }}
          />
        ))}
      </div>
    </div>
  );
}
