// Turns a trip board query into plain, serializable view models for the pin-board UI.
import { attractionsFor, TAG_SWATCH } from "./attractions";
import { normalizeLayout, type BoardLayout } from "./board-layout";
import { getBikeShare, type BikeDock } from "./bikeshare";
import {
  allDayItems,
  attractionSlot,
  calendarEvents,
  chosen,
  cityStops,
  isoDay,
  planLabel,
  priceStrip,
  stayBars,
  stopDays,
  swapSuggestion,
  tripDays,
  tripStatus,
  type CalendarEvent,
  type PriceStrip,
  type StayBar,
  type TripStatus,
} from "./board";
import { formatDateRange, formatDay, formatDuration, formatTime } from "./format";
import type { PriceForecast } from "./pricing";
import type { BoardLeg, BoardOption, TripBoard } from "./queries";
import type { Badge } from "./ranking";
import { searchHref } from "./search-params";
import type { Mode, OptionStatus } from "./types";

const DAY_MS = 86_400_000;
const weekday = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
const dayShort = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });
const plusDays = (a: Date, b: Date) =>
  Math.round(
    (Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) - Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())) / DAY_MS,
  );

export interface OptionView {
  id: string;
  status: OptionStatus;
  mode: Mode;
  operator: string;
  depart: string;
  arrive: string;
  plusDays: number;
  duration: string;
  changes: string;
  priceCents: number;
  co2Grams: number;
  badges: Badge[];
  bookingUrl: string;
  seatsLeft: number | null;
}

export interface JourneyLegView {
  legId: string;
  dateLabel: string;
  originCity: string;
  destCity: string;
  findHref: string;
  chosen: OptionView | null;
  history: number[];
  strip: PriceStrip | null;
  forecast: PriceForecast | null;
  previousPriceCents: number | null;
  swap: { optionId: string; savingCents: number; priceCents: number; depart: string } | null;
  options: OptionView[];
}

export interface AttractionView {
  id: string;
  name: string;
  blurb: string;
  tag: string;
  swatch: string;
  durationMin: number;
  /** Where we'd suggest it (pre-fills the add dialog). */
  suggested: { date: string; time: string; endTime: string; label: string };
  /** Where it currently is on the plan, if added. */
  scheduled: { agendaId: string; date: string; time: string | null; endTime: string | null; label: string } | null;
}

export interface StopView {
  cityKey: string;
  city: string;
  whenLabel: string;
  /** Days you're in this city (arrival → departure), for the day picker. */
  days: { iso: string; label: string }[];
  attractions: AttractionView[];
}

export interface BoardView {
  layout: BoardLayout;
  trip: {
    id: string;
    name: string;
    dateRange: string;
    dayCount: number;
    travelers: number;
    status: TripStatus;
  };
  route: string[];
  variantId: string;
  plans: { id: string; label: string; active: boolean }[];
  calendar: {
    days: { iso: string; weekday: string; dayNum: string; month: string }[];
    events: CalendarEvent[];
    stays: StayBar[];
    allDay: { id: string; day: string; title: string }[];
  };
  journeys: {
    legs: JourneyLegView[];
    allTrains: boolean;
    totalPerPersonCents: number;
    bookable: { optionId: string; label: string; operator: string; priceCents: number; bookingUrl: string }[];
  };
  co2: { tripGrams: number; flightGrams: number; savedGrams: number; mainMode: Mode | "MIXED" };
  stops: StopView[];
  checklist: { id: string; text: string; done: boolean }[];
  bikes: { stationName: string; city: string; docks: BikeDock[] }[];
  budget: { totalCents: number; transportCents: number; agendaCents: number; budgetCents: number | null };
}

function optionView(o: BoardOption): OptionView {
  return {
    id: o.id,
    status: o.status,
    mode: o.mode,
    operator: o.operator,
    depart: formatTime(o.departAt),
    arrive: formatTime(o.arriveAt),
    plusDays: plusDays(o.departAt, o.arriveAt),
    duration: formatDuration(o.durationMin),
    changes: o.changes === 0 ? "direct" : o.changes === 1 ? `1 change · ${o.segments[0].dest.city}` : `${o.changes} changes`,
    priceCents: o.priceCents,
    co2Grams: o.co2Grams,
    badges: o.badges,
    bookingUrl: o.bookingUrl,
    seatsLeft: o.seatsLeft,
  };
}

function legView(leg: BoardLeg, simNow: Date): JourneyLegView {
  const current = chosen(leg.options);
  const swap = swapSuggestion(leg.options);
  const history = current?.history ?? [];
  const strip = current ? priceStrip(history, simNow) : null;
  return {
    legId: leg.id,
    dateLabel: formatDay(leg.date),
    originCity: leg.origin.city,
    destCity: leg.dest.city,
    findHref: searchHref({ legId: leg.id }),
    chosen: current ? optionView(current) : null,
    history,
    strip,
    forecast: current?.forecast ?? null,
    previousPriceCents: strip?.kind === "rising" ? current!.priceCents - strip.changeCents : null,
    swap: swap
      ? { optionId: swap.option.id, savingCents: swap.savingCents, priceCents: swap.option.priceCents, depart: formatTime(swap.option.departAt) }
      : null,
    options: leg.options.map(optionView),
  };
}

