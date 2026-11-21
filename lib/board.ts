// Pure helpers behind the trip board: calendar layout, stays, swap suggestions, price
// strips and "things to do" slots. No DB access here, so it's all unit-testable.
import { normalize } from "./text";
import type { Mode, OptionStatus } from "./types";

const DAY_MS = 86_400_000;
export const CAL_START_HOUR = 7;
export const CAL_END_HOUR = 22;

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const dayStart = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const minutesOfDay = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHHMM = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Every calendar day from start to end, inclusive (UTC midnights). */
export function tripDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  for (let t = dayStart(start); t <= dayStart(end); t += DAY_MS) days.push(new Date(t));
  return days;
}

/** Split days into pages of 7 for the week calendar. */
export function weeks<T>(days: T[], size = 7): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < days.length; i += size) out.push(days.slice(i, i + size));
  return out.length ? out : [[]];
}

// ---------------------------------------------------------------------------
// Inputs (structural, so Prisma rows fit)
// ---------------------------------------------------------------------------

export interface SegmentLike {
  mode: Mode;
  operator: string;
  departAt: Date;
  arriveAt: Date;
  origin: { city: string };
  dest: { city: string };
}

export interface OptionLike {
  id: string;
  status: OptionStatus;
  mode: Mode;
  operator: string;
  changes: number;
  priceCents: number;
  co2Grams: number;
  departAt: Date;
  arriveAt: Date;
  durationMin: number;
  segments: SegmentLike[];
}

export interface LegLike {
  id: string;
  date: Date;
  origin: { id: string; name: string; city: string };
  dest: { id: string; name: string; city: string };
  options: OptionLike[];
}

export interface AgendaLike {
  id: string;
  date: Date;
  time: string | null;
  endTime: string | null;
  kind: "STAY" | "ACTIVITY" | "NOTE";
  title: string;
  location: string | null;
  costCents: number | null;
  attractionId: string | null;
}

export function chosen<T extends { status: OptionStatus }>(options: T[]): T | undefined {
  return options.find((o) => o.status === "BOOKED") ?? options.find((o) => o.status === "SELECTED");
}

// ---------------------------------------------------------------------------
// Week calendar
// ---------------------------------------------------------------------------

export type EventKind = "transport" | "plan";

export interface CalendarEvent {
  key: string;
  day: string; // YYYY-MM-DD
  /** Minutes from midnight, clamped to the visible window. */
  startMin: number;
  endMin: number;
  title: string;
  /** Real times, even when the block is clipped to the window. */
  timeLabel: string;
  kind: EventKind;
  mode?: Mode;
  agendaId?: string;
  legId?: string;
}

const WINDOW_START = CAL_START_HOUR * 60;
const WINDOW_END = CAL_END_HOUR * 60;

/** Clip [start, end) minutes to the window; null if nothing is visible. */
function clip(start: number, end: number): [number, number] | null {
  const s = Math.max(start, WINDOW_START);
  const e = Math.min(end, WINDOW_END);
  if (e <= s) {
    // Entirely outside the window: pin a short block at the nearest edge so it isn't lost.
    if (end <= WINDOW_START) return [WINDOW_START, WINDOW_START + 30];
    if (start >= WINDOW_END) return [WINDOW_END - 30, WINDOW_END];
    return null;
  }
  return [s, e];
}

