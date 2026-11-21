/** Sort order for journey options. Greenest is the default everywhere. */
export type SortMode = "greenest" | "cheapest" | "fastest";
export const SORT_MODES: readonly SortMode[] = ["greenest", "cheapest", "fastest"] as const;
export const DEFAULT_SORT: SortMode = "greenest";

export type Badge = "greenest" | "cheapest" | "fastest";

/** What ranking needs; satisfied by provider drafts and saved Options. */
export interface Rankable {
  co2Grams: number;
  priceCents: number;
  durationMin: number;
  departAt: Date;
  changes?: number;
}

export function isSortMode(v: unknown): v is SortMode {
  return typeof v === "string" && (SORT_MODES as readonly string[]).includes(v);
}

const byDepart = (a: Rankable, b: Rankable) => a.departAt.getTime() - b.departAt.getTime();

const COMPARATORS: Record<SortMode, (a: Rankable, b: Rankable) => number> = {
  // Greenest = by CO2, then price (plan rule), then earlier departure for stability.
  greenest: (a, b) => a.co2Grams - b.co2Grams || a.priceCents - b.priceCents || byDepart(a, b),
  cheapest: (a, b) => a.priceCents - b.priceCents || a.co2Grams - b.co2Grams || byDepart(a, b),
  fastest: (a, b) =>
    a.durationMin - b.durationMin || (a.changes ?? 0) - (b.changes ?? 0) || a.priceCents - b.priceCents || byDepart(a, b),
};

/** Returns a new array sorted by `mode`. */
export function rankOptions<T extends Rankable>(options: readonly T[], mode: SortMode = DEFAULT_SORT): T[] {
  return [...options].sort(COMPARATORS[mode]);
}

/**
 * The best option per category. One option can win several badges. Returns a lookup
 * keyed by the option object itself.
 */
export function computeBadges<T extends Rankable>(options: readonly T[]): Map<T, Badge[]> {
  const badges = new Map<T, Badge[]>();
  if (options.length === 0) return badges;
  const award = (badge: Badge, mode: SortMode) => {
    const winner = rankOptions(options, mode)[0];
    badges.set(winner, [...(badges.get(winner) ?? []), badge]);
  };
  award("greenest", "greenest");
  award("cheapest", "cheapest");
  award("fastest", "fastest");
  return badges;
}
