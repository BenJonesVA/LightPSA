// Grouped vertical columns for a small time series (e.g. tickets
// created vs. resolved per week). Deliberately not a real charting
// library — this is the same hand-rolled-div approach as Bar, just
// oriented the other way.
export function ColumnChart({
  data,
}: {
  data: { label: string; series: { value: number; color: string }[] }[];
}) {
  const max = Math.max(1, ...data.flatMap((d) => d.series.map((s) => s.value)));

  return (
    <div className="flex items-end gap-4 px-2">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-32 items-end gap-1">
            {d.series.map((s, i) => (
              <div
                key={i}
                className={`w-3 rounded-t-sm ${s.color}`}
                style={{ height: s.value === 0 ? "0%" : `${Math.max(2, (s.value / max) * 100)}%` }}
                title={String(s.value)}
              />
            ))}
          </div>
          <span className="text-[10.5px] text-fg-subtle">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
