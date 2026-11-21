import { formatCo2 } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * CO2 of a journey against the flight it replaces, as a meter: the track is the flight,
 * the fill is this journey. Values are printed as text; the bar is the glance.
 */
export function Co2Meter({
  co2Grams,
  flightCo2Grams,
  className,
}: {
  co2Grams: number;
  flightCo2Grams: number;
  className?: string;
}) {
  const ratio = flightCo2Grams > 0 ? Math.min(1, co2Grams / flightCo2Grams) : 0;
  const savedPct = Math.round((1 - ratio) * 100);
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold tabular-nums text-foreground">{formatCo2(co2Grams)} CO2</span>
        <span className="truncate text-muted-foreground">
          {savedPct > 0 ? `${savedPct}% less than flying` : "Same as flying"}
        </span>
      </div>
      <div
        role="meter"
        aria-label={`CO2 compared with flying: ${formatCo2(co2Grams)} versus ${formatCo2(flightCo2Grams)} by plane`}
        aria-valuemin={0}
        aria-valuemax={flightCo2Grams}
        aria-valuenow={co2Grams}
        className="h-2 w-full overflow-hidden rounded-full bg-eco-soft"
      >
        <div className="h-full rounded-full bg-eco" style={{ width: `${Math.max(2, ratio * 100)}%` }} />
      </div>
      <div className="text-right text-[11px] text-muted-foreground">Flight: {formatCo2(flightCo2Grams)}</div>
    </div>
  );
}
