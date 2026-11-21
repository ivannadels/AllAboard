/**
 * Seeds the demo database. Idempotent: wipes everything and rebuilds the same state.
 * Run with `npm run seed`. Journeys come from the MockProvider's route search and are saved
 * through lib/itinerary, so seeded data is exactly what the app itself would produce.
 */
import stations from "@/data/fixtures/stations.json";
import { prisma } from "@/lib/db";
import { saveDraftToLeg } from "@/lib/itinerary";
import { MockProvider } from "@/lib/providers/mock";
import { rankOptions } from "@/lib/ranking";
import { DEFAULT_SIM_START } from "@/lib/sim-clock";
import type { Mode, OptionDraft } from "@/lib/types";

const DAY_MS = 86_400_000;
const eur = (n: number) => Math.round(n * 100);
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

interface LegSpec {
  from: string; // station id
  to: string;
  date: string; // YYYY-MM-DD
  /** Segment key(s) of the journey to mark SELECTED, e.g. "paris-nord>amsterdam-centraal@1013:eurostar". */
  select: string;
  notes?: string;
}

interface AgendaSpec {
  date: string;
  time?: string;
  endTime?: string;
  kind: "STAY" | "ACTIVITY" | "NOTE";
  title: string;
  location?: string;
  costCents?: number;
}

interface VariantSpec {
  name: string;
  legs: LegSpec[];
  agenda: AgendaSpec[];
}

interface TripSpec {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  travelers: number;
  budgetCents: number | null;
  variants: VariantSpec[];
  checklist?: { text: string; done?: boolean }[];
  /** Segment key → a fare-bucket jump that happened `daysAgo` (shows as a recent rise). */
  bumps?: Record<string, { pct: number; daysAgo: number }>;
}

// ---------------------------------------------------------------------------
// Hero trip: Spring loop
// ---------------------------------------------------------------------------

const springAgenda: AgendaSpec[] = [
  { date: "2027-04-15", kind: "STAY", title: "Canal-side guesthouse, 3 nights", location: "Jordaan, Amsterdam", costCents: eur(480) },
  { date: "2027-04-16", time: "10:00", endTime: "13:00", kind: "ACTIVITY", title: "Rijksmuseum", location: "Museumplein, Amsterdam", costCents: eur(3 * 22.5) },
  { date: "2027-04-17", time: "14:00", endTime: "16:30", kind: "ACTIVITY", title: "Bike tour along the Amstel", location: "Amsterdam", costCents: eur(3 * 30) },
  { date: "2027-04-18", kind: "STAY", title: "Apartment, 4 nights", location: "Kreuzberg, Berlin", costCents: eur(560) },
  { date: "2027-04-19", time: "11:00", endTime: "14:00", kind: "ACTIVITY", title: "Museum Island", location: "Mitte, Berlin", costCents: eur(3 * 24) },
  { date: "2027-04-20", time: "16:00", endTime: "18:30", kind: "ACTIVITY", title: "Picnic on Tempelhofer Feld", location: "Berlin" },
  { date: "2027-04-22", time: "20:00", endTime: "21:30", kind: "NOTE", title: "Dinner by the canal Saint-Martin?", location: "Paris" },
];

const springLoop: TripSpec = {
  id: "trip-spring-loop",
  name: "Spring loop",
  startDate: "2027-04-15",
  endDate: "2027-04-22",
  travelers: 3,
  budgetCents: eur(2400), // transport + stays + activities for 3
  checklist: [
    { text: "Book Eurostar Paris → Amsterdam" },
    { text: "Reserve bike spot on the Berlin train" },
    { text: "Buy Museumkaart for Amsterdam" },
    { text: "Book apartment in Kreuzberg", done: true },
    { text: "Pack plug adapter + bike lock" },
  ],
  bumps: { "paris-nord>amsterdam-centraal@1013:eurostar": { pct: 14, daysAgo: 2 } },
  variants: [
    {
      name: "Plan A",
      legs: [
        { from: "paris-nord", to: "amsterdam-centraal", date: "2027-04-15", select: "paris-nord>amsterdam-centraal@1013:eurostar", notes: "Daytime Eurostar, arrive for lunch" },
        { from: "amsterdam-centraal", to: "berlin-hbf", date: "2027-04-18", select: "amsterdam-centraal>berlin-hbf@0800:deutsche-bahn" },
        { from: "berlin-hbf", to: "paris-est", date: "2027-04-22", select: "berlin-hbf>paris-est@0955:deutsche-bahn", notes: "Direct ICE, no changes" },
      ],
      agenda: springAgenda,
    },
    {
      name: "Plan B",
      legs: [
        { from: "paris-nord", to: "amsterdam-centraal", date: "2027-04-15", select: "paris-nord>amsterdam-centraal@0800:flixbus" },
        { from: "amsterdam-centraal", to: "berlin-hbf", date: "2027-04-18", select: "amsterdam-centraal>berlin-hbf@0830:blablacar", notes: "Shared car with one driver" },
        { from: "berlin-hbf", to: "paris-est", date: "2027-04-22", select: "berlin-hbf>paris-est@0815:flixbus" },
      ],
      agenda: springAgenda,
    },
  ],
};

// ---------------------------------------------------------------------------
// Smaller trip: Barcelona
// ---------------------------------------------------------------------------

