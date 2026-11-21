# Stripe integration: TODO

Single source of truth for the remaining Stripe setup. AllAboard uses **hosted Stripe Checkout**: travellers are redirected to a Stripe-hosted page to pay for their legs, then sent back to the app.

## Values to Replace

No placeholder values remain. The `sample_only` parameters already use real values in the existing integration, so they were kept:

**Files containing the Checkout Session call:**
- [lib/payments/booking.ts](lib/payments/booking.ts)

| Field | Current Value | Notes |
|-------|---------------|-------|
| mode | `payment` | Correct: each booking is a one-time payment. |
| success_url | `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}` | Real page ([app/checkout/return/page.tsx](app/checkout/return/page.tsx)). `origin` comes from the request, so it works on any domain. |
| cancel_url | `${origin}/checkout/return?booking=<id>&cancelled=1` | Same page; marks the booking cancelled. |
| line_items | Built per booking with `price_data` | Intentionally **not** Price IDs: fares are dynamic (priced on the server at checkout time), plus one "AllAboard booking fee" line (€1.50 × legs × travellers). Nothing to replace. |

## Configured Parameters

These parameters were configured in Checkout Studio and are set exactly as specified.

**Files containing these parameters:**
- [lib/payments/booking.ts](lib/payments/booking.ts)

| Parameter | Value |
|-----------|-------|
| ui_mode | `hosted_page` (stripe-node 23.2.0, i.e. ≥ 21.0.0) |
| billing_address_collection | `auto` |
| phone_number_collection | `{ enabled: false }` |
| automatic_tax | `{ enabled: false }` |
| allow_promotion_codes | `false` |
| submit_type | `auto` |
| integration_identifier | `hosted_web_0001` |
| origin_context | `web` |
| payment_method_collection | Not set: it only applies to `mode: "subscription"`, and bookings use `mode: "payment"`. |

Verified against the Stripe test API on 21 Nov 2026: a session created with exactly these parameters was accepted (`ui_mode: hosted_page`, `automatic_tax.enabled: false`).

### Parameters intentionally kept (not Checkout Studio settings)

The Studio instructions say to remove unlisted parameters. These were kept on purpose because removing them would break the app:

| Parameter | Why it stays |
|-----------|--------------|
| client_reference_id, metadata.booking_id | How the return page and the webhook find the booking to confirm it. |
| payment_intent_data.transfer_group | Groups the Connect transfers that pay each operator their share. |
| expires_at (30 min) | The session is priced at checkout time; expiring it keeps quoted fares from going stale. |
| idempotencyKey (request option) | Prevents a duplicate session for the same booking on retries. |

## Follow-ups from turning Stripe Tax off

`automatic_tax` is now disabled, as configured in Studio. Payments work unchanged, but:

- [ ] **UI copy still mentions VAT.** The booking dialog says "VAT on the fee is calculated at checkout" ([components/board/selected-journeys.tsx](components/board/selected-journeys.tsx)), the return page says VAT is included ([app/checkout/return/page.tsx](app/checkout/return/page.tsx)), and the [README](README.md) Payments section describes Stripe Tax. Update these to match (left untouched to keep this change minimal).
- [ ] `Booking.taxCents` will now always be 0.
- [ ] The `tax_code` / `tax_behavior` values on line items and the Belgian tax registration created by `npm run stripe:setup` are now unused (harmless). If you re-enable tax later, flip `automatic_tax` back on in Studio and in the code, and replace the placeholder head-office address ("Rue de l'Exemple 1, Brussels") in Dashboard → Tax → Settings.

## Setup

**Environment variables** (in `.env.local`, which git ignores; names match the code):

