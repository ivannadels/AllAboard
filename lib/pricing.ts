import type { Mode } from "./types";

/**
 * Mock price engine. Deterministic: the same option at the same sim-day always gets the
 * same price, so demos are reproducible and search results match saved options.
 *
 * All prices are PER TRAVELER, in cents.
 */

const DAY_MS = 86_400_000;

/** €/km per mode (plan values). */
export const RATE_EUR_PER_KM: Record<Mode, number> = {
  TRAIN: 0.12,
  BUS: 0.06,
  CARSHARE: 0.07,
  BIKE: 0,
};

/** Operator-level fare positioning (low-cost vs. premium). Unknown operators = 1. */
export const OPERATOR_FACTOR: Record<string, number> = {
  Ouigo: 0.6,
  Eurostar: 1.1,
  "BlaBlaCar Bus": 0.9,
};

/** Rail fares taper on long distances: km beyond this count at 60%. */
const RAIL_TAPER_KM = 600;

/** The fields pricing needs. Works for both provider drafts and saved Options. */
export interface PricedOption {
  mode: Mode;
  operator: string;
  departAt: Date;
  distanceKm: number;
  /** Manual bump in percent (e.g. 15 = +15%), applied on top of the curve. */
  priceAdjustPct?: number | null;
}

// ---------------------------------------------------------------------------
// Deterministic noise
// ---------------------------------------------------------------------------

/** FNV-1a 32-bit hash → [0, 1). */
export function hash01(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x1_0000_0000;
}

/**
 * Stable identity for noise seeding. Derived from schedule fields rather than the DB id,
 * so a search result and the Option saved from it price identically (and reseeds match).
 */
export function priceKey(o: PricedOption): string {
  return `${o.mode}|${o.operator}|${o.departAt.toISOString()}|${Math.round(o.distanceKm)}`;
}

// ---------------------------------------------------------------------------
// Curve pieces
// ---------------------------------------------------------------------------

/** Whole days from `now` until departure (never negative). */
export function daysToDeparture(departAt: Date, now: Date): number {
  return Math.max(0, Math.floor((departAt.getTime() - now.getTime()) / DAY_MS));
}

/**
 * Demand multiplier: flat beyond 60 days, gentle rise to ×1.35 at 14 days, then steep
 * (quadratic) up to ×2.3 on departure day.
 */
export function demandMultiplier(days: number): number {
  const d = Math.max(0, days);
  if (d >= 60) return 1;
  if (d >= 14) return 1 + (0.35 * (60 - d)) / 46;
  const t = (14 - d) / 14;
  return 1.35 + 0.95 * t * t;
}

/** Undiscounted, unrounded per-traveler fare in euros, before demand. */
export function baseFareEur(o: Pick<PricedOption, "mode" | "operator" | "distanceKm">): number {
  const km =
    o.mode === "TRAIN" && o.distanceKm > RAIL_TAPER_KM
      ? RAIL_TAPER_KM + (o.distanceKm - RAIL_TAPER_KM) * 0.6
      : o.distanceKm;
  return km * RATE_EUR_PER_KM[o.mode] * (OPERATOR_FACTOR[o.operator] ?? 1);
}

/** Round euros to a plausible fare for the mode, in cents. */
export function roundFareCents(mode: Mode, eur: number): number {
  switch (mode) {
    case "TRAIN": // 59.90
      return Math.max(990, Math.round(eur) * 100 - 10);
    case "BUS": // 29.99
      return Math.max(499, Math.floor(eur) * 100 + 99);
    case "CARSHARE": // 35.00
      return Math.max(500, Math.round(eur) * 100);
    case "BIKE":
      return 0;
  }
}

/** `basePrice(option)`: today's fare with no demand pressure, rounded. */
export function basePrice(o: PricedOption): number {
  return roundFareCents(o.mode, baseFareEur(o) * variety(o));
}

/** Per-option constant spread (±8%) so two trains on a route don't cost the same. */
function variety(o: PricedOption): number {
  return 0.92 + 0.16 * hash01(`${priceKey(o)}|variety`);
}

/** Unrounded price in euros at `days` before departure, without manual adjustment. */
function rawEur(o: PricedOption, days: number): number {
  const key = priceKey(o);
  const base = baseFareEur(o) * variety(o) * demandMultiplier(days);
  if (o.mode === "TRAIN") {
    // Small upward-only jitter; monotonicity is enforced by the running max in priceAt.
    return base * (1 + 0.03 * hash01(`${key}|${days}`));
  }
  // Bus & carshare: ±5% jitter plus an occasional promo dip.
  const jitter = (hash01(`${key}|${days}`) - 0.5) * 0.1;
  const promo = hash01(`${key}|${days}|promo`) < 0.08 ? -0.12 : 0;
  return base * (1 + jitter + promo);
}

/** Trains are evaluated from this many days out to enforce non-decreasing prices. */
const TRAIN_HORIZON_DAYS = 120;

