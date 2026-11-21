import { describe, expect, it } from "vitest";
import {
  attractionSlot,
  calendarEvents,
  cityStops,
  planLabel,
  priceStrip,
  stayBars,
  swapSuggestion,
  tripDays,
  tripStatus,
  weeks,
  type AgendaLike,
  type LegLike,
  type OptionLike,
} from "@/lib/board";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const t = (iso: string) => new Date(`${iso}:00Z`);

const st = (id: string, city: string) => ({ id, name: id, city });

function option(p: Partial<OptionLike> & Pick<OptionLike, "id">): OptionLike {
  const departAt = p.departAt ?? t("2027-04-15T10:13");
  const arriveAt = p.arriveAt ?? t("2027-04-15T13:32");
  return {
    status: "CANDIDATE",
    mode: "TRAIN",
    operator: "Eurostar",
    changes: 0,
    priceCents: 8790,
    co2Grams: 17500,
    durationMin: Math.round((arriveAt.getTime() - departAt.getTime()) / 60000),
    segments: [{ mode: p.mode ?? "TRAIN", operator: p.operator ?? "Eurostar", departAt, arriveAt, origin: { city: "Paris" }, dest: { city: "Amsterdam" } }],
    ...p,
    departAt,
    arriveAt,
  };
}

const legs: LegLike[] = [
  { id: "l1", date: d("2027-04-15"), origin: st("paris-nord", "Paris"), dest: st("amsterdam-centraal", "Amsterdam"), options: [option({ id: "o1", status: "SELECTED" })] },
  {
    id: "l2",
    date: d("2027-04-18"),
    origin: st("amsterdam-centraal", "Amsterdam"),
    dest: st("berlin-hbf", "Berlin"),
    options: [option({ id: "o2", status: "SELECTED", mode: "BUS", operator: "FlixBus", departAt: t("2027-04-18T19:00"), arriveAt: t("2027-04-19T09:00") })],
  },
  { id: "l3", date: d("2027-04-22"), origin: st("berlin-hbf", "Berlin"), dest: st("paris-est", "Paris"), options: [] },
];

const agenda = (p: Partial<AgendaLike> & Pick<AgendaLike, "id" | "date" | "kind" | "title">): AgendaLike => ({
  time: null,
  endTime: null,
  location: null,
  costCents: null,
  attractionId: null,
  ...p,
});

describe("trip days and weeks", () => {
  it("lists every day inclusive and pages them by 7", () => {
    const days = tripDays(d("2027-04-15"), d("2027-04-22"));
    expect(days).toHaveLength(8);
    expect(weeks(days).map((w) => w.length)).toEqual([7, 1]);
  });
});

describe("calendarEvents", () => {
  it("places the chosen journey on its day", () => {
    const ev = calendarEvents(legs, []).filter((e) => e.legId === "l1");
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ day: "2027-04-15", startMin: 10 * 60 + 13, endMin: 13 * 60 + 32, kind: "transport" });
  });

  it("splits an overnight journey across days and clips it to the 07–22 window", () => {
    const ev = calendarEvents(legs, []).filter((e) => e.legId === "l2");
    expect(ev.map((e) => e.day)).toEqual(["2027-04-18", "2027-04-19"]);
    expect(ev[0]).toMatchObject({ startMin: 19 * 60, endMin: 22 * 60 });
    expect(ev[1]).toMatchObject({ startMin: 7 * 60, endMin: 9 * 60 });
    expect(ev[0].timeLabel).toBe("19:00–09:00");
  });

  it("skips legs with no chosen option", () => {
    expect(calendarEvents(legs, []).some((e) => e.legId === "l3")).toBe(false);
  });

  it("draws timed agenda items, defaulting to one hour", () => {
    const ev = calendarEvents([], [
      agenda({ id: "a", date: d("2027-04-16"), kind: "ACTIVITY", title: "Rijksmuseum", time: "10:00", endTime: "13:00" }),
      agenda({ id: "b", date: d("2027-04-16"), kind: "NOTE", title: "Call", time: "15:00" }),
      agenda({ id: "c", date: d("2027-04-16"), kind: "ACTIVITY", title: "Untimed" }),
      agenda({ id: "s", date: d("2027-04-15"), kind: "STAY", title: "Hotel" }),
    ]);
    expect(ev.map((e) => [e.agendaId, e.startMin, e.endMin])).toEqual([
      ["a", 600, 780],
      ["b", 900, 960],
    ]);
  });
});

