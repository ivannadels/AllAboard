"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getAttraction } from "@/lib/attractions";
import { cityStops, isoDay, stopDays } from "@/lib/board";
import { formatDay } from "@/lib/format";
import { normalizeLayout, serializeLayout } from "@/lib/board-layout";
import {
  ItineraryError,
  addAgendaItem,
  addChecklistItem,
  checkAgendaSchedule,
  createTrip,
  duplicateVariant,
  findOrCreateLeg,
  markBooked,
  removeAgendaItems,
  removeChecklistItem,
  removeOption,
  restoreAgendaItems,
  saveDraftToLeg,
  selectOption,
  setChecklistItemDone,
  type AgendaInput,
  type NewTripInput,
} from "@/lib/itinerary";
import { normalize } from "@/lib/text";
import { PriceChangedError, closeBooking, finalizeBooking, quoteBooking, startCheckout } from "@/lib/payments/booking";
import type { Quote } from "@/lib/payments/pricing";
import { paymentsMode } from "@/lib/payments/stripe";
import { getProvider } from "@/lib/providers";
import { getSimNow } from "@/lib/sim-clock";

export type ActionResult =
  | { ok: true; message: string; tripId?: string; legCreated?: boolean; alreadySaved?: boolean }
  | { ok: false; error: string };

const fail = (err: unknown): ActionResult => ({
  ok: false,
  error: err instanceof ItineraryError ? err.message : "Something went wrong. Please try again.",
});

/**
 * Re-fetch the journey server-side; never trust prices posted by the browser. Emissions are
 * computed for the trip's group (car-share occupancy depends on it).
 */
async function loadJourney(externalId: string, travelers: number) {
  const now = await getSimNow();
  const draft = await getProvider().getJourney(externalId, now, travelers);
  if (!draft) throw new ItineraryError("This journey is no longer available. Try searching again.");
  return { draft, now };
}

function checkSeats(seatsLeft: number | null, travelers: number) {
  if (seatsLeft != null && seatsLeft < travelers) {
    throw new ItineraryError(`Only ${seatsLeft} seats left. Not enough for ${travelers} travelers.`);
  }
}

/** Add a search result to a trip plan: joins the matching leg or creates a new one. */
export async function addJourneyToPlan(input: { externalId: string; variantId: string }): Promise<ActionResult> {
  try {
    const variant = await prisma.variant.findUnique({ where: { id: input.variantId }, include: { trip: true } });
    if (!variant) throw new ItineraryError("Plan not found");
    const { draft, now } = await loadJourney(input.externalId, variant.trip.travelers);
    checkSeats(draft.seatsLeft, variant.trip.travelers);

    const first = draft.segments[0];
    const last = draft.segments[draft.segments.length - 1];
    const { legId, created: legCreated } = await findOrCreateLeg(variant.id, {
      originId: first.origin.id,
      destId: last.dest.id,
      date: draft.departAt,
    });
    const { created } = await saveDraftToLeg(legId, draft, now);
    refresh();
    return {
      ok: true,
      tripId: variant.tripId,
      legCreated,
      alreadySaved: !created,
      message: !created
        ? `Already in ${variant.name}`
        : legCreated
          ? `New leg added to ${variant.name}`
          : `Added to ${variant.name} as an option`,
    };
  } catch (err) {
    return fail(err);
  }
}

/** Save a search result straight to a known leg (search opened from that leg). */
export async function addJourneyToLeg(input: { externalId: string; legId: string }): Promise<ActionResult> {
  try {
    const leg = await prisma.leg.findUnique({ where: { id: input.legId }, include: { variant: { include: { trip: true } } } });
    if (!leg) throw new ItineraryError("Leg not found");
    const { draft, now } = await loadJourney(input.externalId, leg.variant.trip.travelers);
    checkSeats(draft.seatsLeft, leg.variant.trip.travelers);
    const { created } = await saveDraftToLeg(leg.id, draft, now);
    refresh();
    return {
      ok: true,
      tripId: leg.variant.tripId,
      alreadySaved: !created,
      message: created ? `Saved to ${leg.variant.name}` : `Already saved to this leg`,
    };
  } catch (err) {
    return fail(err);
  }
}

