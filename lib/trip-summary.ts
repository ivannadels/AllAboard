import { flightCounterfactualGrams } from "./co2";
import type { GeoPoint, OptionStatus } from "./types";

/** Minimal shapes so this works with Prisma results and plain objects alike. */
export interface SummaryOption {
  status: OptionStatus;
  priceCents: number;
  co2Grams: number;
  durationMin: number;
}

export interface SummaryLeg {
  origin: GeoPoint;
  dest: GeoPoint;
  options: SummaryOption[];
}

export interface SummaryVariant {
  legs: SummaryLeg[];
  agenda: { costCents: number | null }[];
}

export interface VariantSummary {
  /** Chosen transport for the whole group (per-traveler fares × travelers). */
  transportCents: number;
  /** Stays & activities as entered (already group totals). */
  agendaCents: number;
  totalCents: number;
  /** Group CO2 of the chosen options. */
  co2Grams: number;
  /** Group CO2 had the same legs been flown (only legs with a chosen option). */
  flightCo2Grams: number;
  co2SavedGrams: number;
  travelMin: number;
  legsTotal: number;
  legsChosen: number;
}

/** The option that counts for a leg: BOOKED first, then SELECTED. */
export function chosenOption<T extends SummaryOption>(options: T[]): T | undefined {
  return options.find((o) => o.status === "BOOKED") ?? options.find((o) => o.status === "SELECTED");
}

export function summarizeVariant(variant: SummaryVariant, travelers: number): VariantSummary {
  const t = Math.max(1, travelers);
  let transportCents = 0;
  let co2 = 0;
  let flight = 0;
  let travelMin = 0;
  let legsChosen = 0;

  for (const leg of variant.legs) {
    const chosen = chosenOption(leg.options);
    if (!chosen) continue;
    legsChosen++;
    transportCents += chosen.priceCents * t;
    co2 += chosen.co2Grams * t;
    travelMin += chosen.durationMin;
    flight += flightCounterfactualGrams(leg.origin, leg.dest, t);
  }

  const agendaCents = variant.agenda.reduce((sum, a) => sum + (a.costCents ?? 0), 0);

  return {
    transportCents,
    agendaCents,
    totalCents: transportCents + agendaCents,
    co2Grams: co2,
    flightCo2Grams: flight,
    co2SavedGrams: Math.max(0, flight - co2),
    travelMin,
    legsTotal: variant.legs.length,
    legsChosen,
  };
}
