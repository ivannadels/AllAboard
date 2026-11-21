import { ArrowRightIcon, ChevronDownIcon, LeafIcon, ModeGlyph, MODE_NAME } from "@/components/aa/icons";
import { OperatorBadge } from "@/components/aa/operator-badge";
import { PriceSparkline } from "@/components/price-sparkline";
import { AddToTripDialog, SaveToLegButton } from "@/components/search/add-to-trip";
import { formatCo2, formatDuration, formatMoney, formatTime } from "@/lib/format";
import type { TripPicker } from "@/lib/queries";
import type { SearchResult } from "@/lib/search";

const BADGE_TEXT = { greenest: "GREENEST", cheapest: "CHEAPEST", fastest: "FASTEST" } as const;
const DAY_MS = 86_400_000;
const eur = (cents: number) => formatMoney(cents, "EUR", { decimals: true });

function dayDiff(a: Date, b: Date) {
  return Math.round(
    (Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) - Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())) / DAY_MS,
  );
}

/** One search result in the template's card layout, plus the price-insight strip. */
export function ResultCard({
  result: r,
  travelers,
  simNow,
  trips,
  legId,
  tripId,
}: {
  result: SearchResult;
  travelers: number;
  simNow: Date;
  trips: TripPicker;
  legId: string | null;
  tripId: string | null;
}) {
  const first = r.segments[0];
  const last = r.segments[r.segments.length - 1];
  const plus = dayDiff(r.departAt, r.arriveAt);
  const vias = r.segments.slice(0, -1).map((s) => s.dest.city);
  const changes = r.changes === 0 ? "Direct" : `${r.changes} ${r.changes === 1 ? "change" : "changes"} · ${vias.join(", ")}`;
  const trend = Math.round(r.trendPct7d);
  const journeyRef = { externalId: r.externalId, departAt: r.departAt, originCity: first.origin.city, destCity: last.dest.city, seatsLeft: r.seatsLeft };
  const savedPct = Math.round(r.co2SavedPct);

  return (
    <article className="relative rounded-2xl border-2 border-ink bg-white">
      {r.badges.length > 0 && (
        <span className="absolute -top-3 left-4 rounded-full border-2 border-ink bg-lime px-2.5 py-0.5 text-[11px] font-extrabold tracking-[0.8px]">
          {r.badges.map((b) => BADGE_TEXT[b]).join(" · ")}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-x-[26px] gap-y-3.5 px-[18px] pt-[18px] pb-4">
        <div className="flex flex-[0_0_190px] items-center gap-3">
          <OperatorBadge operator={r.operator} />
          <div className="min-w-0">
            <div className="text-[15.5px] font-extrabold">{r.operator}</div>
            <div className="mt-0.5 inline-flex items-center gap-[5px] text-[13px] font-semibold text-sub">
              <ModeGlyph mode={r.mode} size={15} />
              {MODE_NAME[r.mode]}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-[1_1_320px] items-center gap-3.5">
          <div>
            <div className="font-display-heavy text-[30px] leading-none">{formatTime(r.departAt)}</div>
            <div className="mt-1 text-[12.5px] font-semibold text-sub">{first.origin.name}</div>
          </div>
          <div className="min-w-20 flex-1 text-center">
            <div className="text-[13px] font-extrabold">{formatDuration(r.durationMin)}</div>
            <div aria-hidden="true" className="my-[5px] flex items-center">
              <span className="box-border size-2 rounded-full border-2 border-ink" />
              <span className="h-0.5 flex-1 bg-ink" />
              {r.segments.slice(0, -1).map((s, i) => (
                <span key={i} className="contents">
                  <span className="box-border size-2 rounded-full border-2 border-ink bg-lime" title={`Change at ${s.dest.name}`} />
                  <span className="h-0.5 flex-1 bg-ink" />
                </span>
              ))}
              <span className="size-2 rounded-full bg-ink" />
            </div>
            <div className="text-[12.5px] font-semibold text-sub">{changes}</div>
          </div>
          <div className="text-right">
            <div className="font-display-heavy text-[30px] leading-none">
              {formatTime(r.arriveAt)}
              {plus > 0 && <sup className="text-sm" title="Arrives the next day">+{plus}</sup>}
            </div>
            <div className="mt-1 text-[12.5px] font-semibold text-sub">{last.dest.name}</div>
          </div>
        </div>

        <div className="flex flex-col items-start gap-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-[7px] text-[13px] font-extrabold whitespace-nowrap">
            <LeafIcon size={15} className="text-green" />
            {formatCo2(r.co2Grams)} CO₂e
          </span>
          {savedPct > 0 && <span className="pl-1 text-xs font-bold text-sub">{savedPct}% less than flying</span>}
        </div>

        <div className="min-w-[92px] text-right">
          <div className="font-display-heavy text-[32px] leading-none">{eur(r.priceCents)}</div>
          <div className="mt-[3px] text-xs font-semibold text-sub">
            per person{travelers > 1 ? ` · ${eur(r.priceCents * travelers)} total` : ""}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {legId ? <SaveToLegButton journey={journeyRef} legId={legId} /> : <AddToTripDialog journey={journeyRef} trips={trips} defaultTripId={tripId} />}
          <a
            href={r.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Book ${r.operator} ${formatTime(r.departAt)} for ${eur(r.priceCents)} (mock link)`}
            className="box-border inline-flex min-h-[46px] min-w-24 items-center justify-center gap-1.5 rounded-xl border-2 border-ink bg-ink px-[18px] font-display-heavy text-[15px] text-white no-underline hover:text-lime"
          >
            Book <ArrowRightIcon size={16} />
          </a>
        </div>
      </div>

      {/* Price insight + journey details */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-b-[14px] border-t-2 border-dashed border-dots bg-paper px-[18px] py-2">
        <PriceSparkline values={r.history} endDate={simNow} width={96} height={28} />
        <span className="text-xs font-bold">{trend === 0 ? "No price change this week" : `${trend > 0 ? "+" : ""}${trend}% this week`}</span>
        {r.seatsLeft != null && r.seatsLeft <= 5 && <span className="text-xs font-bold text-warn">Only {r.seatsLeft} seats left</span>}
        <div className="flex-1" />
        {r.segments.length > 1 && (
          <details className="group text-xs">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-extrabold [&::-webkit-details-marker]:hidden">
              <ChevronDownIcon size={13} className="transition-transform group-open:rotate-180" />
              Journey details
            </summary>
            <ol className="mt-2 mb-1 grid gap-1 pl-4 font-semibold text-sub">
              {r.segments.map((s, i) => (
                <li key={i}>
                  <span className="font-extrabold text-ink">
                    {formatTime(s.departAt)}–{formatTime(s.arriveAt)}
                  </span>{" "}
                  {s.origin.name} → {s.dest.name} · {s.operator}
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </article>
  );
}
