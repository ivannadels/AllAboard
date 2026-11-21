// The trip board's widget arrangement: two columns (wide main, narrow side) whose widgets
// can be reordered and moved between columns, plus a set of hidden widgets. Stored as JSON
// on Trip.boardLayout. Pure functions only, so it's unit-testable and shared client/server.

export const WIDGET_KEYS = ["calendar", "bookings", "checklist", "attractions", "co2", "bikes", "budget"] as const;
export type WidgetKey = (typeof WIDGET_KEYS)[number];

export const WIDGET_LABELS: Record<WidgetKey, string> = {
  calendar: "Week calendar",
  bookings: "Selected journeys",
  checklist: "Checklist",
  attractions: "Things to do",
  co2: "CO₂ vs flying",
  bikes: "Bike share",
  budget: "Budget",
};

export const COLUMN_IDS = ["main", "side"] as const;
export type ColumnId = (typeof COLUMN_IDS)[number];

export const COLUMN_LABELS: Record<ColumnId, string> = { main: "wide column", side: "narrow column" };

export interface BoardLayout {
  columns: Record<ColumnId, WidgetKey[]>;
  hidden: WidgetKey[];
}

/** Mirrors the template: calendar + things to do + checklist wide; journeys and the rest narrow. */
export const DEFAULT_LAYOUT: BoardLayout = {
  columns: {
    main: ["calendar", "attractions", "checklist"],
    side: ["bookings", "co2", "bikes", "budget"],
  },
  hidden: [],
};

/** Which column a widget lives in when it's missing from a saved layout. */
const DEFAULT_COLUMN: Record<WidgetKey, ColumnId> = Object.fromEntries(
  COLUMN_IDS.flatMap((c) => DEFAULT_LAYOUT.columns[c].map((k) => [k, c])),
) as Record<WidgetKey, ColumnId>;

export const isWidgetKey = (v: unknown): v is WidgetKey => typeof v === "string" && (WIDGET_KEYS as readonly string[]).includes(v);
export const isColumnId = (v: unknown): v is ColumnId => typeof v === "string" && (COLUMN_IDS as readonly string[]).includes(v);

/**
 * Turn anything (saved JSON, a client payload, null) into a valid layout: unknown keys are
 * dropped, duplicates keep their first place, and widgets added in later versions are
 * appended to their default column. Never throws.
 */
export function normalizeLayout(raw: unknown): BoardLayout {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      value = null;
    }
  }
  const obj = (value && typeof value === "object" ? value : {}) as { columns?: Record<string, unknown>; hidden?: unknown };
  const seen = new Set<WidgetKey>();
  const columns = { main: [], side: [] } as Record<ColumnId, WidgetKey[]>;

  for (const col of COLUMN_IDS) {
    const list = Array.isArray(obj.columns?.[col]) ? (obj.columns[col] as unknown[]) : [];
    for (const k of list) {
      if (isWidgetKey(k) && !seen.has(k)) {
        seen.add(k);
        columns[col].push(k);
      }
    }
  }
  // Missing widgets go to their default column, in default order.
  for (const col of COLUMN_IDS) {
    for (const k of DEFAULT_LAYOUT.columns[col]) if (!seen.has(k)) columns[col].push(k);
  }
  const hidden = Array.isArray(obj.hidden) ? [...new Set(obj.hidden.filter(isWidgetKey))] : [];
  return { columns, hidden };
}

export function serializeLayout(layout: BoardLayout): string {
  return JSON.stringify(normalizeLayout(layout));
}

export function columnOf(layout: BoardLayout, key: WidgetKey): ColumnId {
  return COLUMN_IDS.find((c) => layout.columns[c].includes(key)) ?? DEFAULT_COLUMN[key];
}

/**
 * Move `key` to `column` at `index`, where index counts positions in the target column
 * after `key` has been taken out (so a same-column move behaves like arrayMove).
 */
export function moveWidget(layout: BoardLayout, key: WidgetKey, column: ColumnId, index: number): BoardLayout {
  const columns = { main: [...layout.columns.main], side: [...layout.columns.side] };
  for (const c of COLUMN_IDS) columns[c] = columns[c].filter((k) => k !== key);
  const target = columns[column];
  target.splice(Math.max(0, Math.min(index, target.length)), 0, key);
  return { ...layout, columns };
}

export function setHidden(layout: BoardLayout, key: WidgetKey, hidden: boolean): BoardLayout {
  const set = new Set(layout.hidden);
  if (hidden) set.add(key);
  else set.delete(key);
  return { ...layout, hidden: WIDGET_KEYS.filter((k) => set.has(k)) };
}

export function sameLayout(a: BoardLayout, b: BoardLayout): boolean {
  return serializeLayout(a) === serializeLayout(b);
}
