import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT, WIDGET_KEYS, columnOf, moveWidget, normalizeLayout, sameLayout, serializeLayout, setHidden } from "@/lib/board-layout";

const all = (l: ReturnType<typeof normalizeLayout>) => [...l.columns.main, ...l.columns.side].sort();

describe("normalizeLayout", () => {
  it("falls back to the default for null, junk or bad JSON", () => {
    expect(normalizeLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout("{not json")).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout(42)).toEqual(DEFAULT_LAYOUT);
  });

  it("keeps a valid saved order", () => {
    const saved = { columns: { main: ["bookings", "calendar"], side: ["checklist", "attractions", "co2", "bikes", "budget"] }, hidden: ["bikes"] };
    expect(normalizeLayout(JSON.stringify(saved))).toEqual(saved);
  });

  it("drops unknown keys and duplicates, and appends missing widgets to their default column", () => {
    const l = normalizeLayout({ columns: { main: ["calendar", "weather", "calendar"], side: ["budget"] }, hidden: ["weather", "co2", "co2"] });
    expect(l.columns.main).toEqual(["calendar", "attractions", "checklist"]);
    expect(l.columns.side).toEqual(["budget", "bookings", "co2", "bikes"]);
    expect(l.hidden).toEqual(["co2"]);
    expect(all(l)).toEqual([...WIDGET_KEYS].sort());
  });

  it("round-trips through serialize", () => {
    expect(normalizeLayout(serializeLayout(DEFAULT_LAYOUT))).toEqual(DEFAULT_LAYOUT);
  });
});

describe("moveWidget", () => {
  it("reorders within a column like arrayMove", () => {
    const down = moveWidget(DEFAULT_LAYOUT, "calendar", "main", 2);
    expect(down.columns.main).toEqual(["attractions", "checklist", "calendar"]);
    const up = moveWidget(DEFAULT_LAYOUT, "checklist", "main", 0);
    expect(up.columns.main).toEqual(["checklist", "calendar", "attractions"]);
  });

  it("moves between columns at the given position", () => {
    const l = moveWidget(DEFAULT_LAYOUT, "calendar", "side", 1);
    expect(l.columns.main).toEqual(["attractions", "checklist"]);
    expect(l.columns.side).toEqual(["bookings", "calendar", "co2", "bikes", "budget"]);
    expect(columnOf(l, "calendar")).toBe("side");
  });

  it("clamps the index and can empty a column", () => {
    let l = DEFAULT_LAYOUT;
    for (const k of DEFAULT_LAYOUT.columns.main) l = moveWidget(l, k, "side", 99);
    expect(l.columns.main).toEqual([]);
    expect(l.columns.side.slice(-3)).toEqual(["calendar", "attractions", "checklist"]);
    expect(all(l)).toEqual([...WIDGET_KEYS].sort());
  });

  it("does not mutate its input", () => {
    const before = serializeLayout(DEFAULT_LAYOUT);
    moveWidget(DEFAULT_LAYOUT, "budget", "main", 0);
    expect(serializeLayout(DEFAULT_LAYOUT)).toBe(before);
  });
});

describe("setHidden", () => {
  it("hides and shows widgets without touching their position", () => {
    const hidden = setHidden(DEFAULT_LAYOUT, "bikes", true);
    expect(hidden.hidden).toEqual(["bikes"]);
    expect(hidden.columns).toEqual(DEFAULT_LAYOUT.columns);
    expect(sameLayout(setHidden(hidden, "bikes", false), DEFAULT_LAYOUT)).toBe(true);
  });
});
