import networkFixture from "@/data/fixtures/network.json";
import stationsFixture from "@/data/fixtures/stations.json";
import { co2Grams } from "../co2";
import { greatCircleKm } from "../geo";
import { hash01, priceAt } from "../pricing";
import { normalize, slugify } from "../text";
import { MODES, type Mode, type OptionDraft, type SegmentDraft, type Station, type StationRef } from "../types";
import type { JourneySearchParams, TransportProvider } from "./types";

// ---------------------------------------------------------------------------
// Fixture loading
// ---------------------------------------------------------------------------

interface FixtureService {
  mode: Mode;
  operator: string;
  km: number;
  min: number;
  dep: string[];
  depBA?: string[];
  seats?: Record<string, number>;
}

interface FixtureLink {
  a: string;
  b: string;
  services: FixtureService[];
}

/** A daily timetabled departure from one station to another. */
interface Departure {
  from: Station;
  to: Station;
  mode: Mode;
  operator: string;
  km: number;
  min: number;
  time: string; // HH:mm
  seats: number | null;
}

/** A departure on a concrete date. */
interface Leg {
  dep: Departure;
  departAt: Date;
  arriveAt: Date;
}

const STATIONS = stationsFixture as Station[];
const STATION_BY_ID = new Map(STATIONS.map((s) => [s.id, s]));
const LINKS = (networkFixture as { links: FixtureLink[] }).links;

/** Routing limits. */
export const MAX_CHANGES = 2;
const MIN_TRANSFER_SAME_STATION_MIN = 15;
const MIN_TRANSFER_CROSS_CITY_MIN = 60;
const MAX_JOURNEY_MIN = 16 * 60;
const MAX_RESULTS = 24;
/** Car shares are only generated for direct pairs within this range. */
const CARSHARE_MAX_KM = 1300;

const slug = slugify;

const cityKey = (s: Station) => normalize(s.city);
const ref = (s: Station): StationRef => ({ id: s.id, name: s.name, city: s.city });

function defaultSeats(mode: Mode, key: string): number | null {
  const h = hash01(`${key}|seats`);
  switch (mode) {
    case "TRAIN":
      return 8 + Math.floor(h * 55);
    case "BUS":
      return 5 + Math.floor(h * 35);
    case "CARSHARE":
      return 3;
    case "BIKE":
      return null;
  }
}

function buildIndex(): Map<string, Departure[]> {
  const index = new Map<string, Departure[]>();
  const add = (d: Departure) => {
    const list = index.get(d.from.id) ?? [];
    list.push(d);
    index.set(d.from.id, list);
  };
  for (const link of LINKS) {
    const a = STATION_BY_ID.get(link.a);
    const b = STATION_BY_ID.get(link.b);
    if (!a || !b) throw new Error(`network.json: unknown station in link ${link.a} ↔ ${link.b}`);
    for (const svc of link.services) {
      if (!MODES.includes(svc.mode)) continue; // ground modes only; never flights
      const directions: [Station, Station, string[]][] = [
        [a, b, svc.dep],
        [b, a, svc.depBA ?? svc.dep],
      ];
      for (const [from, to, times] of directions) {
        for (const time of times) {
          const key = `${from.id}>${to.id}@${time}:${slug(svc.operator)}`;
          add({
            from,
            to,
            mode: svc.mode,
            operator: svc.operator,
            km: svc.km,
            min: svc.min,
            time,
            seats: svc.seats?.[time] ?? defaultSeats(svc.mode, key),
          });
        }
      }
    }
  }
  return index;
}

