"use client";

import { Area, AreaChart, Tooltip, YAxis, type TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { formatDay, formatMoney } from "@/lib/format";

const DAY_MS = 86_400_000;

interface Point {
  priceCents: number;
  date: Date;
}

/**
 * 21-day price sparkline. Single series, so no legend: a muted 2px line with a 10% wash,
 * and an accent end-dot marking today. Hovering shows a crosshair and the day's price.
 * The tooltip only enhances: today's price and the trend are printed next to the chart.
 */
export function PriceSparkline({
  values,
  endDate,
  width = 112,
  height = 36,
}: {
  values: number[];
  endDate: Date;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const data: Point[] = values.map((priceCents, i) => ({
    priceCents,
    date: new Date(endDate.getTime() - (values.length - 1 - i) * DAY_MS),
  }));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(1, (max - min) * 0.15);
  const last = data.length - 1;
  const label = `Price over the last ${values.length - 1} days: from ${formatMoney(values[0])} to ${formatMoney(values[last])}, low ${formatMoney(min)}, high ${formatMoney(max)}.`;

  return (
    <div role="img" aria-label={label} className="shrink-0">
      <AreaChart width={width} height={height} data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <YAxis hide domain={[min - pad, max + pad]} />
        <Tooltip
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          isAnimationActive={false}
          allowEscapeViewBox={{ x: true, y: true }}
          content={SparkTooltip}
        />
        <Area
          type="linear"
          dataKey="priceCents"
          stroke="var(--muted-foreground)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="var(--muted-foreground)"
          fillOpacity={0.1}
          isAnimationActive={false}
          activeDot={{ r: 4, fill: "var(--eco)", stroke: "var(--card)", strokeWidth: 2 }}
          dot={(props: { cx?: number; cy?: number; index?: number }) =>
            props.index === last && props.cx != null && props.cy != null ? (
              <circle key="end" cx={props.cx} cy={props.cy} r={4} fill="var(--eco)" stroke="var(--card)" strokeWidth={2} />
            ) : (
              <g key={props.index} />
            )
          }
        />
      </AreaChart>
    </div>
  );
}

function SparkTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  return (
    <div className="rounded-md border bg-popover px-2 py-1 text-xs shadow-sm">
      <div className="font-semibold tabular-nums text-popover-foreground">{formatMoney(point.priceCents)}</div>
      <div className="text-muted-foreground">{formatDay(point.date)}</div>
    </div>
  );
}
