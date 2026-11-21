import { describe, expect, it } from "vitest";
import {
  demandMultiplier,
  journeyPriceAt,
  journeyPriceHistory,
  priceAt,
  priceForecast,
  roundFareCents,
  trendPct,
  type PricedOption,
} from "@/lib/pricing";

const DAY = 86_400_000;
const departAt = new Date("2027-04-15T10:13:00.000Z");
const daysBefore = (n: number) => new Date(departAt.getTime() - n * DAY);

const train: PricedOption = { mode: "TRAIN", operator: "Eurostar", departAt, distanceKm: 500 };
const bus: PricedOption = { mode: "BUS", operator: "FlixBus", departAt, distanceKm: 505 };

describe("demand curve", () => {
  it("is flat beyond 60 days", () => {
    expect(demandMultiplier(60)).toBe(1);
    expect(demandMultiplier(120)).toBe(1);
  });

  it("rises as departure approaches, steeply inside 14 days", () => {
    expect(demandMultiplier(30)).toBeGreaterThan(demandMultiplier(45));
    const gentle = demandMultiplier(30) - demandMultiplier(44);
    const steep = demandMultiplier(0) - demandMultiplier(14);
    expect(steep).toBeGreaterThan(gentle * 3);
  });
});

describe("priceAt", () => {
  it("is deterministic", () => {
    expect(priceAt(train, daysBefore(30))).toBe(priceAt(train, daysBefore(30)));
    expect(priceAt(bus, daysBefore(30))).toBe(priceAt(bus, daysBefore(30)));
  });

  it("never lets train prices go down as departure approaches", () => {
    const trains: PricedOption[] = [
      train,
      { mode: "TRAIN", operator: "Deutsche Bahn", departAt, distanceKm: 1050 },
      { mode: "TRAIN", operator: "Ouigo", departAt, distanceKm: 430 },
      { mode: "TRAIN", operator: "SNCF", departAt: new Date("2027-05-20T07:07:00Z"), distanceKm: 1050 },
    ];
    for (const t of trains) {
      let prev = 0;
      for (let d = 150; d >= 0; d--) {
        const p = priceAt(t, new Date(t.departAt.getTime() - d * DAY));
        expect(p).toBeGreaterThanOrEqual(prev);
        prev = p;
      }
    }
  });

  it("lets bus prices dip sometimes", () => {
    let dips = 0;
    let prev = Infinity;
    for (let d = 90; d >= 0; d--) {
      const p = priceAt(bus, daysBefore(d));
      if (p < prev) dips++;
      prev = p;
    }
    expect(dips).toBeGreaterThan(0);
  });

  it("applies the manual adjustment", () => {
    const now = daysBefore(40);
    const base = priceAt(train, now);
    const bumped = priceAt({ ...train, priceAdjustPct: 15 }, now);
    expect(bumped / base).toBeGreaterThan(1.13);
    expect(bumped / base).toBeLessThan(1.17);
  });

  it("rounds to plausible fares", () => {
    expect(roundFareCents("TRAIN", 59.6) % 100).toBe(90);
    expect(roundFareCents("BUS", 29.2) % 100).toBe(99);
    expect(roundFareCents("CARSHARE", 34.6) % 100).toBe(0);
  });
});

describe("journeys", () => {
  const journey = { segments: [train, { ...bus, departAt: new Date(departAt.getTime() + 4 * 3600_000) }] };

  it("prices a journey as the sum of its segments", () => {
    const now = daysBefore(30);
    expect(journeyPriceAt(journey, now)).toBe(journey.segments.reduce((s, seg) => s + priceAt(seg, now), 0));
  });

  it("history ends on today's price and has days + 1 points", () => {
    const now = daysBefore(45);
    const h = journeyPriceHistory(journey, now, { days: 21 });
    expect(h).toHaveLength(22);
    expect(h[h.length - 1].priceCents).toBe(journeyPriceAt(journey, now));
  });

  it("adjustedSince only bumps the recent part of the history", () => {
    const now = daysBefore(45);
    const h = journeyPriceHistory({ segments: [train], priceAdjustPct: 14 }, now, {
      days: 21,
      adjustedSince: new Date(now.getTime() - 2 * DAY),
    });
    expect(trendPct(h.map((p) => p.priceCents), 3)).toBeGreaterThan(10);
    expect(h[0].priceCents).toBe(priceAt(train, new Date(now.getTime() - 21 * DAY)));
  });
});

describe("priceForecast", () => {
  it("says book soon 45 days out", () => {
    expect(priceForecast({ segments: [train] }, daysBefore(45)).advice).toBe("BOOK_SOON");
  });

  it("is stable far ahead", () => {
    const f = priceForecast({ segments: [train] }, daysBefore(90));
    expect(f.advice).toBe("STABLE");
    expect(f.changePct).toBeCloseTo(0, 5);
  });
});
