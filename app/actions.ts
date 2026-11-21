"use server";

import { refresh } from "next/cache";
import { prisma } from "@/lib/db";
import { getAttraction } from "@/lib/attractions";
import { attractionSlot, cityStops, isoDay } from "@/lib/board";
import {
  ItineraryError,
  addAgendaItem,
  addChecklistItem,
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
import { getProvider } from "@/lib/providers";
import { getSimNow } from "@/lib/sim-clock";

export type ActionResult =
  | { ok: true; message: string; tripId?: string; legCreated?: boolean; alreadySaved?: boolean }
  | { ok: false; error: string };

const fail = (err: unknown): ActionResult => ({
  ok: false,
  error: err instanceof ItineraryError ? err.message : "Something went wrong. Please try again.",
});

/** Re-fetch the journey server-side; never trust prices posted by the browser. */
async function loadJourney(externalId: string) {
  const now = await getSimNow();
  const draft = await getProvider().getJourney(externalId, now);
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
    const { draft, now } = await loadJourney(input.externalId);
    const variant = await prisma.variant.findUnique({ where: { id: input.variantId }, include: { trip: true } });
    if (!variant) throw new ItineraryError("Plan not found");
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
    const { draft, now } = await loadJourney(input.externalId);
    const leg = await prisma.leg.findUnique({ where: { id: input.legId }, include: { variant: { include: { trip: true } } } });
    if (!leg) throw new ItineraryError("Leg not found");
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

/** Add a "Things to do" suggestion to a plan at its suggested slot. Idempotent. */
export async function addAttractionAction(input: { variantId: string; attractionId: string }) {
  return run("Added to your week", async () => {
    const attraction = getAttraction(input.attractionId);
    if (!attraction) throw new ItineraryError("Unknown suggestion");
    const variant = await prisma.variant.findUnique({
      where: { id: input.variantId },
      include: { trip: true, agenda: true, legs: { include: { origin: true, dest: true, options: { include: { segments: { include: { origin: true, dest: true } } } } } } },
    });
    if (!variant) throw new ItineraryError("Plan not found");
    if (variant.agenda.some((a) => a.attractionId === attraction.id)) return;
    const stop = cityStops(variant.legs, variant.trip.endDate).find((s) => normalize(s.city) === attraction.city);
    if (!stop) throw new ItineraryError("This plan doesn't stop in that city");
    const slot = attractionSlot(attraction, stop);
    await addAgendaItem({
      variantId: variant.id,
      date: isoDay(slot.date),
      time: slot.time,
      endTime: slot.endTime,
      kind: "ACTIVITY",
      title: attraction.name,
      location: stop.city,
      attractionId: attraction.id,
    });
  });
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
