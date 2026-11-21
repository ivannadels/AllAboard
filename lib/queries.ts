import { flightCounterfactualGrams } from "./co2";
import { prisma } from "./db";
import { isoDay } from "./itinerary";
import { priceForecast, trendPct } from "./pricing";
import { computeBadges, rankOptions } from "./ranking";
import { summarizeVariant } from "./trip-summary";

/** 21 days of history + today. */
const HISTORY_POINTS = 22;

/** Trips list: each trip with a summary of its first variant (Plan A). */
export async function getTripsOverview() {
  const trips = await prisma.trip.findMany({
    orderBy: { startDate: "asc" },
    include: {
      variants: {
        orderBy: { sortOrder: "asc" },
        include: {
          legs: {
            orderBy: { sortOrder: "asc" },
            include: {
              origin: true,
              dest: true,
              options: { where: { status: { in: ["SELECTED", "BOOKED"] } } },
            },
          },
          agenda: { select: { costCents: true } },
        },
      },
    },
  });

  return trips.map((trip) => {
    const primary = trip.variants[0];
    return {
      id: trip.id,
      name: trip.name,
      startDate: trip.startDate,
      endDate: trip.endDate,
      travelers: trip.travelers,
      budgetCents: trip.budgetCents,
      variantCount: trip.variants.length,
      primaryVariantName: primary?.name ?? null,
      route: primary ? [primary.legs[0]?.origin.city, ...primary.legs.map((l) => l.dest.city)].filter(Boolean) : [],
      legModes: primary?.legs.map((l) => l.options[0]?.mode ?? null) ?? [],
      summary: primary ? summarizeVariant(primary, trip.travelers) : null,
    };
  });
}

export type TripOverview = Awaited<ReturnType<typeof getTripsOverview>>[number];

/** Compact trip → plan → leg tree for the "Add to trip" dialog. */
export async function getTripPicker() {
  const trips = await prisma.trip.findMany({
    orderBy: { startDate: "asc" },
    include: {
      variants: {
        orderBy: { sortOrder: "asc" },
        include: {
          legs: { orderBy: { sortOrder: "asc" }, include: { origin: { select: { city: true } }, dest: { select: { city: true } } } },
        },
      },
    },
  });
  return trips.map((t) => ({
    id: t.id,
    name: t.name,
    travelers: t.travelers,
    variants: t.variants.map((v) => ({
      id: v.id,
      name: v.name,
      legs: v.legs.map((l) => ({ id: l.id, date: isoDay(l.date), originCity: l.origin.city, destCity: l.dest.city })),
    })),
  }));
}

export type TripPicker = Awaited<ReturnType<typeof getTripPicker>>;

/** The leg a search was opened from (search?leg=…), with its trip for context. */
export async function getSearchTargetLeg(legId: string) {
  return prisma.leg.findUnique({
    where: { id: legId },
    include: { origin: true, dest: true, variant: { include: { trip: true } } },
  });
}

/** Everything the trip page needs, with per-option price insight and badges computed. */
export async function getTripBoard(tripId: string, simNow: Date) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      variants: {
        orderBy: { sortOrder: "asc" },
        include: {
          agenda: { orderBy: [{ date: "asc" }, { time: "asc" }] },
          legs: {
            orderBy: { sortOrder: "asc" },
            include: {
              origin: true,
              dest: true,
              options: {
                include: {
                  segments: { orderBy: { sortOrder: "asc" }, include: { origin: true, dest: true } },
                  snapshots: { orderBy: { checkedAt: "desc" }, take: HISTORY_POINTS },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!trip) return null;

  const variants = trip.variants.map((v) => {
    const legs = v.legs.map((leg) => {
      const badges = computeBadges(leg.options);
      const flightCo2Grams = flightCounterfactualGrams(leg.origin, leg.dest, 1);
      // The leg's choice first, then the candidates greenest-first.
      const ranked = rankOptions(leg.options, "greenest");
      const ordered = [...ranked.filter((o) => o.status !== "CANDIDATE"), ...ranked.filter((o) => o.status === "CANDIDATE")];
      const options = ordered.map((o) => {
        const history = [...o.snapshots].reverse().map((s) => s.priceCents);
        return {
          ...o,
          badges: badges.get(o) ?? [],
          history,
          trendPct7d: trendPct(history, 7),
          forecast: priceForecast({ segments: o.segments, priceAdjustPct: o.priceAdjustPct }, simNow),
        };
      });
      return { ...leg, options, flightCo2Grams };
    });
    return { ...v, legs, summary: summarizeVariant({ legs, agenda: v.agenda }, trip.travelers) };
  });

  return { ...trip, variants };
}

export type TripBoard = NonNullable<Awaited<ReturnType<typeof getTripBoard>>>;
export type BoardVariant = TripBoard["variants"][number];
export type BoardLeg = BoardVariant["legs"][number];
export type BoardOption = BoardLeg["options"][number];
