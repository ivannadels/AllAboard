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
- `lib/co2.ts`, `lib/co2-factors.ts`: emissions (placeholder factors, verify against EEA / ADEME)
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

## Conventions

- `Option.priceCents` and `Option.co2Grams` are **per traveler** and equal the sum of the option's `Segment`s; trip totals multiply by `trip.travelers`.
- Saving a search result re-fetches it server-side by `externalId` (`provider.getJourney`), so prices posted by the browser are never trusted.
- Adding schema fields? Restart `npm run dev` after `prisma generate`: the dev server caches the Prisma client across hot reloads.
- Times are floating local wall-clock times stored as UTC; format with `timeZone: "UTC"` (`lib/format.ts`).
- `Option.priceAdjustPct` holds manual price bumps (demo "force price rise") so rechecks keep them.
