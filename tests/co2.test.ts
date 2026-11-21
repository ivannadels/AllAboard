import { describe, expect, it } from "vitest";
import { co2Grams, flightCounterfactualGrams, groundDistanceKm } from "@/lib/co2";
import { CO2_FACTORS_G_PER_PKM } from "@/lib/co2-factors";
import { greatCircleKm } from "@/lib/geo";

const paris = { lat: 48.8809, lon: 2.3553 };
const amsterdam = { lat: 52.3791, lon: 4.9003 };

describe("co2Grams", () => {
  it("multiplies factor × distance × travelers", () => {
    expect(co2Grams("TRAIN", 500, 1)).toBe(500 * CO2_FACTORS_G_PER_PKM.TRAIN);
    expect(co2Grams("BUS", 100, 3)).toBe(100 * CO2_FACTORS_G_PER_PKM.BUS * 3);
  });

  it("bike emits nothing", () => {
    expect(co2Grams("BIKE", 42, 2)).toBe(0);
  });

  it("ranks ground modes below flying per km", () => {
    for (const mode of ["TRAIN", "BUS", "CARSHARE", "BIKE"] as const) {
      expect(CO2_FACTORS_G_PER_PKM[mode]).toBeLessThan(CO2_FACTORS_G_PER_PKM.FLIGHT);
    }
  });
});

describe("distances", () => {
  it("great-circle Paris–Amsterdam is about 430 km", () => {
    expect(greatCircleKm(paris, amsterdam)).toBeGreaterThan(420);
    expect(greatCircleKm(paris, amsterdam)).toBeLessThan(440);
  });

  it("uses the provider distance when known", () => {
    expect(groundDistanceKm(500, paris, amsterdam)).toBe(500);
  });

  it("falls back to great-circle × 1.2 when distance is missing", () => {
    const gc = greatCircleKm(paris, amsterdam);
    expect(groundDistanceKm(null, paris, amsterdam)).toBeCloseTo(gc * 1.2, 6);
    expect(groundDistanceKm(0, paris, amsterdam)).toBeCloseTo(gc * 1.2, 6);
  });
});

describe("flightCounterfactualGrams", () => {
  it("is great-circle × flight factor × travelers", () => {
    const gc = greatCircleKm(paris, amsterdam);
    expect(flightCounterfactualGrams(paris, amsterdam, 3)).toBe(Math.round(gc * CO2_FACTORS_G_PER_PKM.FLIGHT * 3));
  });

  it("is far above the train for the same trip", () => {
    expect(flightCounterfactualGrams(paris, amsterdam)).toBeGreaterThan(co2Grams("TRAIN", 500) * 4);
  });
});
