import { describe, expect, it } from "vitest";
import { BOOKING_FEE_CENTS, buildQuote, type QuoteLegInput } from "@/lib/payments/pricing";

const leg = (id: string, segments: [string, number][], shown?: number): QuoteLegInput => ({
  optionId: id,
  title: id,
  detail: "",
  operator: segments.map((s) => s[0]).join(" + "),
  segments: segments.map(([operator, priceCents]) => ({ operator, priceCents })),
  shownPriceCents: shown ?? segments.reduce((s, x) => s + x[1], 0),
});

describe("buildQuote", () => {
  const legs = [
    leg("paris-ams", [["Eurostar", 8790]]),
    leg("ams-ber", [["Deutsche Bahn", 8090]]),
    leg("ber-par", [["Deutsche Bahn", 6000], ["SNCF", 4490]]),
  ];

  it("charges fares × travelers plus €1.50 per leg per traveler", () => {
    const q = buildQuote(legs, 3);
    expect(q.faresCents).toBe((8790 + 8090 + 10490) * 3);
    expect(q.feeUnits).toBe(9);
    expect(q.feeCents).toBe(9 * BOOKING_FEE_CENTS);
    expect(q.totalCents).toBe(q.faresCents + q.feeCents);
  });

  it("owes each operator its segments' fares, summing to the fares total", () => {
    const q = buildQuote(legs, 3);
    expect(q.transfers).toEqual([
      { operator: "Deutsche Bahn", amountCents: (8090 + 6000) * 3 },
      { operator: "Eurostar", amountCents: 8790 * 3 },
      { operator: "SNCF", amountCents: 4490 * 3 },
    ]);
    expect(q.transfers.reduce((s, t) => s + t.amountCents, 0)).toBe(q.faresCents);
  });

  it("flags fares that changed since the traveler saw them", () => {
    const q = buildQuote([leg("x", [["Eurostar", 9000]], 8790)], 1);
    expect(q.priceChanged).toBe(true);
    expect(q.items[0].changeCents).toBe(210);
    expect(buildQuote(legs, 1).priceChanged).toBe(false);
  });

  it("rejects empty bookings and bad traveler counts", () => {
    expect(() => buildQuote([], 2)).toThrow();
    expect(() => buildQuote(legs, 0)).toThrow();
  });
});