const INDEX = buildIndex();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function atLocalTime(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00.000Z`); // floating local time stored as UTC
}

function onDate(dep: Departure, date: string): Leg {
  const departAt = atLocalTime(date, dep.time);
  return { dep, departAt, arriveAt: new Date(departAt.getTime() + dep.min * 60_000) };
}

function segmentKey(d: Departure): string {
  return `${d.from.id}>${d.to.id}@${d.time.replace(":", "")}:${slug(d.operator)}`;
}

function stationsInCity(city: string): Station[] {
  return STATIONS.filter((s) => cityKey(s) === city);
}

/**
 * Generic direct services for pairs the network doesn't cover: a car share for any pair
 * in range, plus rail and bus when the pair isn't reachable at all. Deterministic per pair.
 */
function synthesize(origin: Station, dest: Station, opts: { railAndBus: boolean }): Departure[] {
  const gc = greatCircleKm(origin, dest);
  if (gc < 15) return [];
  const rail = Math.round(gc * 1.2);
  const road = Math.round(gc * 1.25);
  const pairKey = `${origin.id}>${dest.id}`;
  const minute = (salt: string) => String(Math.floor(hash01(pairKey + salt) * 12) * 5).padStart(2, "0");
  const out: Departure[] = [];
  if (gc <= CARSHARE_MAX_KM) {
    out.push({ from: origin, to: dest, mode: "CARSHARE", operator: "BlaBlaCar", km: road, min: Math.round((road / 85) * 60 + 15), time: `10:${minute("d")}`, seats: 3 });
  }
  if (opts.railAndBus) {
    out.push(
      { from: origin, to: dest, mode: "TRAIN", operator: "Regional rail", km: rail, min: Math.round((rail / 120) * 60 + 25), time: `08:${minute("a")}`, seats: 40 },
      { from: origin, to: dest, mode: "TRAIN", operator: "Regional rail", km: rail, min: Math.round((rail / 110) * 60 + 30), time: `14:${minute("b")}`, seats: 18 },
      { from: origin, to: dest, mode: "BUS", operator: "FlixBus", km: road, min: Math.round((road / 65) * 60 + 20), time: `09:${minute("c")}`, seats: 30 },
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/**
 * Finds journeys from any station in the origin city to any station in the destination
 * city on `date`, with up to MAX_CHANGES changes. Depth-first over the timetable:
 * - each hop must get closer to the destination (no detours) and no city is revisited;
 * - transfers need 15 min at the same station, 60 min across the city;
 * - car shares are door-to-door, so they only appear as direct journeys;
 * - connections must depart the same day (an overnight arrival ends the journey).
 */
function route(origin: Station, dest: Station, date: string): Leg[][] {
  const originCity = cityKey(origin);
  const destCity = cityKey(dest);
  const found: Leg[][] = [];

  const closer = (from: Station, to: Station) => greatCircleKm(to, dest) < greatCircleKm(from, dest);

  const extend = (path: Leg[], visited: Set<string>) => {
    const last = path[path.length - 1];
    if (cityKey(last.dep.to) === destCity) {
      found.push(path);
      return;
    }
    if (path.length > MAX_CHANGES) return;

    for (const st of stationsInCity(cityKey(last.dep.to))) {
      const transfer = st.id === last.dep.to.id ? MIN_TRANSFER_SAME_STATION_MIN : MIN_TRANSFER_CROSS_CITY_MIN;
      const earliest = last.arriveAt.getTime() + transfer * 60_000;
      // For each distinct service out of this station, take its earliest feasible departure.
      const best = new Map<string, Leg>();
      for (const dep of INDEX.get(st.id) ?? []) {
        if (dep.mode === "CARSHARE") continue;
        if (visited.has(cityKey(dep.to)) || !closer(st, dep.to)) continue;
        const leg = onDate(dep, date);
        if (leg.departAt.getTime() < earliest) continue;
        if (leg.arriveAt.getTime() - path[0].departAt.getTime() > MAX_JOURNEY_MIN * 60_000) continue;
        const svc = `${dep.to.id}|${dep.mode}|${dep.operator}`;
        const prev = best.get(svc);
        if (!prev || leg.departAt < prev.departAt) best.set(svc, leg);
      }
      for (const leg of best.values()) {
        extend([...path, leg], new Set([...visited, cityKey(leg.dep.to)]));
      }
    }
  };

  for (const st of stationsInCity(originCity)) {
    for (const dep of INDEX.get(st.id) ?? []) {
      const toCity = cityKey(dep.to);
      if (toCity === originCity) continue;
      if (dep.mode === "CARSHARE" && toCity !== destCity) continue;
      if (toCity !== destCity && !closer(st, dep.to)) continue;
      extend([onDate(dep, date)], new Set([originCity, toCity]));
    }
  }
  return found;
}

function toDraft(legs: Leg[], date: string, now: Date): OptionDraft {
  const segments: SegmentDraft[] = legs.map(({ dep, departAt, arriveAt }) => ({
    mode: dep.mode,
    operator: dep.operator,
    origin: ref(dep.from),
    dest: ref(dep.to),
    departAt,
    arriveAt,
    distanceKm: dep.km,
    priceCents: priceAt({ mode: dep.mode, operator: dep.operator, departAt, distanceKm: dep.km }, now),
    co2Grams: co2Grams(dep.mode, dep.km, 1),
    seatsLeft: dep.seats,
  }));

  const kmByMode = new Map<Mode, number>();
  for (const s of segments) kmByMode.set(s.mode, (kmByMode.get(s.mode) ?? 0) + s.distanceKm);
  const mainMode = [...kmByMode.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const first = segments[0];
  const last = segments[segments.length - 1];
  const seats = segments.map((s) => s.seatsLeft).filter((n): n is number => n != null);
  const externalId = `mock:${date}:${legs.map((l) => segmentKey(l.dep)).join("|")}`;
  const params = new URLSearchParams({ from: first.origin.id, to: last.dest.id, date, ref: externalId });

  return {
    externalId,
    mode: mainMode,
    operator: [...new Set(segments.map((s) => s.operator))].join(" + "),
    changes: segments.length - 1,
    segments,
    departAt: first.departAt,
    arriveAt: last.arriveAt,
    durationMin: Math.round((last.arriveAt.getTime() - first.departAt.getTime()) / 60_000),
    distanceKm: segments.reduce((sum, s) => sum + s.distanceKm, 0),
    priceCents: segments.reduce((sum, s) => sum + s.priceCents, 0),
    currency: "EUR",
    co2Grams: segments.reduce((sum, s) => sum + s.co2Grams, 0),
    // Mock booking links. Real deep links arrive in Step 3.
    bookingUrl: `https://example.com/mock-booking/${slug(first.operator)}?${params}`,
    source: "mock",
    seatsLeft: seats.length ? Math.min(...seats) : null,
  };
}

