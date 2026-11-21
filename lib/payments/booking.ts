import "server-only";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { formatDay, formatTime } from "@/lib/format";
import { ItineraryError } from "@/lib/itinerary";
import { priceAt } from "@/lib/pricing";
import { getSimNow } from "@/lib/sim-clock";
import { BOOKING_FEE_CENTS, BOOKING_FEE_TAX_CODE, FARE_TAX_CODE, buildQuote, type Quote } from "./pricing";
import { getStripe } from "./stripe";

/** Thrown when fares moved between showing the quote and paying. Carries the new quote. */
export class PriceChangedError extends Error {
  constructor(public quote: Quote) {
    super("Prices changed since you opened checkout. Please review the new total.");
  }
}

/** Load the chosen options of one plan and price them now (server-side, never from the client). */
async function loadQuote(optionIds: string[]) {
  const ids = [...new Set(optionIds)];
  if (ids.length === 0) throw new ItineraryError("Nothing to book. Select an option first.");
  const options = await prisma.option.findMany({
    where: { id: { in: ids } },
    include: {
      segments: { orderBy: { sortOrder: "asc" }, include: { origin: true, dest: true } },
      leg: { include: { origin: true, dest: true, variant: { include: { trip: true } } } },
    },
    orderBy: { departAt: "asc" },
  });
  if (options.length !== ids.length) throw new ItineraryError("Some of these journeys no longer exist.");
  const variantIds = new Set(options.map((o) => o.leg.variantId));
  if (variantIds.size !== 1) throw new ItineraryError("Book one plan at a time.");
  const notChosen = options.find((o) => o.status !== "SELECTED");
  if (notChosen) {
    throw new ItineraryError(notChosen.status === "BOOKED" ? "One of these legs is already booked." : "Only selected options can be booked.");
  }

  const now = await getSimNow();
  const { variant } = options[0].leg;
  const quote = buildQuote(
    options.map((o) => ({
      optionId: o.id,
      title: `${o.operator} · ${o.segments[0].origin.city} → ${o.segments[o.segments.length - 1].dest.city}`,
      detail: `${formatDay(o.departAt)} · ${formatTime(o.departAt)}–${formatTime(o.arriveAt)}`,
      operator: o.operator,
      segments: o.segments.map((s) => ({
        operator: s.operator,
        priceCents: priceAt({ mode: s.mode, operator: s.operator, departAt: s.departAt, distanceKm: s.distanceKm, priceAdjustPct: o.priceAdjustPct }, now),
      })),
      shownPriceCents: o.priceCents,
    })),
    variant.trip.travelers,
  );
  return { quote, variant, options };
}

export async function quoteBooking(optionIds: string[]): Promise<Quote> {
  return (await loadQuote(optionIds)).quote;
}

/**
 * Create a PENDING booking at the current price and start payment. Returns where to send the
 * traveler: Stripe Checkout (test mode) or the built-in mock checkout.
 */
export async function startCheckout(optionIds: string[], expectedTotalCents: number, origin: string): Promise<{ url: string; bookingId: string }> {
  const { quote, variant } = await loadQuote(optionIds);
  if (quote.totalCents !== expectedTotalCents) throw new PriceChangedError(quote);

  const stripe = getStripe();
  const booking = await prisma.$transaction(async (tx) => {
    // Keep the board in sync with what the traveler is about to pay.
    for (const item of quote.items) {
      if (item.changeCents !== 0) await tx.option.update({ where: { id: item.optionId }, data: { priceCents: item.fareCents } });
    }
    return tx.booking.create({
      data: {
        tripId: variant.tripId,
        variantId: variant.id,
        provider: stripe ? "stripe" : "mock",
        travelers: quote.travelers,
        faresCents: quote.faresCents,
        feeCents: quote.feeCents,
        totalCents: quote.totalCents,
        items: {
          create: quote.items.map((i) => ({
            optionId: i.optionId,
            description: `${i.title} · ${i.detail}`,
            operator: i.operator,
            fareCents: i.fareCents,
            travelers: i.travelers,
          })),
        },
        transfers: { create: quote.transfers.map((t) => ({ operator: t.operator, amountCents: t.amountCents })) },
      },
    });
  });

  if (!stripe) return { url: `/checkout/mock/${booking.id}`, bookingId: booking.id };

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      client_reference_id: booking.id,
      metadata: { booking_id: booking.id, trip_id: variant.tripId },
      payment_intent_data: { transfer_group: booking.id, metadata: { booking_id: booking.id } },
      line_items: [
        ...quote.items.map((i) => ({
          quantity: i.travelers,
          price_data: {
            currency: "eur",
            unit_amount: i.fareCents,
            tax_behavior: "inclusive" as const,
            product_data: { name: i.title, description: `${i.detail} · fare per traveller`, tax_code: FARE_TAX_CODE },
          },
        })),
        {
          quantity: quote.feeUnits,
          price_data: {
            currency: "eur",
            unit_amount: BOOKING_FEE_CENTS,
            tax_behavior: "inclusive" as const,
            product_data: { name: "AllAboard booking fee", description: "Per leg, per traveller (VAT included)", tax_code: BOOKING_FEE_TAX_CODE },
          },
        },
      ],
      // Checkout Studio settings (see STRIPE_INTEGRATION_TODO.md).
      ui_mode: "hosted_page",
      automatic_tax: { enabled: false },
      billing_address_collection: "auto",
      phone_number_collection: { enabled: false },
      allow_promotion_codes: false,
      submit_type: "auto",
      integration_identifier: "hosted_web_0001",
      origin_context: "web",
      success_url: `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/return?booking=${booking.id}&cancelled=1`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    },
    { idempotencyKey: `aa-checkout-${booking.id}` },
  );
  await prisma.booking.update({ where: { id: booking.id }, data: { checkoutSessionId: session.id } });
  if (!session.url) throw new Error("Stripe didn't return a checkout URL");
  return { url: session.url, bookingId: booking.id };
}