/** Calendar blocks for the chosen journey of each leg (split at midnight) and timed agenda items. */
export function calendarEvents(legs: LegLike[], agenda: AgendaLike[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const leg of legs) {
    const option = chosen(leg.options);
    if (!option) continue;
    const first = option.segments[0];
    const last = option.segments[option.segments.length - 1];
    const title = `${option.operator.split(" + ").join(" + ")} ${first?.origin.city ?? leg.origin.city} → ${last?.dest.city ?? leg.dest.city}`;
    const timeLabel = `${toHHMM(minutesOfDay(option.departAt))}–${toHHMM(minutesOfDay(option.arriveAt))}`;
    // Walk the days the journey spans.
    for (let t = dayStart(option.departAt); t <= dayStart(option.arriveAt); t += DAY_MS) {
      const startMin = t === dayStart(option.departAt) ? minutesOfDay(option.departAt) : 0;
      const endMin = t === dayStart(option.arriveAt) ? minutesOfDay(option.arriveAt) : 24 * 60;
      const span = clip(startMin, endMin);
      if (!span) continue;
      events.push({
        key: `${option.id}-${t}`,
        day: isoDay(new Date(t)),
        startMin: span[0],
        endMin: span[1],
        title,
        timeLabel,
        kind: "transport",
        mode: option.mode,
        legId: leg.id,
      });
    }
  }

  for (const a of agenda) {
    if (a.kind === "STAY" || !a.time) continue;
    const start = toMin(a.time);
    let end = a.endTime ? toMin(a.endTime) : start + 60;
    if (end <= start) end = start + 60;
    const span = clip(start, end);
    if (!span) continue;
    events.push({
      key: a.id,
      day: isoDay(a.date),
      startMin: span[0],
      endMin: span[1],
      title: a.title,
      timeLabel: `${a.time}–${toHHMM(end)}`,
      kind: "plan",
      agendaId: a.id,
    });
  }
  return events.sort((x, y) => x.day.localeCompare(y.day) || x.startMin - y.startMin);
}

/** Agenda items with no time (other than stays) show as chips on their day. */
export function allDayItems(agenda: AgendaLike[]) {
  return agenda.filter((a) => a.kind !== "STAY" && !a.time).map((a) => ({ id: a.id, day: isoDay(a.date), title: a.title }));
}

export interface StayBar {
  id: string;
  title: string;
  location: string | null;
  from: string; // check-in day
  to: string; // check-out day
  nights: number;
}

/**
 * Stays run from their date until the next leg leaves after it (or the trip's end).
 * "3 nights" in a title is not parsed; the itinerary decides.
 */
export function stayBars(agenda: AgendaLike[], legs: LegLike[], tripEnd: Date): StayBar[] {
  const legDays = legs.map((l) => dayStart(l.date)).sort((a, b) => a - b);
  return agenda
    .filter((a) => a.kind === "STAY")
    .map((a) => {
      const start = dayStart(a.date);
      const out = legDays.find((d) => d > start) ?? Math.max(dayStart(tripEnd), start + DAY_MS);
      return {
        id: a.id,
        title: a.title,
        location: a.location,
        from: isoDay(new Date(start)),
        to: isoDay(new Date(out)),
        nights: Math.max(1, Math.round((out - start) / DAY_MS)),
      };
    });
}

// ---------------------------------------------------------------------------
// Stops ("Things to do" tabs) and attraction slots
// ---------------------------------------------------------------------------

export interface CityStop {
  cityKey: string;
  city: string;
  stationId: string;
  arrive: Date;
  leave: Date;
  nights: number;
}

/**
 * Cities you stay in: each leg's destination, until the next leg leaves. A final leg back to
 * the trip's starting city is "home" and doesn't count as a stop.
 */
export function cityStops(legs: LegLike[], tripEnd: Date): CityStop[] {
  const ordered = [...legs].sort((a, b) => a.date.getTime() - b.date.getTime());
  const home = ordered[0] ? normalize(ordered[0].origin.city) : null;
  const stops: CityStop[] = [];
  ordered.forEach((leg, i) => {
    const cityKey = normalize(leg.dest.city);
    const next = ordered[i + 1];
    if (!next && cityKey === home) return;
    const arrive = new Date(dayStart(leg.date));
    const leave = new Date(next ? dayStart(next.date) : Math.max(dayStart(tripEnd), arrive.getTime()));
    stops.push({
      cityKey,
      city: leg.dest.city,
      stationId: leg.dest.id,
      arrive,
      leave,
      nights: Math.max(0, Math.round((leave.getTime() - arrive.getTime()) / DAY_MS)),
    });
  });
  return stops;
}

export interface AttractionLike {
  id: string;
  day: number;
  time: string;
  durationMin: number;
}