| Variable | Used by |
|----------|---------|
| `STRIPE_SECRET_KEY=sk_test_…` | Server only ([lib/payments/stripe.ts](lib/payments/stripe.ts)). Live keys are refused on purpose. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…` | Reserved for client-side Stripe.js; hosted Checkout doesn't need it. `NEXT_PUBLIC_` is Next.js's browser prefix (this isn't a Vite project). |
| `STRIPE_WEBHOOK_SECRET=whsec_…` | Webhook signature check ([app/api/stripe/webhook/route.ts](app/api/stripe/webhook/route.ts)). Get it with `stripe listen --print-secret`. |

Without `STRIPE_SECRET_KEY`, the app falls back to a labelled mock checkout so it still runs offline.

**Dependencies:** `stripe` (Node SDK 23.2.0; the client is created without an explicit API version, so it uses the SDK's pinned version), Stripe CLI (`npm install -g @stripe/cli`).

**Commands**
- `npm run dev`: the app.
- `npm run stripe:listen`: forwards webhooks to `localhost:3000/api/stripe/webhook` (needs `STRIPE_API_KEY` in the environment, or `stripe login`).
- `npm run stripe:setup`: sandbox setup for Tax and Connect operator accounts. Safe to re-run.

## Project structure (payments)

```
lib/payments/pricing.ts          quote math: fares × travellers + booking fee, per-operator split (unit-tested)
lib/payments/booking.ts          creates the Checkout Session, idempotent confirmation, Connect transfers
lib/payments/stripe.ts           Stripe client (test mode only) or null → mock checkout
app/api/stripe/webhook/route.ts  signature-verified webhook (checkout.session.completed / expired / async_*)
app/checkout/return/page.tsx     success / cancel page; also confirms the payment with Stripe directly
app/checkout/mock/[bookingId]/   mock checkout used when no key is configured
scripts/stripe-setup.ts          sandbox setup (Tax + Connect operator accounts)
prisma/schema.prisma             Booking, BookingItem, BookingTransfer, OperatorAccount
```

## How it works

1. On the trip board, **Book all** (or **Book now** on one leg) asks the server for a quote at today's fares.
2. **Pay** creates a `Booking` (PENDING) and a Checkout Session, then redirects to Stripe. If fares changed in between, nothing is charged and the new total is shown.
3. After payment, Stripe redirects to `/checkout/return`, which confirms the session with Stripe. The `checkout.session.completed` webhook does the same; confirmation is idempotent, so the booking is processed once.
4. Confirmation marks the legs **BOOKED** and records what each operator is owed. These fares are settled with operators **outside Stripe** (see "Optional: Stripe Connect payouts" to automate this).

## Testing

- Card that succeeds: `4242 4242 4242 4242`, any future expiry, any CVC.
- Declined: `4000 0000 0000 0002`. Insufficient funds: `4000 0000 0000 9995`.
- 3-D Secure challenge: `4000 0025 0000 3155`.
- Local methods (e.g. Bancontact) can be tested from the Checkout page in test mode.
- More: https://docs.stripe.com/testing

## Next steps

- [ ] **Roll the secret key** (it was shared in a chat) and update `.env.local`.
- [ ] Update the VAT wording listed under "Follow-ups from turning Stripe Tax off".
- [ ] Fulfillment: issue real tickets through operator/distribution APIs after payment (today "booked" is a status in AllAboard).
- [ ] Refunds and cancellations (refund the charge and reverse the operator transfers).
- [ ] Order history: list a trip's bookings on the board.

## Optional: Stripe Connect payouts

Not enabled, by choice. Without Connect, AllAboard collects the full payment and settles fares with operators outside Stripe (e.g. invoicing or a distribution partner's settlement). In a real business this makes AllAboard the seller of the whole ticket (VAT on fares, refunds and chargebacks for the full amount), so check this with an adviser before going live.

To pay operators automatically instead:

- [ ] In the Stripe Dashboard (sandbox), set up Connect so the platform is responsible for connected accounts' losses (accounts without a Stripe Dashboard).
- [ ] Run `npm run stripe:setup` to create one test connected account per operator.
- [ ] No code changes needed: the next paid booking sends each operator its share (`payment_intent_data.transfer_group` groups them), and the return page shows "paid out via Stripe Connect".

## Resources

- https://support.stripe.com
- https://docs.stripe.com/mcp
