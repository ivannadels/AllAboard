import { flightCounterfactualGrams } from "./co2";
import { journeyPriceHistory, priceForecast, trendPct, type PriceForecast } from "./pricing";
import { getProvider } from "./providers";
import { computeBadges, rankOptions, type Badge } from "./ranking";
import type { SearchFilters, SearchQuery } from "./search-params";
import type { OptionDraft, Station } from "./types";

/** A provider result enriched for display: badges, price insight, vs-flying. */
export interface SearchResult extends OptionDraft {
  badges: Badge[];
  /** Daily per-traveler prices for the last 21 days, oldest first; last = today. */
  history: number[];
  /** % change over the last 7 days. */
  trendPct7d: number;
  forecast: PriceForecast;
  /** CO2 per traveler had this trip been flown. */
  flightCo2Grams: number;
  /** % less CO2 than flying (positive = saving). */
  co2SavedPct: number;
}

export interface SearchResponse {
  origin: Station;
  dest: Station;
  results: SearchResult[];
  /** Results before filters, to show "showing 6 of 11". */
  totalUnfiltered: number;
  flightCo2Grams: number;
}

const HISTORY_DAYS = 21;

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export function applyFilters<T extends OptionDraft>(drafts: T[], f: SearchFilters): T[] {
  return drafts.filter((d) => {
    if (f.modes.length && !d.segments.every((s) => f.modes.includes(s.mode))) return false;
    if (f.maxChanges != null && d.changes > f.maxChanges) return false;
    const departMin = d.departAt.getUTCHours() * 60 + d.departAt.getUTCMinutes();
    if (f.departAfter && departMin < toMinutes(f.departAfter)) return false;
    if (f.departBefore && departMin > toMinutes(f.departBefore)) return false;
    return true;
  });
}

/** Enrich one draft with price insight and flight comparison. */
export function enrich(draft: OptionDraft, flightCo2Grams: number, now: Date): Omit<SearchResult, "badges"> {
  const journey = { segments: draft.segments.map((s) => ({ ...s })) };
  const history = journeyPriceHistory(journey, now, { days: HISTORY_DAYS }).map((p) => p.priceCents);
  return {
    ...draft,
    history,
    trendPct7d: trendPct(history, 7),
    forecast: priceForecast(journey, now),
    flightCo2Grams,
    co2SavedPct: flightCo2Grams > 0 ? ((flightCo2Grams - draft.co2Grams) / flightCo2Grams) * 100 : 0,
  };
}

/** Run a search: provider → filters → enrichment → badges → ranking. */
export async function runSearch(q: SearchQuery, now: Date): Promise<SearchResponse | null> {
  const provider = getProvider();
  const [origin, dest] = await Promise.all([provider.getStation(q.originId), provider.getStation(q.destId)]);
  if (!origin || !dest) return null;

  const drafts = await provider.searchJourneys({
    originId: q.originId,
    destId: q.destId,
    date: q.date,
    travelers: q.travelers,
    now,
  });
  const flightCo2Grams = flightCounterfactualGrams(origin, dest, 1);
  const filtered = applyFilters(drafts, q).map((d) => enrich(d, flightCo2Grams, now));
  const badges = computeBadges(filtered);
  const results = rankOptions(
    filtered.map((r) => ({ ...r, badges: badges.get(r) ?? [] })),
    q.sort,
  );

  return { origin, dest, results, totalUnfiltered: drafts.length, flightCo2Grams };
}