/** When to suggest an attraction during a stop: preferred day clamped to the stay. */
export function attractionSlot(a: AttractionLike, stop: CityStop) {
  const lastDay = Math.max(0, stop.nights - 1);
  const offset = Math.min(Math.max(0, a.day), lastDay);
  const date = new Date(stop.arrive.getTime() + offset * DAY_MS);
  return { date, time: a.time, endTime: toHHMM(toMin(a.time) + a.durationMin) };
}

// ---------------------------------------------------------------------------
// Selected journeys: swaps and price strips
// ---------------------------------------------------------------------------

/** Minimum saving before we suggest swapping, in cents per traveler. */
export const MIN_SWAP_SAVING_CENTS = 300;

/**
 * A cheaper like-for-like alternative among a leg's saved options: same main mode, no more
 * changes, at least €3 cheaper per person. Returns the cheapest such option.
 */
export function swapSuggestion<T extends OptionLike>(options: T[]): { option: T; savingCents: number } | null {
  const current = chosen(options);
  if (!current || current.status === "BOOKED") return null;
  const better = options
    .filter(
      (o) =>
        o.status === "CANDIDATE" &&
        o.mode === current.mode &&
        o.changes <= current.changes &&
        current.priceCents - o.priceCents >= MIN_SWAP_SAVING_CENTS,
    )
    .sort((a, b) => a.priceCents - b.priceCents)[0];
  return better ? { option: better, savingCents: current.priceCents - better.priceCents } : null;
}

export type PriceStrip =
  | { kind: "rising"; changeCents: number; sinceDay: string; stillRising: boolean }
  | { kind: "falling"; changeCents: number }
  | { kind: "steady"; weeks: number };

/**
 * Summarise a daily price history (oldest first, last = today) for the selected-journey
 * card: a rise of ≥5% over the last week shows as "Up €12 since Tue".
 */
export function priceStrip(history: number[], today: Date): PriceStrip {
  const n = history.length;
  if (n < 2) return { kind: "steady", weeks: 0 };
  const latest = history[n - 1];
  const window = history.slice(Math.max(0, n - 8));
  const low = Math.min(...window);
  if (latest - low >= Math.max(100, low * 0.05)) {
    // The rise started on the last day the price was at its low.
    const lowIdx = window.lastIndexOf(low);
    const daysAgo = window.length - 1 - lowIdx - 1;
    const since = new Date(dayStart(today) - Math.max(0, daysAgo) * DAY_MS);
    const stillRising = history[n - 1] > history[n - 2];
    return {
      kind: "rising",
      changeCents: latest - low,
      sinceDay: since.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
      stillRising,
    };
  }
  const weekAgo = history[Math.max(0, n - 8)];
  if (weekAgo - latest >= Math.max(100, weekAgo * 0.05)) return { kind: "falling", changeCents: weekAgo - latest };
  return { kind: "steady", weeks: Math.floor((n - 1) / 7) };
}

/** Points for the strip's mini trend line (viewBox 64×20). */
export function trendPolyline(history: number[], width = 64, height = 20): string {
  if (history.length < 2) return "";
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;
  return history
    .map((v, i) => {
      const x = (i / (history.length - 1)) * width;
      const y = height - 3 - ((v - min) / range) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const MODE_PLURAL: Record<Mode, string> = { TRAIN: "trains", BUS: "buses", CARSHARE: "car share", BIKE: "bike" };

/** "Plan A · trains", "Plan B · buses + car share". */
export function planLabel(name: string, legs: LegLike[]): string {
  const modes = [...new Set(legs.map((l) => chosen(l.options)?.mode).filter((m): m is Mode => !!m))];
  return modes.length ? `${name} · ${modes.map((m) => MODE_PLURAL[m]).join(" + ")}` : name;
}

export type TripStatus = "DRAFT" | "BOOKED" | "PAST";

export function tripStatus(trip: { endDate: Date }, legs: { options: { status: OptionStatus }[] }[], now: Date): TripStatus {
  if (dayStart(trip.endDate) < dayStart(now)) return "PAST";
  if (legs.length > 0 && legs.every((l) => l.options.some((o) => o.status === "BOOKED"))) return "BOOKED";
  return "DRAFT";
}
