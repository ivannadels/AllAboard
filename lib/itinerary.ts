import { prisma } from "./db";
import type { Prisma } from "./generated/prisma/client";
import { seedHistory } from "./pricing";
import { normalize } from "./text";
import { rankOptions } from "./ranking";
import type { OptionDraft, OptionStatus } from "./types";

type Tx = Prisma.TransactionClient;

const DAY_MS = 86_400_000;

/** Midnight (UTC) of a floating local date. */
export const dayOf = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export class ItineraryError extends Error {}

export interface SaveOptions {
  /** Force a status. Default: SELECTED if the leg has no chosen option yet, else CANDIDATE. */
  status?: Exclude<OptionStatus, "BOOKED">;
  /** Manual price bump applied from `since` (seed uses this for a "recent rise"). */
  priceAdjust?: { pct: number; since: Date };
}

/**
 * Save a provider journey to a leg: creates the Option with its segments, seeds 21 days of
 * price history, and auto-creates a PRICE_UP 5% alert (plan rule). Idempotent per journey:
 * saving the same externalId twice returns the existing option.
 */
export async function saveDraftToLeg(legId: string, draft: OptionDraft, simNow: Date, opts: SaveOptions = {}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.option.findFirst({ where: { legId, externalId: draft.externalId } });
    if (existing) return { option: existing, created: false };

    const chosen = await tx.option.count({ where: { legId, status: { in: ["SELECTED", "BOOKED"] } } });
    const status = opts.status ?? (chosen === 0 ? "SELECTED" : "CANDIDATE");
    if (status === "SELECTED") {
      await tx.option.updateMany({ where: { legId, status: "SELECTED" }, data: { status: "CANDIDATE" } });
    }

    const adjustPct = opts.priceAdjust?.pct ?? 0;
    let option = await tx.option.create({
      data: {
        legId,
        externalId: draft.externalId,
        mode: draft.mode,
        operator: draft.operator,
        changes: draft.changes,
        departAt: draft.departAt,
        arriveAt: draft.arriveAt,
        durationMin: draft.durationMin,
        distanceKm: draft.distanceKm,
        priceCents: draft.priceCents,
        currency: draft.currency,
        co2Grams: draft.co2Grams,
        bookingUrl: draft.bookingUrl,
        status,
        source: draft.source,
        seatsLeft: draft.seatsLeft,
        priceAdjustPct: adjustPct,
        segments: {
          create: draft.segments.map((s, i) => ({
            sortOrder: i,
            mode: s.mode,
            operator: s.operator,
            originStationId: s.origin.id,
            destStationId: s.dest.id,
            departAt: s.departAt,
            arriveAt: s.arriveAt,
            distanceKm: s.distanceKm,
            priceCents: s.priceCents,
            co2Grams: s.co2Grams,
          })),
        },
      },
    });

    const history = await seedHistory(
      tx,
      option.id,
      { segments: draft.segments, priceAdjustPct: adjustPct },
      simNow,
      { days: 21, adjustedSince: opts.priceAdjust?.since },
    );
    const latest = history[history.length - 1].priceCents;
    if (latest !== option.priceCents) {
      option = await tx.option.update({ where: { id: option.id }, data: { priceCents: latest } });
    }

    await tx.alert.create({ data: { optionId: option.id, type: "PRICE_UP", thresholdPct: 5 } });
    return { option, created: true };
  });
}

/**
 * Find the leg in a variant that a journey belongs to (same origin city, destination city
 * and date) or create one, keeping legs ordered by date. Extends the trip's dates if needed.
 */
export async function findOrCreateLeg(
  variantId: string,
  route: { originId: string; destId: string; date: Date },
): Promise<{ legId: string; created: boolean }> {
  return prisma.$transaction(async (tx) => {
    const variant = await tx.variant.findUnique({
      where: { id: variantId },
      include: { trip: true, legs: { include: { origin: true, dest: true } } },
    });
    if (!variant) throw new ItineraryError("Plan not found");

    const [origin, dest] = await Promise.all([
      tx.station.findUnique({ where: { id: route.originId } }),
      tx.station.findUnique({ where: { id: route.destId } }),
    ]);
    if (!origin || !dest) throw new ItineraryError("Unknown station");

    const day = dayOf(route.date);
    const match = variant.legs.find(
      (l) =>
        dayOf(l.date).getTime() === day.getTime() &&
        normalize(l.origin.city) === normalize(origin.city) &&
        normalize(l.dest.city) === normalize(dest.city),
    );
    if (match) return { legId: match.id, created: false };

    const leg = await tx.leg.create({
      data: { variantId, originStationId: origin.id, destStationId: dest.id, date: day, sortOrder: variant.legs.length },
    });
    await renumberLegs(tx, variantId);
    await extendTripDates(tx, variant.trip.id, day);
    return { legId: leg.id, created: true };
  });
}

/** Order legs by date (stable on previous order). */
async function renumberLegs(tx: Tx, variantId: string) {
  const legs = await tx.leg.findMany({ where: { variantId }, orderBy: [{ date: "asc" }, { sortOrder: "asc" }] });
  await Promise.all(legs.map((l, i) => (l.sortOrder === i ? null : tx.leg.update({ where: { id: l.id }, data: { sortOrder: i } }))));
}

async function extendTripDates(tx: Tx, tripId: string, day: Date) {
  const trip = await tx.trip.findUniqueOrThrow({ where: { id: tripId } });
  const data: { startDate?: Date; endDate?: Date } = {};
  if (day < trip.startDate) data.startDate = day;
  if (day.getTime() > trip.endDate.getTime() + DAY_MS - 1) data.endDate = day;
  if (data.startDate || data.endDate) await tx.trip.update({ where: { id: tripId }, data });
}

/** Make one option the leg's choice. Booked options are left alone. */
export async function selectOption(optionId: string) {
  return prisma.$transaction(async (tx) => {
    const option = await tx.option.findUnique({ where: { id: optionId } });
    if (!option) throw new ItineraryError("Option not found");
    if (option.status === "BOOKED") return option;
    await tx.option.updateMany({ where: { legId: option.legId, status: "SELECTED" }, data: { status: "CANDIDATE" } });
    return tx.option.update({ where: { id: optionId }, data: { status: "SELECTED" } });
  });
}

/** Remove a candidate. If it was the leg's choice, the greenest remaining one takes over. */
export async function removeOption(optionId: string) {
  return prisma.$transaction(async (tx) => {
    const option = await tx.option.findUnique({ where: { id: optionId } });
    if (!option) return;
    if (option.status === "BOOKED") throw new ItineraryError("Booked options can't be removed");
    await tx.option.delete({ where: { id: optionId } });
    if (option.status === "SELECTED") {
      const rest = await tx.option.findMany({ where: { legId: option.legId } });
      const next = rankOptions(rest, "greenest")[0];
      if (next) await tx.option.update({ where: { id: next.id }, data: { status: "SELECTED" } });
    }
  });
}
