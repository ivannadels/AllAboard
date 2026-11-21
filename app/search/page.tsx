import { ArrowLeft, Plane, SearchX } from "lucide-react";
import Link from "next/link";
import { Co2Meter } from "@/components/co2-meter";
import { JourneySummary } from "@/components/journey-summary";
import { MODE_LABEL, ModeIcon } from "@/components/mode-icon";
import { OptionBadges } from "@/components/option-badges";
import { ForecastBanner, PriceInsight } from "@/components/price-insight";
import { AddToTripDialog, SaveToLegButton } from "@/components/search/add-to-trip";
import { SearchForm } from "@/components/search/search-form";
import { Card, CardContent } from "@/components/ui/card";
import { formatCo2, formatDay } from "@/lib/format";
import { isoDay } from "@/lib/itinerary";
import { getProvider } from "@/lib/providers";
import { getSearchTargetLeg, getTripPicker, type TripPicker } from "@/lib/queries";
import { SORT_MODES, type SortMode } from "@/lib/ranking";
import { runSearch, type SearchResult } from "@/lib/search";
import { parseSearchParams, searchHref, type SearchQuery } from "@/lib/search-params";
import { getSimNow } from "@/lib/sim-clock";
import type { Mode, Station } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

const SORT_LABEL: Record<SortMode, string> = { greenest: "Greenest", cheapest: "Cheapest", fastest: "Fastest" };
const FILTER_MODES: Mode[] = ["TRAIN", "BUS", "CARSHARE"];
const TIME_WINDOWS = [
  { label: "Any time", after: null, before: null },
  { label: "Morning", after: "05:00", before: "11:59" },
  { label: "Afternoon", after: "12:00", before: "17:59" },
  { label: "Evening", after: "18:00", before: "23:59" },
] as const;

const SUGGESTIONS = [
  { from: "paris-nord", to: "amsterdam-centraal", label: "Paris → Amsterdam" },
  { from: "berlin-hbf", to: "paris-est", label: "Berlin → Paris" },
  { from: "paris-lyon", to: "barcelona-sants", label: "Paris → Barcelona" },
  { from: "amsterdam-centraal", to: "milano-centrale", label: "Amsterdam → Milan" },
];

