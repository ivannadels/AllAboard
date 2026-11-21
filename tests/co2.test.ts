import { describe, expect, it } from "vitest";
import {
  carshareOccupants,
  flightEstimate,
  gramsPerPkm,
  gridIntensity,
  groundDistanceKm,
  railGramsPerPkm,
  segmentCo2Grams,
} from "@/lib/co2";
import { DESNZ_2026, GRID_EU_AVERAGE_G_PER_KWH } from "@/lib/co2-factors";
import { greatCircleKm } from "@/lib/geo";

const paris = { lat: 48.8809, lon: 2.3553 };
const amsterdam = { lat: 52.3791, lon: 4.9003 };

const seg = (p: Partial<Parameters<typeof gramsPerPkm>[0]>) => ({
  mode: "TRAIN" as const,
  distanceKm: 500,
  durationMin: 200,
  originCountry: "FR",
  destCountry: "FR",
  travelers: 1,
  ...p,
});

describe("rail: electricity × country grid", () => {
  it("puts a French high-speed train near SNCF's own published figure (~2 g/pkm)", () => {
    const g = railGramsPerPkm(220, ["FR"]);
    expect(g).toBeGreaterThan(1);
    expect(g).toBeLessThan(4);
  });

  it("makes a German intercity far more carbon-intensive than a French TGV (grid mix)", () => {
    expect(railGramsPerPkm(100, ["DE"])).toBeGreaterThan(railGramsPerPkm(220, ["FR"]) * 8);
  });

  it("averages origin and destination grids for cross-border trains", () => {
    const fr = railGramsPerPkm(150, ["FR"]);
    const nl = railGramsPerPkm(150, ["NL"]);
    expect(railGramsPerPkm(150, ["FR", "NL"])).toBeCloseTo((fr + nl) / 2, 6);
  });

  it("treats slower trains as intercity (more energy per passenger-km)", () => {
    expect(railGramsPerPkm(100, ["DE"])).toBeGreaterThan(railGramsPerPkm(200, ["DE"]));
  });

  it("falls back to the EU-average grid for unknown countries", () => {
    expect(gridIntensity("PL")).toBe(GRID_EU_AVERAGE_G_PER_KWH);
  });

  it("keeps a Paris–Amsterdam train in the same range as DESNZ's Eurostar factor", () => {
    const g = gramsPerPkm(seg({ originCountry: "FR", destCountry: "NL", distanceKm: 500, durationMin: 199 }));
    expect(g).toBeGreaterThan(DESNZ_2026.internationalRailPerPkm / 3);
    expect(g).toBeLessThan(DESNZ_2026.internationalRailPerPkm * 3);
  });
});

describe("road", () => {
  it("uses the DESNZ coach factor", () => {
    expect(gramsPerPkm(seg({ mode: "BUS" }))).toBeCloseTo(46.04, 2);
  });

  it("shares a car's emissions between the driver and the group (at least 3 people)", () => {
    expect(carshareOccupants(1)).toBe(3);
    expect(carshareOccupants(3)).toBe(4);
    expect(gramsPerPkm(seg({ mode: "CARSHARE", travelers: 3 }))).toBeCloseTo(DESNZ_2026.carPerVkm / 4, 6);
    expect(gramsPerPkm(seg({ mode: "CARSHARE", travelers: 1 }))).toBeGreaterThan(gramsPerPkm(seg({ mode: "CARSHARE", travelers: 3 })));
  });

  it("bikes emit nothing", () => {
    expect(segmentCo2Grams(seg({ mode: "BIKE" }))).toBe(0);
  });
});

describe("segmentCo2Grams", () => {
  it("is per traveler: grams per passenger-km × distance", () => {
    const s = seg({ mode: "BUS", distanceKm: 300 });
    expect(segmentCo2Grams(s)).toBe(Math.round(DESNZ_2026.coachPerPkm * 300));
  });
});

describe("the flight you didn't take", () => {
  it("flies the great circle + 8% at the DESNZ short-haul factor, incl. non-CO2 effects", () => {
    const gc = greatCircleKm(paris, amsterdam);
    const f = flightEstimate(paris, amsterdam, 3);
    expect(f.distanceKm).toBeCloseTo(gc * 1.08, 6);
    expect(f.grams).toBe(Math.round(gc * 1.08 * DESNZ_2026.shortHaulFlightPerPkm * 3));
    expect(f.gramsNoRF).toBeLessThan(f.grams);
  });

  it("is always worse per km than every ground mode we sell", () => {
    for (const mode of ["TRAIN", "BUS", "CARSHARE"] as const) {
      expect(gramsPerPkm(seg({ mode, originCountry: "DE", destCountry: "DE", durationMin: 600 }))).toBeLessThan(
        DESNZ_2026.shortHaulFlightPerPkmNoRF,
      );
    }
  });
});

describe("distances", () => {
  it("uses the provider distance when known, else great-circle × 1.2", () => {
    expect(groundDistanceKm(500, paris, amsterdam)).toBe(500);
    expect(groundDistanceKm(null, paris, amsterdam)).toBeCloseTo(greatCircleKm(paris, amsterdam) * 1.2, 6);
  });
});
