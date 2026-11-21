import Link from "next/link";
import { ArrowRightIcon, RouteArrowIcon } from "@/components/aa/icons";
import { ResultCard } from "@/components/search/result-card";
import { SearchHero } from "@/components/search/search-hero";
import { isoDay } from "@/lib/board";
import { formatCo2, formatDay } from "@/lib/format";
import { getProvider } from "@/lib/providers";
import type { PriceForecast } from "@/lib/pricing";
import { getSearchTargetLeg, getTripPicker } from "@/lib/queries";
import { SORT_MODES, type SortMode } from "@/lib/ranking";
import { runSearch } from "@/lib/search";
import { parseSearchParams, searchHref, type SearchQuery } from "@/lib/search-params";
import { getSimNow } from "@/lib/sim-clock";
import type { Station } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;
const SORT_LABEL: Record<SortMode, string> = { greenest: "Greenest", cheapest: "Cheapest", fastest: "Fastest" };
const TIME_WINDOWS = [
  { label: "Any time", after: null, before: null },
  { label: "Morning", after: "05:00", before: "11:59" },
  { label: "Afternoon", after: "12:00", before: "17:59" },
  { label: "Evening", after: "18:00", before: "23:59" },
] as const;

const POPULAR = [
  { from: "paris-nord", to: "amsterdam-centraal", fromCity: "Paris", toCity: "Amsterdam" },
  { from: "berlin-hbf", to: "paris-est", fromCity: "Berlin", toCity: "Paris" },
  { from: "paris-lyon", to: "barcelona-sants", fromCity: "Paris", toCity: "Barcelona" },
  { from: "amsterdam-centraal", to: "milano-centrale", fromCity: "Amsterdam", toCity: "Milan" },
];

const HOW = [
  { title: "Search greenest first", body: "Every option shows its CO₂ next to the price." },
  { title: "Pin it to a trip board", body: "Compare plans, add stops, things to do and a checklist." },
  { title: "Book when the price is right", body: "We alert you when a saved fare goes up or a cheaper one appears." },
];

const toOption = (s: Station | null | undefined) => (s ? { id: s.id, name: s.name, city: s.city, countryCode: s.countryCode } : null);

