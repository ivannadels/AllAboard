import {
  CARSHARE_MIN_OCCUPANTS,
  DESNZ_2026,
  FLIGHT_DISTANCE_UPLIFT,
  GRID_EU_AVERAGE_G_PER_KWH,
  GRID_G_PER_KWH,
  GROUND_DETOUR_FACTOR,
  HIGH_SPEED_MIN_AVG_KMH,
  RAIL_KWH_PER_PKM,
} from "./co2-factors";
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

export const gridIntensity = (country: string) => GRID_G_PER_KWH[country.toUpperCase()] ?? GRID_EU_AVERAGE_G_PER_KWH;

/**
 * Electric train, grams CO2e per passenger-km: electricity per passenger-km (high-speed or
 * intercity, from the average speed) × the grid intensity of the countries it runs in.
 * Cross-border trains use the average of the origin and destination grids, like SNCF does
 * for international services.
 */
export function railGramsPerPkm(avgKmh: number, countries: string[]): number {
  const kwh = avgKmh >= HIGH_SPEED_MIN_AVG_KMH ? RAIL_KWH_PER_PKM.highSpeed : RAIL_KWH_PER_PKM.intercity;
  const unique = [...new Set(countries.map((c) => c.toUpperCase()))];
  const grid = unique.reduce((sum, c) => sum + gridIntensity(c), 0) / Math.max(1, unique.length);
  return kwh * grid;
}

/** People sharing a car share: the driver plus your group, at least CARSHARE_MIN_OCCUPANTS. */
export const carshareOccupants = (travelers: number) => Math.max(CARSHARE_MIN_OCCUPANTS, Math.max(1, travelers) + 1);

export interface SegmentEmissionInput {
  mode: Mode;
  distanceKm: number;
  durationMin: number;
  originCountry: string;
  destCountry: string;
  /** Group size: only changes car-share occupancy. */
  travelers: number;
}

/** Grams CO2e per passenger-km for one segment. */
export function gramsPerPkm(s: SegmentEmissionInput): number {
  switch (s.mode) {
    case "TRAIN": {
      const avgKmh = s.durationMin > 0 ? s.distanceKm / (s.durationMin / 60) : 0;
      return railGramsPerPkm(avgKmh, [s.originCountry, s.destCountry]);
    }
    case "BUS":
      return DESNZ_2026.coachPerPkm;
    case "CARSHARE":
      return DESNZ_2026.carPerVkm / carshareOccupants(s.travelers);
    case "BIKE":
      return 0;
  }
}

/** Grams CO2e for ONE traveler on a segment (well-to-wheel). */
export function segmentCo2Grams(s: SegmentEmissionInput): number {
  return Math.round(gramsPerPkm(s) * Math.max(0, s.distanceKm));
}

export interface FlightEstimate {
  /** Flown distance: great circle × DESNZ's 8% uplift. */
  distanceKm: number;
  /** Including non-CO2 effects (contrails, NOx at altitude), per DESNZ "with RF". */
  grams: number;
  /** CO2e without non-CO2 effects. */
  gramsNoRF: number;
}

/** The flight you didn't take, for `travelers` people (short-haul economy, DESNZ 2026). */
export function flightEstimate(origin: GeoPoint, dest: GeoPoint, travelers = 1): FlightEstimate {
  const distanceKm = greatCircleKm(origin, dest) * FLIGHT_DISTANCE_UPLIFT;
  const t = Math.max(1, travelers);
  return {
    distanceKm,
    grams: Math.round(distanceKm * DESNZ_2026.shortHaulFlightPerPkm * t),
    gramsNoRF: Math.round(distanceKm * DESNZ_2026.shortHaulFlightPerPkmNoRF * t),
  };
}

/** CO2e of the flight you didn't take, including non-CO2 effects. Used for "vs. flying". */
export function flightCounterfactualGrams(origin: GeoPoint, dest: GeoPoint, travelers = 1): number {
  return flightEstimate(origin, dest, travelers).grams;
}