const toOption = (s: Station | null | undefined) =>
  s ? { id: s.id, name: s.name, city: s.city, countryCode: s.countryCode } : null;

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const params = parseSearchParams(await searchParams);
  const simNow = await getSimNow();
  const provider = getProvider();

  // Opened from a trip leg: prefill from the leg and save straight back to it.
  const targetLeg = params.legId ? await getSearchTargetLeg(params.legId) : null;
  const originId = params.originId ?? targetLeg?.originStationId;
  const destId = params.destId ?? targetLeg?.destStationId;
  const date = params.date ?? (targetLeg ? isoDay(targetLeg.date) : isoDay(new Date(simNow.getTime() + 30 * DAY_MS)));
  const travelers = params.travelers ?? targetLeg?.variant.trip.travelers ?? 1;
  const target = { legId: targetLeg?.id ?? null, tripId: targetLeg?.variant.tripId ?? params.tripId };

  const [origin, dest, trips] = await Promise.all([
    originId ? provider.getStation(originId) : null,
    destId ? provider.getStation(destId) : null,
    getTripPicker(),
  ]);

  const query: SearchQuery | null =
    origin && dest ? { ...params, originId: origin.id, destId: dest.id, date, travelers } : null;
  const response = query ? await runSearch(query, simNow) : null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        {targetLeg ? (
          <>
            <Link
              href={`/trips/${targetLeg.variant.tripId}?plan=${targetLeg.variantId}`}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              {targetLeg.variant.trip.name}
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight">
              Options for {targetLeg.origin.city} → {targetLeg.dest.city}
            </h1>
            <p className="text-sm text-muted-foreground">
              {targetLeg.variant.name} · {formatDay(targetLeg.date)} · saved results go straight to this leg
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Find a journey</h1>
            <p className="text-sm text-muted-foreground">
              Trains, buses and car shares across Europe, ranked greenest first. Never flights.
            </p>
          </>
        )}
      </div>

      <SearchForm
        key={`${origin?.id}-${dest?.id}-${date}-${travelers}`}
        initial={{ origin: toOption(origin), dest: toOption(dest), date, travelers }}
        sort={params.sort}
        filters={params}
        target={target}
      />

      {!query && <EmptyState date={date} />}

      {query && response && (
        <div className="space-y-4">
          <ResultsHeader query={query} origin={response.origin} dest={response.dest} shown={response.results.length} total={response.totalUnfiltered} flightCo2Grams={response.flightCo2Grams} />
          {response.results[0] && (
            <ForecastBanner forecast={response.results[0].forecast} dateLabel={formatDay(response.results[0].departAt)} />
          )}
          <Controls query={query} target={target} />

          {response.results.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <SearchX className="size-6" />
                {response.totalUnfiltered > 0
                  ? "No journeys match these filters."
                  : "No journeys found for this date and group size."}
                {response.totalUnfiltered > 0 && (
                  <Link className="text-foreground underline underline-offset-4" href={searchHref({ ...query, modes: [], maxChanges: null, departAfter: null, departBefore: null, ...target })}>
                    Clear filters
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            <ol className="space-y-3">
              {response.results.map((r) => (
                <li key={r.externalId}>
                  <ResultCard result={r} travelers={travelers} simNow={simNow} trips={trips} legId={target.legId} tripId={target.tripId} />
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function ResultsHeader({
  query,
  origin,
  dest,
  shown,
  total,
  flightCo2Grams,
}: {
  query: SearchQuery;
  origin: Station;
  dest: Station;
  shown: number;
  total: number;
  flightCo2Grams: number;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold">
          {origin.city} → {dest.city}
        </h2>
        <p className="text-sm text-muted-foreground">
          {formatDay(new Date(`${query.date}T00:00:00Z`))} · {query.travelers} {query.travelers === 1 ? "traveler" : "travelers"} ·{" "}
          {shown === total ? `${total} journeys` : `showing ${shown} of ${total} journeys`}
        </p>
      </div>
      <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Plane className="size-4" aria-hidden />
        Flying would emit about <span className="font-medium text-foreground">{formatCo2(flightCo2Grams)}</span> per person
      </p>
    </div>
  );
}

/** Sort tabs and filter chips, as links: the URL is the state. */
function Controls({ query, target }: { query: SearchQuery; target: { legId: string | null; tripId: string | null } }) {
  const href = (patch: Partial<SearchQuery>) => searchHref({ ...query, ...patch, ...target });
  const toggleMode = (m: Mode) =>
    query.modes.includes(m) ? query.modes.filter((x) => x !== m) : [...query.modes, m];

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <nav aria-label="Sort" className="inline-flex rounded-lg bg-muted p-1">
        {SORT_MODES.map((s) => (
          <Link
            key={s}
            href={href({ sort: s })}
            aria-current={query.sort === s ? "true" : undefined}
            className={cn(
              "rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground",
              query.sort === s && "bg-background font-medium text-foreground shadow-sm",
            )}
          >
            {SORT_LABEL[s]}
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-1.5" aria-label="Filters">
        {FILTER_MODES.map((m) => (
          <Chip key={m} href={href({ modes: toggleMode(m) })} active={query.modes.includes(m)}>
            <ModeIcon mode={m} className="size-3.5" />
            {MODE_LABEL[m]}
          </Chip>
        ))}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <Chip href={href({ maxChanges: query.maxChanges === 0 ? null : 0 })} active={query.maxChanges === 0}>
          Direct only
        </Chip>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        {TIME_WINDOWS.map((w) => (
          <Chip
            key={w.label}
            href={href({ departAfter: w.after, departBefore: w.before })}
            active={query.departAfter === w.after && query.departBefore === w.before}
          >
            {w.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
      )}
    >
      {children}
    </Link>
  );
}

function ResultCard({
  result,
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
  const first = result.segments[0];
  const last = result.segments[result.segments.length - 1];
  const journeyRef = {
    externalId: result.externalId,
    departAt: result.departAt,
    originCity: first.origin.city,
    destCity: last.dest.city,
    seatsLeft: result.seatsLeft,
  };
  const lowSeats = result.seatsLeft != null && result.seatsLeft <= 5;

  return (
    <Card className={cn("py-4", result.badges.includes("greenest") && "ring-1 ring-eco/40")}>
      <CardContent className="grid gap-4 px-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_9rem] md:items-start">
        <div className="space-y-2">
          <OptionBadges badges={result.badges} />
          <JourneySummary journey={result} />
        </div>

        <Co2Meter co2Grams={result.co2Grams} flightCo2Grams={result.flightCo2Grams} className="md:pt-7" />

        <div className="md:pt-6">
          <PriceInsight
            priceCents={result.priceCents}
            travelers={travelers}
            history={result.history}
            trendPct7d={result.trendPct7d}
            simNow={simNow}
          />
        </div>

        <div className="space-y-2 md:pt-6">
          {legId ? <SaveToLegButton journey={journeyRef} legId={legId} /> : <AddToTripDialog journey={journeyRef} trips={trips} defaultTripId={tripId} />}
          {lowSeats && <p className="text-center text-xs text-muted-foreground">Only {result.seatsLeft} seats left</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ date }: { date: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Popular routes</p>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <Link
            key={s.label}
            href={searchHref({ originId: s.from, destId: s.to, date, travelers: 1 })}
            className="rounded-full border px-3 py-1.5 text-sm hover:bg-accent"
          >
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