describe("stays and stops", () => {
  it("runs a stay until the next leg leaves", () => {
    const bars = stayBars([agenda({ id: "s", date: d("2027-04-15"), kind: "STAY", title: "Guesthouse" })], legs, d("2027-04-22"));
    expect(bars[0]).toMatchObject({ from: "2027-04-15", to: "2027-04-18", nights: 3 });
  });

  it("lists cities you stay in, excluding the return home", () => {
    const stops = cityStops(legs, d("2027-04-22"));
    expect(stops.map((s) => [s.city, s.nights])).toEqual([
      ["Amsterdam", 3],
      ["Berlin", 4],
    ]);
  });

  it("clamps an attraction's preferred day to the stay", () => {
    const [ams] = cityStops(legs, d("2027-04-22"));
    expect(attractionSlot({ id: "x", day: 1, time: "10:00", durationMin: 90 }, ams)).toEqual({
      date: d("2027-04-16"),
      time: "10:00",
      endTime: "11:30",
    });
    expect(attractionSlot({ id: "y", day: 9, time: "17:00", durationMin: 60 }, ams).date).toEqual(d("2027-04-17"));
  });
});

describe("swapSuggestion", () => {
  it("suggests the cheapest like-for-like option", () => {
    const opts = [
      option({ id: "sel", status: "SELECTED", priceCents: 8790 }),
      option({ id: "cheap-train", priceCents: 6790 }),
      option({ id: "cheaper-bus", mode: "BUS", priceCents: 3599 }),
      option({ id: "connection", priceCents: 5000, changes: 1 }),
    ];
    expect(swapSuggestion(opts)).toEqual({ option: opts[1], savingCents: 2000 });
  });

  it("ignores savings under €3 and booked legs", () => {
    expect(swapSuggestion([option({ id: "a", status: "SELECTED", priceCents: 5000 }), option({ id: "b", priceCents: 4800 })])).toBeNull();
    expect(swapSuggestion([option({ id: "a", status: "BOOKED", priceCents: 9000 }), option({ id: "b", priceCents: 1000 })])).toBeNull();
  });
});

describe("priceStrip", () => {
  const today = d("2027-03-01"); // a Monday

  it("reports a recent rise and when it started", () => {
    const h = [6990, 6990, 6990, 7090, 7090, 7190, 7190, 8590, 8690];
    // Last at its week low on Tue 23 Feb, so the climb started Wed.
    expect(priceStrip(h, today)).toEqual({ kind: "rising", changeCents: 1700, sinceDay: "Wed", stillRising: true });
  });

  it("reports steady prices", () => {
    expect(priceStrip(Array(22).fill(6990), today)).toEqual({ kind: "steady", weeks: 3 });
  });

  it("reports a drop", () => {
    expect(priceStrip([5000, 5000, 5000, 5000, 5000, 5000, 5000, 4000], today)).toEqual({ kind: "falling", changeCents: 1000 });
  });
});

describe("labels", () => {
  it("names a plan by its modes", () => {
    expect(planLabel("Plan A", legs)).toBe("Plan A · trains + buses");
    expect(planLabel("Plan C", [])).toBe("Plan C");
  });

  it("derives trip status", () => {
    const booked = [{ options: [{ status: "BOOKED" as const }] }];
    expect(tripStatus({ endDate: d("2027-04-22") }, booked, d("2027-03-01"))).toBe("BOOKED");
    expect(tripStatus({ endDate: d("2027-04-22") }, [{ options: [{ status: "SELECTED" as const }] }], d("2027-03-01"))).toBe("DRAFT");
    expect(tripStatus({ endDate: d("2027-02-01") }, booked, d("2027-03-01"))).toBe("PAST");
  });
});
