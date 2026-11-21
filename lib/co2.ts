import { CO2_FACTORS_G_PER_PKM, GROUND_DETOUR_FACTOR } from "./co2-factors";
import { greatCircleKm } from "./geo";
import type { GeoPoint, Mode } from "./types";

/**
 * Ground distance to use for emissions: the provider's distance when known, otherwise the
 * great-circle distance × 1.2.
 */
export function groundDistanceKm(distanceKm: number | null | undefined, origin: GeoPoint, dest: GeoPoint): number {
  if (distanceKm != null && Number.isFinite(distanceKm) && distanceKm > 0) return distanceKm;
  return greatCircleKm(origin, dest) * GROUND_DETOUR_FACTOR;
}

/** Grams of CO2 for `travelers` people travelling `distanceKm` by `mode`. */
export function co2Grams(mode: Mode, distanceKm: number, travelers = 1): number {
  const factor = CO2_FACTORS_G_PER_PKM[mode];
  return Math.round(factor * Math.max(0, distanceKm) * Math.max(1, travelers));
}

/**
 * CO2 of the flight you didn't take: great-circle distance × flight factor.
 * Used only for the "vs. flying" comparison card.
 */
export function flightCounterfactualGrams(origin: GeoPoint, dest: GeoPoint, travelers = 1): number {
  return Math.round(greatCircleKm(origin, dest) * CO2_FACTORS_G_PER_PKM.FLIGHT * Math.max(1, travelers));
}
