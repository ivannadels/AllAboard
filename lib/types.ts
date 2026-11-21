// Domain types shared by lib modules, the seed, and UI. They mirror the Prisma enums
// as plain string unions so lib code doesn't depend on the generated client.

/** Ground modes we sell. There is deliberately no FLIGHT: we never sell flights. */
export type Mode = "TRAIN" | "BUS" | "CARSHARE" | "BIKE";
export const MODES: readonly Mode[] = ["TRAIN", "BUS", "CARSHARE", "BIKE"] as const;

export type OptionStatus = "CANDIDATE" | "SELECTED" | "BOOKED";

export interface Station {
  id: string;
  name: string;
  city: string;
  countryCode: string;
  lat: number;
  lon: number;
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

/** Minimal station reference carried on segments (enough to display). */
export interface StationRef {
  id: string;
  name: string;
  city: string;
}

/** One vehicle within a journey. Price and CO2 are per traveler. */
export interface SegmentDraft {
  mode: Mode;
  operator: string;
  origin: StationRef;
  dest: StationRef;
  departAt: Date;
  arriveAt: Date;
  distanceKm: number;
  priceCents: number;
  co2Grams: number;
  seatsLeft: number | null;
}

/**
 * A journey option as returned by a provider, before it's saved to a leg.
 *
 * Conventions used across the app:
 * - `priceCents` and `co2Grams` are PER TRAVELER and equal the sum over `segments`.
 *   Trip totals multiply by `trip.travelers`.
 * - Times are "floating" local wall-clock times stored as UTC (08:16 in Paris is stored as
 *   08:16Z). Always format with `timeZone: "UTC"` (see lib/format.ts).
 * - `mode` is the main mode (most distance); `operator` lists every operator.
 */
export interface OptionDraft {
  externalId: string;
  mode: Mode;
  operator: string;
  changes: number;
  segments: SegmentDraft[];
  departAt: Date;
  arriveAt: Date;
  durationMin: number;
  distanceKm: number;
  priceCents: number;
  currency: string;
  co2Grams: number;
  bookingUrl: string;
  source: string;
  seatsLeft: number | null;
}
