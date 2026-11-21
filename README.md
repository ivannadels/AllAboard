# AllAboard

AllAboard aims to reduce emissions from energy consumption by making more sustainable travel choices easier, more visible, and more appealing. Unlike conventional travel platforms that often present flights alongside trains and buses, or prioritise air travel based on price and convenience, AllAboard is a **train- and bus-first trip planning and booking platform**. It allows users to plan and book journeys exclusively using lower-emission alternatives to flying.

By placing rail and bus travel at the centre of the travel planning experience, AllAboard encourages users to reconsider flying as their default option for European travel. To support this, the platform displays estimated CO₂ emissions for the equivalent flight of each journey, allowing users to factor environmental impact into their decision-making rather than considering price and travel time alone.

AllAboard also incorporates bike-sharing information into its trip planning board, encouraging sustainable mobility for the first and last mile of a journey. Emissions estimates are updated as itineraries are planned or modified, helping users understand the environmental impact of their travel choices.

Beyond reducing emissions directly, AllAboard aims to encourage a longer-term shift in travel habits and attitudes towards more sustainable ways of exploring Europe, making lower-emission travel a more accessible and natural choice.

---

## What the prototype does

- **Search** trains, coaches and car shares across 29 European stations, with connections (up to 2 changes). Results are ranked **greenest first**, and every option shows its CO₂e next to the price and against the flight it replaces. Flights are never sold.
- **Plan on a trip board**: a week calendar of your journeys, stays and activities; the journeys you've chosen with price trends and cheaper like-for-like swaps; "things to do" per city; bike share at each arrival station; a checklist; budget; and the flight you didn't take. Widgets can be dragged around and hidden.
- **Compare plans** of the same trip (e.g. Plan A by train, Plan B by bus and car share), each with its own totals and emissions.
- **Book and pay** for all legs in one checkout (Stripe, test mode).

## Where the data comes from

| Data | Source today | Real or mock? |
| --- | --- | --- |
| Stations (29, in FR, BE, NL, DE, ES, IT, CH) | `data/fixtures/stations.json` | **Real** names and coordinates |
| Timetables and routes | A hand-built network of ~40 rail and bus links (`data/fixtures/network.json`); our own route finder builds journeys from it | **Mock**: realistic but invented departure times |
| Fares and price history | Our own pricing formula (`lib/pricing.ts`) | **Mock** |
| Seats left | Fixture values or generated | **Mock** |
| CO₂e emissions | Published factors: UK DESNZ 2026, Ember 2025 grid data, rail energy studies (see below) | **Real methodology**, estimated per journey |
| Bike share at stations | `data/fixtures/bikeshare.json`, varied by day | **Mock** counts, real operator names |
| Things to do | `data/fixtures/attractions.json` | Real places, **mock** descriptions and walking times |
| Payments | Stripe Checkout, test mode | **Real Stripe API** (test cards only) |
| "Now" | A simulated clock fixed at 1 March 2027 | Demo setting |

Everything except Stripe runs offline. Journeys, bike share and payments sit behind small interfaces (`TransportProvider`, `BikeShareProvider`, `lib/payments`), so live sources can replace the mocks without touching the UI.

## How we calculate

### Emissions (CO₂e per traveller)

We estimate **CO₂-equivalent, well-to-wheel**: the fuel or electricity a journey uses, including producing it (the scope ISO 14083 asks for). Building vehicles and infrastructure is not included. A journey's total is the sum of its segments.

| Mode | Method | Example |
| --- | --- | --- |
| **Train** | Electricity per passenger-km × the carbon intensity of the country's grid. High-speed trains (averaging 125+ km/h) use ~54 Wh per passenger-km, intercity trains ~80 Wh. Cross-border trains use the average of both countries' grids. | Paris → Amsterdam (Eurostar): **8 g/km**. Amsterdam → Berlin (intercity): **23.5 g/km** |
| **Coach** | 46 g per passenger-km (DESNZ 2026) | Paris → Amsterdam: 23 kg |
| **Car share** | 210 g per car-km (DESNZ 2026 average car), divided by the driver plus your group, counting at least 3 people | 3 travellers + driver: **52.5 g/km** each |
| **Flight you didn't take** | Straight-line distance + 8% for real flight paths, at 148 g per passenger-km (DESNZ short-haul economy), **including** the extra warming from contrails and other effects at altitude (97 g counting CO₂ only) | Paris → Amsterdam: **68.6 kg** per person |

Grid carbon intensity (Ember, 2025, g CO₂e per kWh): Switzerland 39 · France 41 · Luxembourg 111 · Austria 117 · Belgium 151 · Spain 154 · UK 218 · Netherlands 254 · Italy 285 · Germany 334 · other countries use the EU average of 211. This is why the same train emits several times more in Germany than in France.

For the demo "Spring loop" (Paris → Amsterdam → Berlin → Paris, 3 travellers), the train plan emits **90 kg** against **901 kg** for flying (−90%), and the bus and car-share plan emits **319 kg** (−65%).

