import { describe, expect, it } from "vitest";
import { MAX_CHANGES, MockProvider } from "@/lib/providers/mock";
import { applyFilters } from "@/lib/search";
import { MODES } from "@/lib/types";

const provider = new MockProvider();
const now = new Date("2027-03-01T09:00:00Z");
const search = (originId: string, destId: string, travelers = 1, date = "2027-04-15") =>
  provider.searchJourneys({ originId, destId, date, travelers, now });

const SAME_STATION_MIN = 15;
const CROSS_CITY_MIN = 60;

describe("MockProvider route search", () => {
  it("finds the direct ICE and connections from Berlin to Paris", async () => {
    const results = await search("berlin-hbf", "paris-est");
    expect(results.some((r) => r.changes === 0 && r.operator === "Deutsche Bahn")).toBe(true);
    expect(results.some((r) => r.changes >= 1)).toBe(true);
  });

  it("matches any station in the origin and destination cities", async () => {
    // Asked for Gare de Lyon, but Amsterdam trains leave from Gare du Nord.
    const results = await search("paris-lyon", "amsterdam-centraal");
    expect(results.some((r) => r.segments[0].origin.id === "paris-nord")).toBe(true);
  });

  it("never returns flights or unknown modes", async () => {
    for (const [o, d] of [["paris-nord", "berlin-hbf"], ["barcelona-sants", "roma-termini"], ["girona", "hamburg-hbf"]]) {
      for (const r of await search(o, d)) {
        for (const s of r.segments) expect(MODES).toContain(s.mode);
        expect(r.mode).not.toBe("FLIGHT");
      }
    }
  });

  it("respects the change limit, transfer times and timetable order", async () => {
    for (const [o, d] of [["paris-nord", "berlin-hbf"], ["amsterdam-centraal", "milano-centrale"], ["madrid-atocha", "lyon-part-dieu"]]) {
      for (const r of await search(o, d)) {
        expect(r.changes).toBeLessThanOrEqual(MAX_CHANGES);
        expect(r.changes).toBe(r.segments.length - 1);
        for (let i = 1; i < r.segments.length; i++) {
          const prev = r.segments[i - 1];
          const next = r.segments[i];
          const gapMin = (next.departAt.getTime() - prev.arriveAt.getTime()) / 60_000;
          expect(gapMin).toBeGreaterThanOrEqual(prev.dest.id === next.origin.id ? SAME_STATION_MIN : CROSS_CITY_MIN);
          expect(prev.dest.city).toBe(next.origin.city);
        }
      }
    }
  });

  it("only offers car shares as direct journeys", async () => {
    const results = await search("paris-nord", "berlin-hbf");
    for (const r of results) {
      if (r.segments.some((s) => s.mode === "CARSHARE")) expect(r.changes).toBe(0);
    }
  });

  it("never visits a city twice", async () => {
    for (const r of await search("paris-nord", "berlin-hbf")) {
      const cities = [r.segments[0].origin.city, ...r.segments.map((s) => s.dest.city)];
      expect(new Set(cities).size).toBe(cities.length);
    }
  });

  it("totals equal the sum of segments", async () => {
    for (const r of await search("paris-nord", "berlin-hbf")) {
      expect(r.priceCents).toBe(r.segments.reduce((s, x) => s + x.priceCents, 0));
      expect(r.co2Grams).toBe(r.segments.reduce((s, x) => s + x.co2Grams, 0));
    }
  });

  it("filters out journeys without enough seats", async () => {
    const solo = await search("paris-nord", "amsterdam-centraal", 1);
    const group = await search("paris-nord", "amsterdam-centraal", 4);
    expect(solo.some((r) => r.mode === "CARSHARE")).toBe(true); // 3 seats
    expect(group.some((r) => r.mode === "CARSHARE")).toBe(false);
  });

  it("falls back to generated options for unconnected pairs", async () => {
    const results = await search("girona", "roma-termini");
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns nothing within the same city", async () => {
    expect(await search("paris-nord", "paris-est")).toEqual([]);
  });

  it("rebuilds a journey from its externalId with the same price", async () => {
    for (const r of await search("paris-nord", "berlin-hbf")) {
      const again = await provider.getJourney(r.externalId, now);
      expect(again?.externalId).toBe(r.externalId);
      expect(again?.priceCents).toBe(r.priceCents);
    }
  });

  it("rejects malformed externalIds", async () => {
    expect(await provider.getJourney("nope", now)).toBeNull();
    expect(await provider.getJourney("mock:2027-04-15:paris-nord>mars@0700:x", now)).toBeNull();
  });
});

describe("applyFilters", () => {
  it("filters by mode, changes and departure window", async () => {
    const results = await search("paris-nord", "berlin-hbf");
    const trainsOnly = applyFilters(results, { modes: ["TRAIN"], maxChanges: null, departAfter: null, departBefore: null });
    expect(trainsOnly.length).toBeGreaterThan(0);
    expect(trainsOnly.every((r) => r.segments.every((s) => s.mode === "TRAIN"))).toBe(true);

    const direct = applyFilters(results, { modes: [], maxChanges: 0, departAfter: null, departBefore: null });
    expect(direct.every((r) => r.changes === 0)).toBe(true);

    const morning = applyFilters(results, { modes: [], maxChanges: null, departAfter: "09:00", departBefore: "12:00" });
    for (const r of morning) {
      const h = r.departAt.getUTCHours() + r.departAt.getUTCMinutes() / 60;
      expect(h).toBeGreaterThanOrEqual(9);
      expect(h).toBeLessThanOrEqual(12);
    }
  });
});
