// URL <-> search query. No server imports: used by both server pages and client components.
import { DEFAULT_SORT, isSortMode, type SortMode } from "./ranking";
import { MODES, type Mode } from "./types";

export interface SearchFilters {
  /** Only journeys whose every segment uses one of these modes. Empty = all. */
  modes: Mode[];
  /** Maximum number of changes (0 = direct only). null = any. */
  maxChanges: number | null;
  /** Earliest / latest departure, "HH:mm". */
  departAfter: string | null;
  departBefore: string | null;
}

export interface SearchQuery extends SearchFilters {
  originId: string;
  destId: string;
  date: string; // YYYY-MM-DD
  travelers: number;
  sort: SortMode;
}

/** Where saving a result should go, when search was opened from a trip. */
export interface SearchTarget {
  legId: string | null;
  tripId: string | null;
}

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Parse URL params. Returns null fields for anything missing or invalid. */
export function parseSearchParams(raw: RawParams): Partial<SearchQuery> & SearchFilters & SearchTarget & { sort: SortMode } {
  const date = first(raw.date);
  const travelers = Number(first(raw.travelers));
  const sort = first(raw.sort);
  const modes = (first(raw.modes) ?? "")
    .split(",")
    .map((m) => m.toUpperCase())
    .filter((m): m is Mode => (MODES as readonly string[]).includes(m));
  const maxChangesRaw = first(raw.maxChanges);
  const maxChanges = maxChangesRaw != null && /^\d$/.test(maxChangesRaw) ? Number(maxChangesRaw) : null;
  const after = first(raw.after);
  const before = first(raw.before);

  return {
    originId: first(raw.from) ?? undefined,
    destId: first(raw.to) ?? undefined,
    date: date && DATE_RE.test(date) ? date : undefined,
    travelers: Number.isInteger(travelers) && travelers >= 1 && travelers <= 9 ? travelers : undefined,
    sort: isSortMode(sort) ? sort : DEFAULT_SORT,
    modes,
    maxChanges,
    departAfter: after && TIME_RE.test(after) ? after : null,
    departBefore: before && TIME_RE.test(before) ? before : null,
    legId: first(raw.leg),
    tripId: first(raw.trip),
  };
}

/** Build a /search URL. Omits defaults to keep links short. */
export function searchHref(q: Partial<SearchQuery> & Partial<SearchTarget>): string {
  const p = new URLSearchParams();
  if (q.originId) p.set("from", q.originId);
  if (q.destId) p.set("to", q.destId);
  if (q.date) p.set("date", q.date);
  if (q.travelers) p.set("travelers", String(q.travelers));
  if (q.sort && q.sort !== DEFAULT_SORT) p.set("sort", q.sort);
  if (q.modes?.length) p.set("modes", q.modes.join(",").toLowerCase());
  if (q.maxChanges != null) p.set("maxChanges", String(q.maxChanges));
  if (q.departAfter) p.set("after", q.departAfter);
  if (q.departBefore) p.set("before", q.departBefore);
  if (q.legId) p.set("leg", q.legId);
  if (q.tripId) p.set("trip", q.tripId);
  const qs = p.toString();
  return qs ? `/search?${qs}` : "/search";
}
