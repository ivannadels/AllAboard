import type Stripe from "stripe";
import { closeBooking, syncCheckoutSession } from "@/lib/payments/booking";
import { getStripe } from "@/lib/payments/stripe";

/**
 * Stripe webhook. Locally: `npm run stripe:listen` forwards events here and prints the
 * signing secret; put it in .env.local as STRIPE_WEBHOOK_SECRET.
 * Confirmation is idempotent, so this and the return page can both run.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return new Response("Stripe webhooks are not configured", { status: 501 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing Stripe-Signature header", { status: 400 });

  let event: Stripe.Event;
  try {
    // Signature verification needs the exact raw body.
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch (err) {
    return new Response(`Invalid signature: ${(err as Error).message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await syncCheckoutSession(event.data.object);
        break;
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const s = event.data.object;
        const bookingId = s.metadata?.booking_id ?? s.client_reference_id;
        if (bookingId) await closeBooking(bookingId, event.type === "checkout.session.expired" ? "CANCELED" : "FAILED");
        break;
      }
      default:
        break; // acknowledged, not used
    }
  } catch (err) {
    console.error(`webhook ${event.type} failed`, err);
    return new Response("Webhook handler failed", { status: 500 }); // Stripe will retry
  }
  return Response.json({ received: true });
}
