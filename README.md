# AllAboard

A sustainable-travel trip draft board: plan a multi-leg itinerary by **train, bus and car share** before buying, compare plans, watch prices, and see the CO2 you save compared with flying. We never sell flights.

Step 1 runs fully **offline on mock data**. Real routing (Transitous) and bike share (GBFS) plug in behind `lib/providers` in Step 2.

## Getting started

```bash
npm i                      # also generates the Prisma client
npx prisma migrate dev     # creates prisma/dev.db (SQLite)
npm run seed               # demo trips, price history, alerts
npm run dev                # http://localhost:3000
```

No env vars needed. Optional: `DATABASE_URL` (default `file:./prisma/dev.db`) and `PROVIDER` (default `mock`).

| Script | What it does |
| --- | --- |
| `npm run seed` | Wipe and reseed the demo data (deterministic) |
| `npm run db:reset` | Drop the DB, re-apply migrations, reseed |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |

## Layout

- `prisma/`: schema, migrations, seed (the seed goes through the same search + save code as the app)
- `data/fixtures/stations.json`, `network.json`: mock stations and a timetabled rail/bus network (no prices; those come from `lib/pricing.ts`)
- `lib/providers/`: `TransportProvider` interface, `getProvider()` factory, and `MockProvider`, whose route finder builds journeys with up to 2 changes (15 min same-station / 60 min cross-city transfers, car shares direct only)
- `lib/search.ts`, `lib/search-params.ts`: filters, enrichment (21-day history, 7-day trend, forecast, vs-flying), badges; URL ⇄ query
- `lib/ranking.ts`: Greenest (default) / Cheapest / Fastest + badges
- `lib/itinerary.ts`: save a journey to a leg (segments, price history, PRICE_UP alert), match or create legs, select / remove
- `lib/co2.ts`, `lib/co2-factors.ts`: emissions in CO₂e per traveller, well-to-wheel (ISO 14083 scope; no manufacturing or infrastructure). Trains = electricity per passenger-km (54 Wh high-speed / 80 Wh intercity, by average speed) × the country's grid intensity (Ember 2025; cross-border = average of both). Coach and car from UK DESNZ 2026 factors; car shares split between the driver and your group (at least 3 people). The "flight you didn't take" = great circle + 8% at DESNZ short-haul economy, including non-CO₂ effects. Sources are listed in `lib/co2-factors.ts` and in the app's "How we calculate" dialog.
- `lib/pricing.ts`: deterministic mock price engine (demand curve, monotonic train fares, journey = sum of segments, forecast)
- `lib/trip-summary.ts`: totals, CO2, "flight you didn't take"
- `lib/sim-clock.ts`: the demo's "now". Time logic never uses `Date.now()`.
- `app/page.tsx`: search; `app/trips/page.tsx`: trips; `app/trips/[id]/page.tsx`: trip board; `app/actions.ts`: server actions

## Pages

The UI follows the pin-board templates (allaboard-templates): 2px ink outlines, hard shadows, lime highlights, Bricolage Grotesque + Inter (self-hosted via `@fontsource`, so it works offline). Tokens live in `app/globals.css`; shared pieces in `components/aa/`.

- `/`: search. `?from=&to=&date=&travelers=&sort=&modes=&maxChanges=&after=&before=`; add `leg=<id>` to save results straight to a leg, or `trip=<id>` to preselect a trip. (`/search` redirects here.)
- `/trips`: your trips, with Drafts / Booked / Past tabs and NEW TRIP.
- `/trips/[id]?plan=<variantId>`: the trip board: week calendar, selected journeys (price strips, swap to a cheaper like-for-like option, options expander, book), CO₂ vs flying, things to do, checklist, bike share, budget. Widgets are modular: drag any widget by its ⠿ handle (mouse, touch, or keyboard: Space, arrows, Space) within or between the wide and narrow columns. "Customize board" hides widgets and resets the layout. The arrangement is saved on the trip (`Trip.boardLayout`, see `lib/board-layout.ts`). "+" duplicates the plan.

Board data: `lib/board.ts` (pure layout/suggestion logic, tested), `lib/board-view.ts` (view models), `data/fixtures/attractions.json`, `data/fixtures/bikeshare.json` behind `lib/bikeshare.ts` (GBFS in Step 2). Collaborators and Share are template previews until accounts arrive (Step 3).

## Payments (Stripe, test mode)

Booking runs through **Stripe Checkout in test mode** when `STRIPE_SECRET_KEY` is set, and through a clearly labelled **mock checkout** when it isn't (so `npm run dev` still works offline). Live keys are refused.

**Model:** AllAboard is the booking agent. One Checkout covers every leg (fare × travellers per line, plus a €1.50 booking fee per leg per traveller). Each booking records what every operator is owed; by default AllAboard **settles with operators outside Stripe**. Optionally, **Stripe Connect** can pay them automatically (*separate charges and transfers*, one transfer per operator, `transfer_group` = booking id). **Stripe Tax** calculates VAT on the booking fee only (`txcd_20030000`); fares pass through as nontaxable (`txcd_00000000`) because the operator's VAT is already in the fare. Have a tax adviser confirm this before going live.

**Setup**

1. Put test keys in `.env.local` (git-ignored): `STRIPE_SECRET_KEY=sk_test_…` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…`.
2. `npm run stripe:setup`: configures Stripe Tax (placeholder Brussels head office, prices include VAT, Belgian registration) and creates one test connected account per operator. Safe to re-run.
   - Connect payouts are **optional**. To enable them, first set up Connect in the sandbox Dashboard so the **platform is responsible for connected accounts' losses** (accounts with no Stripe Dashboard). Without it, fares are settled with operators outside Stripe.
3. Webhooks (optional; the return page also confirms payments): `stripe listen --print-secret` and put the value in `.env.local` as `STRIPE_WEBHOOK_SECRET`, then run `npm run stripe:listen` next to `npm run dev`. The CLI needs `STRIPE_API_KEY` set (or `stripe login`).
4. Pay with test card `4242 4242 4242 4242`, any future expiry, any CVC.

Code: `lib/payments/pricing.ts` (quote math, tested), `lib/payments/booking.ts` (checkout, idempotent confirmation, transfers), `app/api/stripe/webhook/route.ts`, `app/checkout/return`, `app/checkout/mock/[bookingId]`. Tables: `Booking`, `BookingItem`, `BookingTransfer`, `OperatorAccount`.

## Conventions

- `Option.priceCents` and `Option.co2Grams` are **per traveler** and equal the sum of the option's `Segment`s; trip totals multiply by `trip.travelers`.
- Saving a search result re-fetches it server-side by `externalId` (`provider.getJourney`), so prices posted by the browser are never trusted.
- Adding schema fields? Restart `npm run dev` after `prisma generate`: the dev server caches the Prisma client across hot reloads.
- Times are floating local wall-clock times stored as UTC; format with `timeZone: "UTC"` (`lib/format.ts`).
- `Option.priceAdjustPct` holds manual price bumps (demo "force price rise") so rechecks keep them.