const barcelona: TripSpec = {
  id: "trip-barcelona",
  name: "Long weekend in Barcelona",
  startDate: "2027-05-20",
  endDate: "2027-05-24",
  travelers: 2,
  budgetCents: eur(750),
  checklist: [{ text: "Book Sagrada Família tickets" }, { text: "Plan the way back" }],
  variants: [
    {
      name: "Plan A",
      legs: [{ from: "paris-lyon", to: "barcelona-sants", date: "2027-05-20", select: "paris-lyon>barcelona-sants@0707:sncf" }],
      agenda: [
        { date: "2027-05-20", kind: "STAY", title: "Hostal, 4 nights", location: "Gràcia, Barcelona", costCents: eur(360) },
        { date: "2027-05-21", time: "10:00", endTime: "12:00", kind: "ACTIVITY", title: "Sagrada Família", location: "Barcelona", costCents: eur(2 * 26) },
        { date: "2027-05-24", kind: "NOTE", title: "Return leg still to plan (via Montpellier?)" },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------

const provider = new MockProvider(); // seed data is always mock, whatever PROVIDER says
const simNow = DEFAULT_SIM_START;
const MAX_CANDIDATES = 5;

/** The selected journey, plus the greenest direct option per mode and one connection. */
function pickCandidates(drafts: OptionDraft[], selected: OptionDraft): OptionDraft[] {
  const ranked = rankOptions(drafts, "greenest");
  const picks = [selected];
  for (const mode of ["TRAIN", "BUS", "CARSHARE"] as Mode[]) {
    const best = ranked.find((d) => d.mode === mode && d.changes === 0 && !picks.includes(d));
    if (best) picks.push(best);
  }
  const connection = ranked.find((d) => d.changes > 0 && !picks.includes(d));
  if (connection) picks.push(connection);
  return picks.slice(0, MAX_CANDIDATES);
}

async function createTrip(spec: TripSpec) {
  await prisma.trip.create({
    data: {
      id: spec.id,
      name: spec.name,
      startDate: day(spec.startDate),
      endDate: day(spec.endDate),
      travelers: spec.travelers,
      budgetCents: spec.budgetCents,
      createdAt: simNow,
    },
  });

  let optionCount = 0;
  for (const [vIdx, v] of spec.variants.entries()) {
    const variant = await prisma.variant.create({ data: { tripId: spec.id, name: v.name, sortOrder: vIdx } });

    for (const [lIdx, l] of v.legs.entries()) {
      const leg = await prisma.leg.create({
        data: {
          variantId: variant.id,
          sortOrder: lIdx,
          originStationId: l.from,
          destStationId: l.to,
          date: day(l.date),
          notes: l.notes ?? null,
        },
      });

      const drafts = await provider.searchJourneys({
        originId: l.from,
        destId: l.to,
        date: l.date,
        travelers: spec.travelers,
        now: simNow,
      });
      const selected = drafts.find((d) => d.externalId === `mock:${l.date}:${l.select}`);
      if (!selected) throw new Error(`Seed: journey "${l.select}" not found for ${l.from} → ${l.to} on ${l.date}`);

      for (const draft of pickCandidates(drafts, selected)) {
        const segmentKeys = draft.externalId.split(":").slice(2).join(":");
        const bump = spec.bumps?.[segmentKeys];
        await saveDraftToLeg(leg.id, draft, simNow, {
          status: draft === selected ? "SELECTED" : "CANDIDATE",
          priceAdjust: bump ? { pct: bump.pct, since: new Date(simNow.getTime() - bump.daysAgo * DAY_MS) } : undefined,
        });
        optionCount++;
      }
    }

    await prisma.agendaItem.createMany({
      data: v.agenda.map((a) => ({
        variantId: variant.id,
        date: day(a.date),
        time: a.time ?? null,
        endTime: a.endTime ?? null,
        kind: a.kind,
        title: a.title,
        location: a.location ?? null,
        costCents: a.costCents ?? null,
      })),
    });
  }
  if (spec.checklist?.length) {
    await prisma.checklistItem.createMany({
      data: spec.checklist.map((c, i) => ({ tripId: spec.id, text: c.text, done: c.done ?? false, sortOrder: i })),
    });
  }
  console.log(`  ✓ ${spec.name}: ${spec.variants.length} variant(s), ${optionCount} options`);
}

async function main() {
  console.log("Seeding AllAboard demo data…");

  // Wipe in dependency order.
  await prisma.$transaction([
    prisma.checklistItem.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.alert.deleteMany(),
    prisma.priceSnapshot.deleteMany(),
    prisma.segment.deleteMany(),
    prisma.option.deleteMany(),
    prisma.leg.deleteMany(),
    prisma.agendaItem.deleteMany(),
    prisma.variant.deleteMany(),
    prisma.trip.deleteMany(),
    prisma.station.deleteMany(),
    prisma.simClock.deleteMany(),
  ]);

  await prisma.simClock.create({ data: { id: 1, now: simNow } });
  await prisma.station.createMany({ data: stations });
  console.log(`  ✓ ${stations.length} stations, sim clock at ${simNow.toISOString()}`);

  await createTrip(springLoop);
  await createTrip(barcelona);
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