export async function selectOptionAction(optionId: string): Promise<ActionResult> {
  try {
    const option = await selectOption(optionId);
    const leg = await prisma.leg.findUniqueOrThrow({ where: { id: option.legId }, include: { variant: true } });
    refresh();
    return { ok: true, tripId: leg.variant.tripId, message: "Selected" };
  } catch (err) {
    return fail(err);
  }
}

export async function removeOptionAction(optionId: string): Promise<ActionResult> {
  try {
    const option = await prisma.option.findUnique({ where: { id: optionId }, include: { leg: { include: { variant: true } } } });
    if (!option) throw new ItineraryError("Option not found");
    await removeOption(optionId);
    refresh();
    return { ok: true, tripId: option.leg.variant.tripId, message: "Removed" };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// Board widgets
// ---------------------------------------------------------------------------

/** Run a mutation, refresh the page, and map errors to a friendly message. */
async function run(message: string, fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
    refresh();
    return { ok: true, message };
  } catch (err) {
    return fail(err);
  }
}

export async function addAgendaAction(input: AgendaInput) {
  return run("Added to your week", () => addAgendaItem(input));
}

export type RemovedAgendaItem = Awaited<ReturnType<typeof removeAgendaItems>>[number];

export async function removeAgendaAction(ids: string[]): Promise<ActionResult & { removed?: RemovedAgendaItem[] }> {
  try {
    const removed = await removeAgendaItems(ids);
    refresh();
    return { ok: true, message: "Removed", removed };
  } catch (err) {
    return fail(err);
  }
}

export async function restoreAgendaAction(items: RemovedAgendaItem[]) {
  return run("Restored", () => restoreAgendaItems(items));
}

/**
 * Put a "Things to do" suggestion on the plan at the day and time the traveller picked (any
 * day they're in that city). If it's already on the plan, it moves instead of duplicating.
 */
export async function addAttractionAction(input: {
  variantId: string;
  attractionId: string;
  date: string;
  time: string;
  endTime: string;
}): Promise<ActionResult> {
  try {
    const attraction = getAttraction(input.attractionId);
    if (!attraction) throw new ItineraryError("Unknown suggestion");
    checkAgendaSchedule(input.date, input.time, input.endTime);
    if (!input.time) throw new ItineraryError("Pick a start time");
    const variant = await prisma.variant.findUnique({
      where: { id: input.variantId },
      include: { trip: true, agenda: true, legs: { include: { origin: true, dest: true, options: { include: { segments: { include: { origin: true, dest: true } } } } } } },
    });
    if (!variant) throw new ItineraryError("Plan not found");
    const stop = cityStops(variant.legs, variant.trip.endDate).find((s) => normalize(s.city) === attraction.city);
    if (!stop) throw new ItineraryError("This plan doesn't stop in that city");
    if (!stopDays(stop).some((d) => isoDay(d) === input.date)) {
      throw new ItineraryError(`Pick a day while you're in ${stop.city}`);
    }

    const when = `${formatDay(new Date(`${input.date}T00:00:00Z`))} ${input.time}`;
    const existing = variant.agenda.find((a) => a.attractionId === attraction.id);
    if (existing) {
      await prisma.agendaItem.update({
        where: { id: existing.id },
        data: { date: new Date(`${input.date}T00:00:00.000Z`), time: input.time, endTime: input.endTime || null },
      });
      refresh();
      return { ok: true, message: `${attraction.name} moved to ${when}` };
    }
    await addAgendaItem({
      variantId: variant.id,
      date: input.date,
      time: input.time,
      endTime: input.endTime || null,
      kind: "ACTIVITY",
      title: attraction.name,
      location: stop.city,
      attractionId: attraction.id,
    });
    refresh();
    return { ok: true, message: `${attraction.name} added for ${when}` };
  } catch (err) {
    return fail(err);
  }
}

export async function addChecklistAction(tripId: string, text: string) {
  return run("Added", () => addChecklistItem(tripId, text));
}

export async function toggleChecklistAction(id: string, done: boolean) {
  return run(done ? "Done" : "Reopened", () => setChecklistItemDone(id, done));
}

export async function removeChecklistAction(id: string) {
  return run("Removed", () => removeChecklistItem(id));
}

export async function duplicatePlanAction(variantId: string): Promise<ActionResult & { variantId?: string }> {
  try {
    const copy = await duplicateVariant(variantId);
    refresh();
    return { ok: true, message: `${copy.name} created`, tripId: copy.tripId, variantId: copy.id };
  } catch (err) {
    return fail(err);
  }
}

export async function bookAction(optionIds: string[]) {
  return run("Marked as booked", async () => {
    const n = await markBooked(optionIds);
    if (n === 0) throw new ItineraryError("Nothing to book. Select an option first.");
  });
}

export async function createTripAction(input: NewTripInput): Promise<ActionResult> {
  try {
    const trip = await createTrip(input);
    refresh();
    return { ok: true, message: "Trip created", tripId: trip.id };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Save the board's widget arrangement. The payload is normalized (unknown widgets dropped,
 * missing ones restored), so a bad client can't corrupt the layout. No page refresh: the
 * board already shows the new arrangement.
 */
export async function saveBoardLayoutAction(tripId: string, layout: unknown): Promise<ActionResult> {
  try {
    const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { id: true } });
    if (!trip) throw new ItineraryError("Trip not found");
    await prisma.trip.update({ where: { id: tripId }, data: { boardLayout: serializeLayout(normalizeLayout(layout)) } });
    return { ok: true, message: "Layout saved", tripId };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export type QuoteResult = { ok: true; quote: Quote; mode: "stripe" | "mock" } | { ok: false; error: string };

/** Price the selected legs right now (server-side) for the checkout dialog. */
export async function quoteBookingAction(optionIds: string[]): Promise<QuoteResult> {
  try {
    return { ok: true, quote: await quoteBooking(optionIds), mode: paymentsMode() };
  } catch (err) {
    return { ok: false, error: err instanceof ItineraryError ? err.message : "Couldn't price these legs. Please try again." };
  }
}

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string; quote?: Quote };

/**
 * Create the booking and get a payment URL (Stripe Checkout, or the mock checkout without a
 * key). `expectedTotalCents` is what the traveler saw; if fares moved, nothing is charged and
 * the new quote comes back for review.
 */
export async function startCheckoutAction(optionIds: string[], expectedTotalCents: number): Promise<CheckoutResult> {
  try {
    const h = await headers();
    const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
    const { url } = await startCheckout(optionIds, expectedTotalCents, origin);
    return { ok: true, url };
  } catch (err) {
    if (err instanceof PriceChangedError) return { ok: false, error: err.message, quote: err.quote };
    if (err instanceof ItineraryError) return { ok: false, error: err.message };
    console.error("checkout failed", err);
    return { ok: false, error: "Couldn't start the payment. Please try again." };
  }
}

/** The mock checkout's Pay / Decline buttons (only when Stripe isn't configured). */
export async function mockPaymentAction(bookingId: string, outcome: "pay" | "decline"): Promise<ActionResult> {
  try {
    if (paymentsMode() !== "mock") throw new ItineraryError("Mock payments are off because Stripe is configured.");
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.provider !== "mock") throw new ItineraryError("Booking not found");
    if (outcome === "pay") await finalizeBooking(bookingId, {});
    else await closeBooking(bookingId, "FAILED");
    return { ok: true, message: outcome === "pay" ? "Paid" : "Payment declined", tripId: booking.tripId };
  } catch (err) {
    return fail(err);
  }
}