export default async function SearchPage({ searchParams }: PageProps<"/">) {
  const params = parseSearchParams(await searchParams);
  const simNow = await getSimNow();
  const provider = getProvider();

  // Opened from a trip leg ("Find options"): prefill from the leg and save straight back to it.
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
  const query: SearchQuery | null = origin && dest ? { ...params, originId: origin.id, destId: dest.id, date, travelers } : null;
  const response = query ? await runSearch(query, simNow) : null;

  const heading = targetLeg ? (
    <>
      <Link
        href={`/trips/${targetLeg.variant.tripId}?plan=${targetLeg.variantId}`}
        className="inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-[7px] text-xs font-extrabold tracking-[1.2px] text-lime uppercase no-underline hover:text-lime"
      >
        ← {targetLeg.variant.trip.name} · {targetLeg.variant.name}
      </Link>
      <h1 className="mt-4 mb-2.5 font-display-heavy text-[clamp(40px,7vw,64px)] leading-[0.95] tracking-[-2.5px] uppercase">
        Options for {targetLeg.origin.city} → {targetLeg.dest.city}
      </h1>
      <p className="m-0 mb-[30px] text-lg font-semibold text-sub">
        {formatDay(targetLeg.date)} · results you save go straight to this leg.
      </p>
    </>
  ) : undefined;

  return (
    <>
      <SearchHero
        key={`${origin?.id}-${dest?.id}-${date}-${travelers}`}
        initial={{ origin: toOption(origin), dest: toOption(dest), date, travelers }}
        sort={params.sort}
        filters={params}
        target={target}
        hasResults={!!response}
        heading={heading}
      />

      <main className="mx-auto box-border w-full max-w-[1280px] px-4 pt-11 pb-16 sm:px-8">
        {query && response && (
          <section aria-label="Results" className="mb-[52px]">
            <div className="mb-[18px] flex flex-wrap items-end gap-3.5">
              <div className="min-w-0 flex-[999_1_320px]">
                <div className="text-xs font-extrabold tracking-[1.2px] text-sub uppercase">Results</div>
                <h2 className="my-1 flex flex-wrap items-center gap-3 font-display-heavy text-[34px] leading-[1.05] tracking-[-0.8px]">
                  <span>{response.origin.city}</span>
                  <RouteArrowIcon />
                  <span>{response.dest.city}</span>
                </h2>
                <div className="text-sm font-semibold text-sub">
                  {formatDay(new Date(`${query.date}T00:00:00Z`))} · {query.travelers} {query.travelers === 1 ? "traveller" : "travellers"} ·{" "}
                  {response.results.length === response.totalUnfiltered
                    ? `${response.totalUnfiltered} options`
                    : `${response.results.length} of ${response.totalUnfiltered} options`}{" "}
                  · flying ≈ {formatCo2(response.flightCo2Grams)} CO₂ per person
                </div>
              </div>
              <nav aria-label="Sort results" className="inline-flex overflow-hidden rounded-xl border-2 border-ink bg-white">
                {SORT_MODES.map((s) => (
                  <Link
                    key={s}
                    href={searchHref({ ...query, sort: s, ...target })}
                    scroll={false}
                    aria-current={query.sort === s ? "true" : undefined}
                    className={cn(
                      "inline-flex min-h-[42px] items-center px-4 font-display-heavy text-[15px] no-underline",
                      query.sort === s ? "bg-ink text-white hover:text-white" : "bg-white text-ink hover:bg-mint hover:text-ink",
                    )}
                  >
                    {SORT_LABEL[s]}
                  </Link>
                ))}
              </nav>
            </div>

            <Filters query={query} target={target} />
            {response.results[0] && <Forecast forecast={response.results[0].forecast} date={response.results[0].departAt} />}

            {response.results.length === 0 ? (
              <div className="rounded-2xl border-2 border-ink bg-white p-8 text-center font-semibold text-sub">
                {response.totalUnfiltered > 0 ? "No options match these filters." : "No journeys found for this date and group size."}{" "}
                {response.totalUnfiltered > 0 && (
                  <Link href={searchHref({ ...query, modes: [], maxChanges: null, departAfter: null, departBefore: null, ...target })}>Clear filters</Link>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {response.results.map((r) => (
                  <ResultCard key={r.externalId} result={r} travelers={travelers} simNow={simNow} trips={trips} legId={target.legId} tripId={target.tripId} />
                ))}
              </div>
            )}
            <p className="mt-3 mb-0 text-xs font-semibold text-sub">
              Mock data. Pinned options get price alerts on your trip board. Operator badges mark where each company&apos;s logo goes.
            </p>
          </section>
        )}

        <h2 className="m-0 mb-4 font-display-heavy text-[28px] tracking-[-0.5px]">POPULAR ROUTES</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {POPULAR.map((r) => (
            <Link
              key={`${r.from}-${r.to}`}
              href={searchHref({ originId: r.from, destId: r.to, date, travelers })}
              className="flex flex-col gap-2.5 rounded-2xl border-2 border-ink bg-white px-[18px] py-4 text-center text-ink no-underline hover:bg-mint hover:text-ink"
            >
              <span className="flex flex-wrap items-center justify-center gap-2 font-display-heavy text-2xl leading-[1.1]">
                <span>{r.fromCity}</span>
                <RouteArrowIcon size={16} />
                <span>{r.toCity}</span>
              </span>
              <span className="text-[13px] font-bold text-green">Search this route</span>
            </Link>
          ))}
        </div>

        <h2 className="mt-12 mb-4 font-display-heavy text-[28px] tracking-[-0.5px]">HOW IT WORKS</h2>
        <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4 p-0">
          {HOW.map((h, i) => (
            <li key={h.title} className="flex items-start gap-3.5 rounded-2xl bg-mint p-[18px]">
              <span className="box-border flex size-11 flex-none items-center justify-center rounded-full border-2 border-ink bg-lime font-display-heavy text-lg">
                {i + 1}
              </span>
              <div>
                <div className="text-base font-extrabold">{h.title}</div>
                <div className="mt-0.5 text-sm text-sub">{h.body}</div>
              </div>
            </li>
          ))}
        </ol>
        <Link href="/trips" className="mt-8 inline-flex items-center gap-2 font-display-heavy text-lg">
          Go to your trips <ArrowRightIcon size={18} />
        </Link>
      </main>
    </>
  );
}

/** Direct-only and time-of-day chips (modes live in the search form). */
function Filters({ query, target }: { query: SearchQuery; target: { legId: string | null; tripId: string | null } }) {
  const href = (patch: Partial<SearchQuery>) => searchHref({ ...query, ...patch, ...target });
  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-9 items-center rounded-full border-2 border-ink px-3.5 text-[13px] font-bold no-underline",
      active ? "bg-ink text-white hover:text-white" : "bg-white text-ink hover:bg-mint hover:text-ink",
    );
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5" aria-label="Filters">
      <Link scroll={false} href={href({ maxChanges: query.maxChanges === 0 ? null : 0 })} aria-pressed={query.maxChanges === 0} className={chip(query.maxChanges === 0)}>
        Direct only
      </Link>
      <span className="mx-1 h-5 w-0.5 bg-line" aria-hidden />
      {TIME_WINDOWS.map((w) => {
        const active = query.departAfter === w.after && query.departBefore === w.before;
        return (
          <Link key={w.label} scroll={false} href={href({ departAfter: w.after, departBefore: w.before })} aria-pressed={active} className={chip(active)}>
            {w.label}
          </Link>
        );
      })}
    </div>
  );
}

/** The date-level price outlook (same for every result on a date). */
function Forecast({ forecast, date }: { forecast: PriceForecast; date: Date }) {
  const change = `${forecast.changePct > 0 ? "+" : ""}${Math.round(forecast.changePct)}%`;
  const day = formatDay(date);
  if (forecast.advice === "STABLE") {
    return (
      <p className="mb-[22px] rounded-xl border-2 border-ink bg-paper px-4 py-2.5 text-sm font-bold">
        Fares for {day} should stay stable over the next 2 weeks. No rush to book.
      </p>
    );
  }
  return (
    <p className={cn("mb-[22px] rounded-xl border-2 border-ink px-4 py-2.5 text-sm font-bold", forecast.advice === "BOOK_SOON" ? "bg-warn-bg text-warn" : "bg-paper")}>
      {forecast.advice === "BOOK_SOON" ? "Book soon: " : ""}fares for {day} typically rise {change} over the next 2 weeks.
    </p>
  );
}