export async function buildBoardView(trip: TripBoard, variantId: string | undefined, simNow: Date): Promise<BoardView | null> {
  const variant = trip.variants.find((v) => v.id === variantId) ?? trip.variants[0];
  if (!variant) return null;

  const legs = variant.legs;
  const days = tripDays(trip.startDate, trip.endDate);
  const stops = cityStops(legs, trip.endDate);
  const scheduledByAttraction = new Map(variant.agenda.filter((a) => a.attractionId).map((a) => [a.attractionId!, a]));
  const chosenOptions = legs.map((l) => chosen(l.options)).filter((o): o is BoardOption => !!o);
  const modes = [...new Set(chosenOptions.map((o) => o.mode))];

  // Bike share at every station you arrive at.
  const arrivalStations = [...new Map(legs.map((l) => [l.dest.id, l.dest])).values()];
  const bikeShare = getBikeShare();
  const bikes = await Promise.all(
    arrivalStations.map(async (s) => ({ stationName: s.name, city: s.city, docks: await bikeShare.docksNear(s.id, simNow) })),
  );

  return {
    layout: normalizeLayout(trip.boardLayout),
    trip: {
      id: trip.id,
      name: trip.name,
      dateRange: formatDateRange(trip.startDate, trip.endDate).toUpperCase(),
      dayCount: days.length,
      travelers: trip.travelers,
      status: tripStatus(trip, legs, simNow),
    },
    route: legs.length ? [legs[0].origin.city, ...legs.map((l) => l.dest.city)] : [],
    variantId: variant.id,
    plans: trip.variants.map((v) => ({ id: v.id, label: planLabel(v.name, v.legs), active: v.id === variant.id })),
    calendar: {
      days: days.map((d) => ({
        iso: isoDay(d),
        weekday: d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
        dayNum: String(d.getUTCDate()),
        month: d.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" }),
      })),
      events: calendarEvents(legs, variant.agenda),
      stays: stayBars(variant.agenda, legs, trip.endDate),
      allDay: allDayItems(variant.agenda),
    },
    journeys: {
      legs: legs.map((l) => legView(l, simNow)),
      allTrains: chosenOptions.length > 0 && chosenOptions.every((o) => o.mode === "TRAIN"),
      totalPerPersonCents: chosenOptions.reduce((s, o) => s + o.priceCents, 0),
      bookable: legs.flatMap((l) => {
        const o = chosen(l.options);
        return o && o.status === "SELECTED"
          ? [{ optionId: o.id, label: `${formatDay(l.date)} · ${l.origin.city} → ${l.dest.city}`, operator: o.operator, priceCents: o.priceCents, bookingUrl: o.bookingUrl }]
          : [];
      }),
    },
    co2: {
      tripGrams: variant.summary.co2Grams,
      flightGrams: variant.summary.flightCo2Grams,
      savedGrams: variant.summary.co2SavedGrams,
      mainMode: modes.length === 1 ? modes[0] : "MIXED",
    },
    stops: stops.map((stop) => ({
      cityKey: stop.cityKey,
      city: stop.city,
      whenLabel: `${dayShort(stop.arrive)} – ${dayShort(stop.leave)} · ${stop.nights} ${stop.nights === 1 ? "night" : "nights"}`,
      days: stopDays(stop).map((d) => ({ iso: isoDay(d), label: dayShort(d) })),
      attractions: attractionsFor(stop.city).map((a) => {
        const slot = attractionSlot(a, stop);
        const item = scheduledByAttraction.get(a.id);
        return {
          id: a.id,
          name: a.name,
          blurb: a.blurb,
          tag: a.tag,
          swatch: TAG_SWATCH[a.tag] ?? "#EAF3EC",
          durationMin: a.durationMin,
          suggested: { date: isoDay(slot.date), time: slot.time, endTime: slot.endTime, label: `${weekday(slot.date)} ${slot.time}` },
          scheduled: item
            ? {
                agendaId: item.id,
                date: isoDay(item.date),
                time: item.time,
                endTime: item.endTime,
                label: `${weekday(item.date)}${item.time ? ` ${item.time}` : ""}`,
              }
            : null,
        };
      }),
    })),
    checklist: trip.checklist.map((c) => ({ id: c.id, text: c.text, done: c.done })),
    bikes,
    budget: {
      totalCents: variant.summary.totalCents,
      transportCents: variant.summary.transportCents,
      agendaCents: variant.summary.agendaCents,
      budgetCents: trip.budgetCents,
    },
  };
}
