import { Minus, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import { PriceSparkline } from "@/components/price-sparkline";
import { formatMoney } from "@/lib/format";
import type { PriceForecast } from "@/lib/pricing";

const pct = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n)}%`;

const money = (cents: number) => formatMoney(cents, "EUR", { decimals: true });

/** Price per person + group total, 21-day sparkline and 7-day trend. */
export function PriceInsight({
  priceCents,
  travelers,
  history,
  trendPct7d,
  simNow,
}: {
  priceCents: number;
  travelers: number;
  history: number[];
  trendPct7d: number;
  simNow: Date;
}) {
  const rounded = Math.round(trendPct7d);
  const TrendIcon = rounded > 0 ? TrendingUp : rounded < 0 ? TrendingDown : Minus;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold tabular-nums">{money(priceCents)}</div>
          <div className="text-xs text-muted-foreground">
            per person{travelers > 1 && ` · ${money(priceCents * travelers)} for ${travelers}`}
          </div>
        </div>
        <PriceSparkline values={history} endDate={simNow} />
      </div>
      <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <TrendIcon className="size-3.5" />
        {rounded === 0 ? "No change this week" : `${pct(trendPct7d)} this week`}
      </div>
    </div>
  );
}

/**
 * Where prices for a travel date are heading. The forecast depends on the date (demand
 * curve), not the individual journey, so it's shown once per search / per leg.
 */
export function ForecastBanner({ forecast, dateLabel }: { forecast: PriceForecast; dateLabel: string }) {
  const weeks = Math.round(forecast.horizonDays / 7);
  const when = `over the next ${weeks} week${weeks === 1 ? "" : "s"}`;
  const change = pct(forecast.changePct);
  switch (forecast.advice) {
    case "BOOK_SOON":
      return (
        <p className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <span>
            <span className="font-medium">Book soon.</span>{" "}
            <span className="text-muted-foreground">
              Fares for {dateLabel} typically rise {change} {when}.
            </span>
          </span>
        </p>
      );
    case "RISING":
      return (
        <p className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
          <TrendingUp className="mt-0.5 size-4 shrink-0" aria-hidden />
          Fares for {dateLabel} may rise {change} {when}.
        </p>
      );
    case "STABLE":
      return (
        <p className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
          <Minus className="mt-0.5 size-4 shrink-0" aria-hidden />
          Fares for {dateLabel} should stay stable {when}. No rush to book.
        </p>
      );
  }
}