/**
 * `priceAt(option, simNow)`: per-traveler price in cents at the given simulated time.
 * Train prices never go down as departure approaches (matches real rail fare buckets).
 */
export function priceAt(o: PricedOption, simNow: Date): number {
  const days = daysToDeparture(o.departAt, simNow);
  let eur: number;
  if (o.mode === "TRAIN") {
    // Running max from the horizon down to today. Beyond the horizon the fare is the
    // horizon fare, so the sequence is non-decreasing on every day, not just inside it.
    eur = 0;
    for (let d = TRAIN_HORIZON_DAYS; d >= Math.min(days, TRAIN_HORIZON_DAYS); d--) eur = Math.max(eur, rawEur(o, d));
  } else {
    eur = rawEur(o, days);
  }
  const adjust = 1 + (o.priceAdjustPct ?? 0) / 100;
  return roundFareCents(o.mode, eur * adjust);
}

// ---------------------------------------------------------------------------
// Journeys (one or more segments)
// ---------------------------------------------------------------------------

/** A multi-segment journey. The manual adjustment applies to every segment. */
export interface PricedJourney {
  segments: Omit<PricedOption, "priceAdjustPct">[];
  priceAdjustPct?: number | null;
}

/** Journey price per traveler = sum of its segment fares. */
export function journeyPriceAt(j: PricedJourney, simNow: Date): number {
  return j.segments.reduce((sum, s) => sum + priceAt({ ...s, priceAdjustPct: j.priceAdjustPct }, simNow), 0);
}

export interface HistoryPoint {
  priceCents: number;
  checkedAt: Date;
}

/**
 * Daily price history for the `days` days up to and including `simNow` (oldest first).
 * If `adjustedSince` is set, the manual adjustment only applies from that time on,
 * which is how the seed creates a "recent rise".
 */
export function journeyPriceHistory(
  j: PricedJourney,
  simNow: Date,
  opts: { days?: number; adjustedSince?: Date } = {},
): HistoryPoint[] {
  const days = opts.days ?? 21;
  const points: HistoryPoint[] = [];
  for (let i = days; i >= 0; i--) {
    const checkedAt = new Date(simNow.getTime() - i * DAY_MS);
    const adjusted = !opts.adjustedSince || checkedAt >= opts.adjustedSince;
    points.push({
      checkedAt,
      priceCents: journeyPriceAt({ ...j, priceAdjustPct: adjusted ? j.priceAdjustPct : 0 }, checkedAt),
    });
  }
  return points;
}

/** Percent change between the price `days` ago and the latest of daily `prices` (oldest first). */
export function trendPct(prices: number[], days = 7): number {
  if (prices.length < 2) return 0;
  const last = prices[prices.length - 1];
  const past = prices[Math.max(0, prices.length - 1 - days)];
  return past === 0 ? 0 : ((last - past) / past) * 100;
}

export type ForecastAdvice = "BOOK_SOON" | "RISING" | "STABLE";

export interface PriceForecast {
  horizonDays: number;
  expectedCents: number;
  changePct: number;
  advice: ForecastAdvice;
}

/**
 * Where the price is heading over the next `horizonDays`, from the demand curve alone
 * (no day-to-day noise): this is the "typical" movement, not a guarantee.
 */
export function priceForecast(j: PricedJourney, simNow: Date, horizonDays = 14): PriceForecast {
  let current = 0;
  let expected = 0;
  for (const s of j.segments) {
    const price = priceAt({ ...s, priceAdjustPct: j.priceAdjustPct }, simNow);
    const days = daysToDeparture(s.departAt, simNow);
    const later = Math.max(0, days - horizonDays);
    current += price;
    expected += price * (demandMultiplier(later) / demandMultiplier(days));
  }
  const changePct = current === 0 ? 0 : ((expected - current) / current) * 100;
  const advice: ForecastAdvice = changePct >= 8 ? "BOOK_SOON" : changePct >= 3 ? "RISING" : "STABLE";
  return { horizonDays, expectedCents: Math.round(expected), changePct, advice };
}

/** Minimal DB surface `seedHistory` needs (keeps this module free of Prisma imports). */
interface SnapshotWriter {
  priceSnapshot: {
    createMany(args: { data: { optionId: string; priceCents: number; checkedAt: Date }[] }): Promise<unknown>;
  };
}

/** `seedHistory(option, days = 21)`: writes past PriceSnapshots for a saved option. */
export async function seedHistory(
  db: SnapshotWriter,
  optionId: string,
  journey: PricedJourney,
  simNow: Date,
  opts: { days?: number; adjustedSince?: Date } = {},
): Promise<HistoryPoint[]> {
  const points = journeyPriceHistory(journey, simNow, opts);
  await db.priceSnapshot.createMany({
    data: points.map((p) => ({ optionId, priceCents: p.priceCents, checkedAt: p.checkedAt })),
  });
  return points;
}
