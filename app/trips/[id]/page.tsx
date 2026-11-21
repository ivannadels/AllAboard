import { notFound } from "next/navigation";
import { BikeIcon, CalendarIcon, LeafIcon, PeopleIcon, ShareIcon, TrainIcon } from "@/components/aa/icons";
import { Co2Method } from "@/components/aa/co2-method";
import { DragHandle } from "@/components/aa/drag-handle";
import { PreviewTag } from "@/components/aa/widget";
import { BoardShell } from "@/components/board/board-shell";
import { Checklist } from "@/components/board/checklist";
import { SelectedJourneys } from "@/components/board/selected-journeys";
import { ThingsToDo } from "@/components/board/things-to-do";
import { WeekCalendar } from "@/components/board/week-calendar";
import { buildBoardView, type BoardView } from "@/lib/board-view";
import { formatCo2, formatMoney } from "@/lib/format";
import { getTripBoard } from "@/lib/queries";
import { getSimNow } from "@/lib/sim-clock";

export const dynamic = "force-dynamic";

const STATUS_LABEL = { DRAFT: "Draft · not booked yet", BOOKED: "Booked · have a great trip", PAST: "Past trip" } as const;

// Template collaborators. People & sharing need accounts (Step 3), so this is a preview.
const PREVIEW_PEOPLE = [
  { initials: "JM", title: "Jules M. (you)", bg: "var(--aa-lime)", online: true },
  { initials: "AL", title: "Ana L. (preview)", bg: "#FFFFFF", online: true },
  { initials: "SK", title: "Sam K. (preview)", bg: "var(--aa-sage)", online: false },
];

export default async function TripBoardPage({ params, searchParams }: PageProps<"/trips/[id]">) {
  const { id } = await params;
  const { plan } = await searchParams;
  const simNow = await getSimNow();
  const trip = await getTripBoard(id, simNow);
  if (!trip) notFound();
  const view = await buildBoardView(trip, typeof plan === "string" ? plan : undefined, simNow);
  if (!view) notFound();

  return (
    <div className="flex-1 dot-grid">
      <BoardShell
        tripId={view.trip.id}
        variantId={view.variantId}
        plans={view.plans}
        initialLayout={view.layout}
        headerLeft={<BoardTitle view={view} />}
        headerRightTop={<PeopleAndShare />}
        widgets={{
          calendar: <WeekCalendar calendar={view.calendar} variantId={view.variantId} />,
          bookings: <SelectedJourneys journeys={view.journeys} travelers={view.trip.travelers} />,
          co2: <Co2Widget co2={view.co2} travelers={view.trip.travelers} />,
          attractions: <ThingsToDo stops={view.stops} variantId={view.variantId} events={view.calendar.events} />,
          checklist: <Checklist tripId={view.trip.id} items={view.checklist} />,
          bikes: <BikeShareWidget bikes={view.bikes} />,
          budget: <BudgetWidget budget={view.budget} />,
        }}
      />
    </div>
  );
}

function BoardTitle({ view }: { view: BoardView }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="m-0 font-display-heavy text-[clamp(30px,4vw,40px)] leading-none tracking-[-1.2px] uppercase">{view.trip.name}</h1>
        <span className="inline-flex items-center rounded-md bg-ink px-2 py-1 text-[11px] font-bold tracking-[1px] text-lime uppercase">
          {STATUS_LABEL[view.trip.status]}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-2 text-[13px] font-bold">
        {view.route.map((city, i) => (
          <span key={`${city}-${i}`} className="inline-flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">→</span>}
            <span className="rounded-full border-2 border-ink bg-white px-2.5 py-0.5">{city}</span>
          </span>
        ))}
        <span className="ml-1.5 inline-flex items-center gap-2 rounded-lg border-2 border-ink bg-ink px-2.5 py-1 text-lime shadow-hard-green">
          <CalendarIcon size={15} strokeWidth={2.4} />
          <span className="font-display-heavy text-[15px] leading-none tracking-[-0.2px]">{view.trip.dateRange}</span>
          <span className="text-[11px] font-bold text-white opacity-85">{view.trip.dayCount} days</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-lg border-2 border-ink bg-lime px-2.5 py-1 text-ink shadow-hard-xs">
          <PeopleIcon size={15} strokeWidth={2.4} />
          <span className="font-display-heavy text-[15px] leading-none tracking-[-0.2px]">
            {view.trip.travelers} {view.trip.travelers === 1 ? "TRAVELLER" : "TRAVELLERS"}
          </span>
        </span>
      </div>
    </>
  );
}

function PeopleAndShare() {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <PreviewTag note="Collaborators and sharing arrive with accounts in Step 3." />
      <ul aria-label="People on this trip (preview)" className="m-0 flex list-none p-0">
        {PREVIEW_PEOPLE.map((p, i) => (
          <li
            key={p.initials}
            title={p.title}
            className="relative flex size-8 items-center justify-center rounded-full border-2 border-ink text-xs font-extrabold shadow-[0_0_0_2px_var(--aa-mint)]"
            style={{ background: p.bg, marginLeft: i === 0 ? 0 : -10 }}
          >
            {p.initials}
            {p.online && <span aria-hidden="true" className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-white bg-green" />}
          </li>
        ))}
      </ul>
      <button type="button" disabled title="Sharing arrives with accounts in Step 3" className="btn btn-ink min-h-9 px-3 shadow-hard-green disabled:opacity-80">
        <ShareIcon size={18} />
        Share
      </button>
    </div>
  );
}

