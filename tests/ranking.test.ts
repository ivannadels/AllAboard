import { describe, expect, it } from "vitest";
import { computeBadges, rankOptions, type Rankable } from "@/lib/ranking";

const at = (hhmm: string) => new Date(`2027-04-15T${hhmm}:00Z`);
const opt = (name: string, co2Grams: number, priceCents: number, durationMin: number, depart = "08:00", changes = 0) => ({
  name,
  co2Grams,
  priceCents,
  durationMin,
  changes,
  departAt: at(depart),
});

const train = opt("train", 17_500, 7_890, 199);
const bus = opt("bus", 15_150, 3_599, 450);
const car = opt("car", 27_775, 3_500, 330);
const connection = opt("connection", 18_300, 7_780, 241, "06:43", 1);
const all = [train, bus, car, connection];

const names = (xs: { name: string }[]) => xs.map((x) => x.name);

describe("rankOptions", () => {
  it("greenest sorts by CO2", () => {
    expect(names(rankOptions(all, "greenest"))).toEqual(["bus", "train", "connection", "car"]);
  });

  it("greenest breaks CO2 ties by price", () => {
    const a = opt("a", 1000, 500, 60);
    const b = opt("b", 1000, 400, 60);
    expect(names(rankOptions([a, b], "greenest"))).toEqual(["b", "a"]);
  });

  it("cheapest sorts by price", () => {
    expect(names(rankOptions(all, "cheapest"))).toEqual(["car", "bus", "connection", "train"]);
  });

  it("fastest sorts by duration, then fewer changes", () => {
    const sameTime = opt("direct", 20_000, 9_000, 241);
    expect(names(rankOptions([connection, sameTime, train], "fastest"))).toEqual(["train", "direct", "connection"]);
  });

  it("defaults to greenest and does not mutate the input", () => {
    const input = [...all];
    expect(names(rankOptions(input))).toEqual(names(rankOptions(all, "greenest")));
    expect(input).toEqual(all);
  });
});

describe("computeBadges", () => {
  it("awards one winner per category", () => {
    const badges = computeBadges<Rankable & { name: string }>(all);
    expect(badges.get(bus)).toEqual(["greenest"]);
    expect(badges.get(car)).toEqual(["cheapest"]);
    expect(badges.get(train)).toEqual(["fastest"]);
    expect(badges.get(connection)).toBeUndefined();
  });

  it("lets one option win several badges", () => {
    const best = opt("best", 1, 1, 1);
    expect(computeBadges([best, train]).get(best)).toEqual(["greenest", "cheapest", "fastest"]);
  });

  it("handles an empty list", () => {
    expect(computeBadges([]).size).toBe(0);
  });
});