Sources: [UK DESNZ GHG conversion factors 2026](https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026) · [Ember yearly electricity data](https://ember-energy.org/data/yearly-electricity-data/) · train energy use from the Green Train programme (46–62 Wh/passenger-km, high-speed) and [KTH](https://www.kth.se/polopoly_fs/1.179879.1600688474!/Menu/general/column-content/attachment/Energy_060925_full_pdf.pdf) (~80 Wh/passenger-km, long-distance). All factors live in [`lib/co2-factors.ts`](lib/co2-factors.ts), and the app explains them in a "How we calculate" dialog.

Known simplifications: a cross-border train counts half its distance on each country's grid; whether a train is high-speed is inferred from its average speed; the car-share minimum of 3 people is our assumption; real emissions depend on the actual train, occupancy and route.

### Routes

The route finder searches the timetable for journeys between any stations in the origin and destination cities, with up to 2 changes. Changes need at least 15 minutes at the same station, or 60 minutes to cross a city between stations. Every hop has to get closer to the destination, car shares are only offered as direct trips, and journeys that another option beats on time, changes, price and emissions are dropped.

### Prices (mock)

Until real fares are connected, prices come from a formula: distance × a rate per mode (train €0.12/km, coach €0.06, car share €0.07), adjusted by operator. Prices rise as departure approaches: flat beyond 60 days out, then steeper inside 14 days. Train fares never go down, like real rail fare buckets; bus and car-share fares can dip. The same journey always gets the same price on the same day, so demos are reproducible. Each result shows 21 days of price history and a forecast such as "Book soon: fares typically rise 10% over the next 2 weeks".

### Payments

One checkout covers every leg: each fare × travellers, plus a **€1.50 AllAboard booking fee per leg per traveller**. Prices are recalculated on the server when you pay, and if they changed you see the new total before anything is charged. After payment the legs are marked booked, and the app records what each operator is owed. Those fares are settled with operators outside Stripe for now.

## What still needs integrating

1. **Live journeys and timetables.** Replace the mock network with [Transitous](https://transitous.org) (an open European journey planner) behind `TransportProvider`. It returns schedules but no prices, so our pricing formula would keep running on real distances. The demo clock (2027) must move to real dates first, because real timetables only exist a few months ahead.
2. **Real fares and ticket issuing.** Prices are mock, and "booked" is only a status in AllAboard. Real tickets need operator or distribution APIs (e.g. Distribusion, Trainline Partner Solutions, or operators directly), plus refunds and cancellations.
3. **Live bike share.** Replace the fixture with open GBFS feeds (e.g. Vélib' in Paris, Bicing in Barcelona, nextbike and Donkey Republic). OV-fiets and Lime don't publish open feeds.
4. **Price alerts.** An alert is created for every saved journey, but nothing checks prices yet. Still to build: the price recheck, the notification bell, and a demo panel to fast-forward the clock or force a price rise.
5. **Plan comparison page.** Side-by-side Plan A / Plan B view with totals, time, emissions and number of changes.
6. **Things to do from real data.** Suggestions come from a small fixture; a points-of-interest source (e.g. OpenStreetMap or Wikidata) would cover every city.
7. **Accounts and sharing.** The collaborator avatars and Share button are previews; a single demo user is built in.
8. **Emissions refinements.** Split cross-border trains by the actual distance in each country, use train types from the journey data instead of inferring them from speed, and use real occupancy where operators publish it.
9. **Payments before going live.** Stripe Tax is currently **off** in checkout, so the booking dialog, return page and this file's mentions of VAT need updating, or Tax switched back on. Optional Stripe Connect payouts to operators are built but not enabled. The tax treatment of fares and fees needs a tax adviser. See [`STRIPE_INTEGRATION_TODO.md`](STRIPE_INTEGRATION_TODO.md).

## Run it locally

Requires Node.js 22+.

```bash
npm i                      # install (also generates the database client)
npx prisma migrate dev     # create the local SQLite database
npm run seed               # load the demo trips
npm run dev                # open http://localhost:3000
```

No configuration is needed: without Stripe keys, checkout uses a clearly labelled mock. To use Stripe test mode, put `STRIPE_SECRET_KEY=sk_test_…` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…` in `.env.local` (git-ignored) and pay with card `4242 4242 4242 4242`. Full Stripe setup, including webhooks and the optional sandbox script, is in [`STRIPE_INTEGRATION_TODO.md`](STRIPE_INTEGRATION_TODO.md).

| Command | What it does |
| --- | --- |
| `npm run seed` | Reset the demo data (always the same result) |
| `npm test` | Unit tests (emissions, pricing, routing, board, payments) |
| `npm run typecheck` | TypeScript checks |
| `npm run stripe:setup` | Optional Stripe sandbox setup |

## Where things live

Next.js (App Router) + TypeScript, SQLite via Prisma, Tailwind. The main entry points are `lib/co2.ts` (emissions), `lib/providers/` (journeys), `lib/pricing.ts` (mock fares), `lib/payments/` (checkout), and the pages in `app/` (`/` search, `/trips`, `/trips/[id]` board).