/** Price/CO2 differences smaller than this don't justify keeping a worse-timed journey. */
const DOMINANCE_TOLERANCE = 1.1;

/**
 * Drop journeys that another journey makes pointless: it leaves no earlier, arrives no
 * later, has no more changes, and costs (and emits) no more than 10% more. Without the
 * tolerance, a connection that's 10 cents cheaper would survive next to a direct train.
 */
function paretoFilter(drafts: OptionDraft[]): OptionDraft[] {
  const dominates = (k: OptionDraft, j: OptionDraft) =>
    k.departAt >= j.departAt &&
    k.arriveAt <= j.arriveAt &&
    k.changes <= j.changes &&
    k.priceCents <= j.priceCents * DOMINANCE_TOLERANCE &&
    k.co2Grams <= j.co2Grams * DOMINANCE_TOLERANCE &&
    (k.departAt > j.departAt ||
      k.arriveAt < j.arriveAt ||
      k.changes < j.changes ||
      k.priceCents < j.priceCents ||
      k.co2Grams < j.co2Grams);
  // Keep the cheaper of exact time-and-changes twins only once (dominance would drop both).
  const kept = drafts.filter((j) => !drafts.some((k) => k !== j && dominates(k, j) && !dominates(j, k)));
  const seen = new Set<string>();
  return [...kept].sort((a, b) => a.priceCents - b.priceCents).filter((d) => {
    const key = `${d.departAt.getTime()}|${d.arriveAt.getTime()}|${d.changes}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class MockProvider implements TransportProvider {
  readonly name = "mock";

  async searchStations(query: string): Promise<Station[]> {
    const q = normalize(query);
    if (!q) return STATIONS.slice(0, 10);
    const score = (s: Station) => {
      const name = normalize(s.name);
      const city = normalize(s.city);
      if (city.startsWith(q) || name.startsWith(q)) return 0;
      if (city.includes(q) || name.includes(q) || s.id.includes(q)) return 1;
      return -1;
    };
    return STATIONS.map((s) => ({ s, rank: score(s) }))
      .filter((x) => x.rank >= 0)
      .sort((a, b) => a.rank - b.rank || a.s.name.localeCompare(b.s.name))
      .slice(0, 10)
      .map((x) => x.s);
  }

  async getStation(id: string): Promise<Station | null> {
    return STATION_BY_ID.get(id) ?? null;
  }

  async searchJourneys({ originId, destId, date, travelers, now }: JourneySearchParams): Promise<OptionDraft[]> {
    const origin = STATION_BY_ID.get(originId);
    const dest = STATION_BY_ID.get(destId);
    if (!origin || !dest || cityKey(origin) === cityKey(dest)) return [];

    const paths = route(origin, dest, date);
    const hasCarshare = paths.some((p) => p.length === 1 && p[0].dep.mode === "CARSHARE");
    // Generated fallbacks: a car share if the network has none, and rail/bus if unreachable.
    for (const dep of synthesize(origin, dest, { railAndBus: paths.length === 0 })) {
      if (dep.mode === "CARSHARE" && hasCarshare) continue;
      paths.push([onDate(dep, date)]);
    }

    const drafts = paths
      .map((p) => toDraft(p, date, now))
      .filter((d) => d.segments.every((s) => s.seatsLeft == null || s.seatsLeft >= travelers));

    return paretoFilter(drafts)
      .sort((a, b) => a.changes - b.changes || a.departAt.getTime() - b.departAt.getTime())
      .slice(0, MAX_RESULTS)
      .sort((a, b) => a.departAt.getTime() - b.departAt.getTime());
  }

  async getJourney(externalId: string, now: Date): Promise<OptionDraft | null> {
    const match = /^mock:(\d{4}-\d{2}-\d{2}):(.+)$/.exec(externalId);
    if (!match) return null;
    const [, date, keys] = match;
    const legs: Leg[] = [];
    for (const key of keys.split("|")) {
      const m = /^(.+)>(.+)@(\d{4}):(.+)$/.exec(key);
      if (!m) return null;
      const [, fromId, toId, hhmm, opSlug] = m;
      const from = STATION_BY_ID.get(fromId);
      const to = STATION_BY_ID.get(toId);
      if (!from || !to) return null;
      const time = `${hhmm.slice(0, 2)}:${hhmm.slice(2)}`;
      const candidates = [...(INDEX.get(fromId) ?? []), ...synthesize(from, to, { railAndBus: true })];
      const dep = candidates.find((d) => d.to.id === toId && d.time === time && slug(d.operator) === opSlug);
      if (!dep) return null;
      legs.push(onDate(dep, date));
    }
    return legs.length ? toDraft(legs, date, now) : null;
  }
}