/**
 * Mark a booking paid: options become BOOKED, then each operator is paid its share.
 * Safe to call repeatedly (return page + webhook): only the first call does the work.
 */
export async function finalizeBooking(bookingId: string, payment: { paymentIntentId?: string; chargeId?: string; taxCents?: number }) {
  const claimed = await prisma.$transaction(async (tx) => {
    const res = await tx.booking.updateMany({
      where: { id: bookingId, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date(), paymentIntentId: payment.paymentIntentId ?? null, taxCents: payment.taxCents ?? 0 },
    });
    if (res.count === 0) return false;
    const items = await tx.bookingItem.findMany({ where: { bookingId } });
    for (const item of items) {
      const option = await tx.option.findUnique({ where: { id: item.optionId } });
      if (!option) continue;
      // The paid option becomes the leg's booked choice, even if the traveler swapped meanwhile.
      await tx.option.updateMany({ where: { legId: option.legId, status: "SELECTED", id: { not: option.id } }, data: { status: "CANDIDATE" } });
      await tx.option.update({ where: { id: option.id }, data: { status: "BOOKED" } });
    }
    return true;
  });
  if (claimed) await payOperators(bookingId, payment.chargeId);
  return claimed;
}

/** Separate charges and transfers: one Stripe transfer per operator, funded by this charge. */
async function payOperators(bookingId: string, chargeId?: string) {
  const stripe = getStripe();
  const transfers = await prisma.bookingTransfer.findMany({ where: { bookingId, status: "pending" } });
  const accounts = new Map((await prisma.operatorAccount.findMany()).map((a) => [a.operator, a]));

  for (const t of transfers) {
    const account = accounts.get(t.operator);
    if (!stripe || !chargeId) {
      await prisma.bookingTransfer.update({ where: { id: t.id }, data: { status: "skipped", note: "Mock payment; settled outside Stripe" } });
      continue;
    }
    if (!account || account.transfersStatus !== "active") {
      await prisma.bookingTransfer.update({
        where: { id: t.id },
        data: { status: "skipped", note: account ? `Settled outside Stripe (Connect transfers ${account.transfersStatus})` : "Settled outside Stripe (Connect not enabled)" },
      });
      continue;
    }
    try {
      const transfer = await stripe.transfers.create(
        {
          amount: t.amountCents,
          currency: "eur",
          destination: account.stripeAccountId,
          transfer_group: bookingId,
          source_transaction: chargeId,
          metadata: { booking_id: bookingId, operator: t.operator },
        },
        { idempotencyKey: `aa-transfer-${t.id}` },
      );
      await prisma.bookingTransfer.update({ where: { id: t.id }, data: { status: "sent", stripeTransferId: transfer.id, note: null } });
    } catch (err) {
      await prisma.bookingTransfer.update({ where: { id: t.id }, data: { status: "failed", note: (err as Error).message.slice(0, 300) } });
    }
  }
}

export async function closeBooking(bookingId: string, status: "FAILED" | "CANCELED") {
  await prisma.booking.updateMany({ where: { id: bookingId, status: "PENDING" }, data: { status } });
}

/** Bring a booking in line with its Checkout Session (used by the return page and the webhook). */
export async function syncCheckoutSession(sessionOrId: string | Stripe.Checkout.Session) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const id = typeof sessionOrId === "string" ? sessionOrId : sessionOrId.id;
  const session = await stripe.checkout.sessions.retrieve(id, { expand: ["payment_intent"] });
  const bookingId = session.metadata?.booking_id ?? session.client_reference_id;
  if (!bookingId) return null;

  if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
    const pi = session.payment_intent as Stripe.PaymentIntent | null;
    const chargeId = typeof pi?.latest_charge === "string" ? pi.latest_charge : pi?.latest_charge?.id;
    await finalizeBooking(bookingId, { paymentIntentId: pi?.id, chargeId, taxCents: session.total_details?.amount_tax ?? 0 });
  } else if (session.status === "expired") {
    await closeBooking(bookingId, "CANCELED");
  }
  return bookingId;
}