function Co2Widget({ co2, travelers }: { co2: BoardView["co2"]; travelers: number }) {
  const max = Math.max(co2.tripGrams, co2.flightGrams, 1);
  const label = co2.mainMode === "TRAIN" ? "Train" : co2.mainMode === "BUS" ? "Bus" : co2.mainMode === "CARSHARE" ? "Car" : "Trip";
  const rows = [
    { label, grams: co2.tripGrams, className: "bg-lime border-r-2 border-ink" },
    { label: "Flying", grams: co2.flightGrams, className: "bg-flight" },
  ];
  return (
    <section aria-label="CO2 compared with flying" className="rounded-[18px] border-2 border-ink bg-white px-3 pt-2 pb-2.5 shadow-hard">
      <div className="flex items-center gap-2">
        <DragHandle className="-ml-2" />
        <LeafIcon size={20} strokeWidth={2.4} className="text-green" />
        <h2 className="m-0 font-display-heavy text-[15px] tracking-[-0.2px]">THE FLIGHT YOU DIDN&apos;T TAKE</h2>
      </div>
      <div className="mt-1.5 flex flex-col gap-1 text-xs font-extrabold">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2.5">
            <span className="w-[54px]">{r.label}</span>
            <span className="h-3.5 flex-1 overflow-hidden rounded-md border-2 border-ink bg-mint">
              <span className={`block h-full ${r.className}`} style={{ width: `${Math.max(2, (r.grams / max) * 100)}%` }} />
            </span>
            <span className="w-[60px] text-right">{formatCo2(r.grams)}</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 mb-0 text-[11px] font-semibold text-sub-2">
        {co2.savedGrams > 0 ? `${formatCo2(co2.savedGrams)} CO₂e saved` : "No saving yet"} for {travelers}{" "}
        {travelers === 1 ? "traveller" : "travellers"}, on the legs you&apos;ve chosen. Flying includes contrail effects ·{" "}
        <Co2Method />
      </p>
    </section>
  );
}

function BikeShareWidget({ bikes }: { bikes: BoardView["bikes"] }) {
  return (
    <section aria-label="Bike share near each station" className="rounded-[18px] border-2 border-ink bg-white px-3 pt-2 pb-3 shadow-hard">
      <div className="flex items-center gap-2">
        <DragHandle className="-ml-2" />
        <BikeIcon size={20} className="text-green" />
        <h2 className="m-0 font-display-heavy text-base leading-[1.05]">BIKE SHARE NEAR EACH STATION</h2>
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {bikes.length === 0 && <p className="m-0 text-sm font-semibold text-sub">Add legs to see bikes at your arrival stations.</p>}
        {bikes.map((b) => (
          <div key={b.stationName} className="rounded-xl bg-mint px-2.5 pt-2 pb-0.5">
            <div className="flex items-center gap-2 font-display-heavy text-sm">
              <TrainIcon size={16} />
              {b.stationName}
            </div>
            {b.docks.length === 0 ? (
              <p className="my-2 text-[13px] font-semibold text-sub">No bike-share data for this station yet.</p>
            ) : (
              <ul className="m-0 mt-2 list-none p-0">
                {b.docks.map((d, i) => (
                  <li key={`${d.operator}-${d.location}`} className="flex items-center gap-2 border-t-[1.5px] border-line py-1">
                    <span
                      aria-hidden="true"
                      className="box-border flex size-7 flex-none items-center justify-center rounded-md border-2 border-ink font-display-heavy text-[10px]"
                      style={{ background: d.bg, color: d.fg }}
                    >
                      {d.initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] leading-tight font-extrabold">{d.operator}</div>
                      <div className="text-[11px] font-semibold text-sub">
                        {d.location} · {d.walkMin} min walk
                      </div>
                    </div>
                    <span className={`inline-flex items-baseline gap-1.5 rounded-full border-2 border-ink px-2.5 py-0.5 ${i === 0 ? "bg-lime" : "bg-white"}`}>
                      <b className="font-display-heavy text-sm">{d.bikesAvailable}</b>
                      <span className="text-xs font-bold">bikes</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function BudgetWidget({ budget }: { budget: BoardView["budget"] }) {
  const money = (c: number) => formatMoney(c, "EUR", { decimals: false });
  const pct = budget.budgetCents ? Math.round((budget.totalCents / budget.budgetCents) * 100) : null;
  const over = pct != null && pct > 100;
  return (
    <section aria-label="Budget" className="rounded-[18px] border-2 border-ink bg-white px-3 pt-2 pb-2.5 shadow-hard">
      <div className="flex items-center gap-2">
        <DragHandle className="-ml-2" />
        <h2 className="m-0 font-display-heavy text-base">BUDGET</h2>
        <div className="flex-1" />
        <span className="text-sm font-extrabold">
          {money(budget.totalCents)}
          {budget.budgetCents != null && ` / ${money(budget.budgetCents)}`}
        </span>
      </div>
      {pct != null && (
        <div
          role="meter"
          aria-label="Budget used"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, pct)}
          className="mt-1.5 h-2.5 overflow-hidden rounded-full border-2 border-ink bg-mint"
        >
          <div className={`h-full ${over ? "bg-warn" : "bg-green"}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
      <div className="mt-1 text-[11px] font-semibold text-sub-2">
        Transport {money(budget.transportCents)} · stays &amp; plans {money(budget.agendaCents)}
        {pct != null && ` · ${over ? `${pct - 100}% over` : `${pct}% used`}`}
      </div>
    </section>
  );
}
