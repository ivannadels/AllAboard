import Link from "next/link";
import { ArrowRightIcon, CalendarIcon, PeopleIcon, PlusIcon } from "@/components/aa/icons";
import { NewTripDialog } from "@/components/trips/new-trip-dialog";
import { DEMO_USER } from "@/lib/demo-user";
import { formatCo2, formatDateRange, formatMoney } from "@/lib/format";
import { isoDay } from "@/lib/board";
import { getTripsOverview, type TripOverview } from "@/lib/queries";
import { getSimNow } from "@/lib/sim-clock";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "drafts", status: "DRAFT", label: "Drafts" },
  { key: "booked", status: "BOOKED", label: "Booked" },
  { key: "past", status: "PAST", label: "Past" },
] as const;

const DAY_MS = 86_400_000;

export default async function TripsPage({ searchParams }: PageProps<"/trips">) {
  const { status } = await searchParams;
  const simNow = await getSimNow();
  const trips = await getTripsOverview(simNow);
  const tab = TABS.find((t) => t.key === status) ?? TABS[0];
  const shown = trips.filter((t) => t.status === tab.status);
  const defaultStart = isoDay(new Date(simNow.getTime() + 30 * DAY_MS));

  return (
    <main className="mx-auto box-border w-full max-w-[1280px] px-4 pt-12 pb-16 sm:px-8">
      <div className="mb-[26px] flex flex-wrap items-end gap-[18px]">
        <div className="min-w-0 flex-[999_1_420px]">
          <h1 className="m-0 mb-2.5 font-display-heavy text-[clamp(56px,9vw,88px)] leading-[0.9] tracking-[-3px]">YOUR TRIPS</h1>
          <p className="m-0 text-lg font-semibold text-sub">Draft itineraries, compare plans, and book when the price is right.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Trip status" className="flex flex-wrap gap-1.5">
            {TABS.map((t) => {
              const count = trips.filter((x) => x.status === t.status).length;
              const active = t.key === tab.key;
              return (
                <Link
                  key={t.key}
                  href={t.key === "drafts" ? "/trips" : `/trips?status=${t.key}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full border-2 border-ink px-4 text-sm no-underline",
                    active ? "bg-ink font-extrabold text-white hover:text-white" : "bg-white font-bold text-ink hover:bg-mint hover:text-ink",
                  )}
                >
                  {t.label}
                  {t.key !== "past" || count > 0 ? ` · ${count}` : ""}
                </Link>
              );
            })}
          </nav>
          <NewTripDialog
            defaultStart={defaultStart}
            trigger={
              <button type="button" className="btn btn-lime min-h-[50px] rounded-full px-5 font-display-heavy text-base shadow-hard-sm">
                <PlusIcon size={18} />
                NEW TRIP
              </button>
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-[22px]">
        {shown.length === 0 && (
          <p className="m-0 rounded-3xl border-2 border-ink bg-white p-8 text-center text-base font-semibold text-sub">
            {tab.key === "drafts" ? "No draft trips. Start one below." : `No ${tab.label.toLowerCase()} trips yet.`}
          </p>
        )}
        {shown.map((t) => (
          <TripCard key={t.id} trip={t} />
        ))}
        <NewTripDialog
          defaultStart={defaultStart}
          trigger={
            <button
              type="button"
              className="flex min-h-[120px] w-full flex-wrap items-center justify-center gap-3.5 rounded-3xl border-2 border-dashed border-ink dot-grid p-4 text-ink"
            >
              <span className="box-border flex size-[52px] items-center justify-center rounded-full border-2 border-ink bg-lime">
                <PlusIcon size={22} />
              </span>
              <span className="font-display-heavy text-[32px] tracking-[-1px]">PLAN A NEW TRIP</span>
              <span className="text-[15px] font-semibold text-sub">Start from a blank board, then pin journeys from search</span>
            </button>
          }
        />
      </div>
    </main>
  );
}

function TripCard({ trip: t }: { trip: TripOverview }) {
  const s = t.summary;
  const money = (c: number) => formatMoney(c, "EUR", { decimals: false });
  const pct = s && t.budgetCents ? Math.round((s.totalCents / t.budgetCents) * 100) : null;
  return (
    <article className="flex flex-wrap gap-3 rounded-3xl border-2 border-ink bg-white p-3 shadow-hard">
      <div className="flex min-w-0 flex-[3_1_460px] flex-col gap-3.5 px-3.5 pt-3.5 pb-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-[7px] font-display-heavy text-[17px] text-lime">
            <CalendarIcon size={17} />
            {formatDateRange(t.startDate, t.endDate).toUpperCase()}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-lime px-3.5 py-[5px] font-display-heavy text-[17px]">
            <PeopleIcon size={17} />
            {t.travelers} {t.travelers === 1 ? "TRAVELLER" : "TRAVELLERS"}
          </span>
          <span className="text-[13px] font-bold text-sub">
            {t.variantCount} {t.variantCount === 1 ? "plan" : "plans"}
          </span>
          <div className="flex-1" />
          <ul aria-label={`${t.travelers} ${t.travelers === 1 ? "person" : "people"} on this trip`} className="m-0 flex list-none p-0">
            <li
              title={`${DEMO_USER.name} (you)`}
              className="box-border flex size-9 items-center justify-center rounded-full border-2 border-ink bg-lime text-xs font-extrabold shadow-[0_0_0_2px_#fff]"
            >
              {DEMO_USER.initials}
            </li>
            {t.travelers > 1 && (
              <li
                title={`${t.travelers - 1} more ${t.travelers === 2 ? "traveller" : "travellers"}`}
                className="-ml-2 box-border flex size-9 items-center justify-center rounded-full border-2 border-ink bg-sage text-xs font-extrabold shadow-[0_0_0_2px_#fff]"
              >
                +{t.travelers - 1}
              </li>
            )}
          </ul>
        </div>
        <h2 className="m-0 font-display-heavy text-[clamp(34px,5vw,52px)] leading-[0.92] tracking-[-2px] uppercase">{t.name}</h2>
        <div className="font-display-heavy text-[22px] tracking-[-0.3px] text-sub">
          {t.route.length > 0 ? t.route.join(" → ") : "No legs yet"}
        </div>
        <div className="mt-1 flex flex-wrap gap-2.5">
          <Tile label={`Total · ${t.primaryVariantName ?? "Plan A"}`} value={s ? money(s.totalCents) : "—"} />
          <Tile label="Travel CO₂e" value={s ? formatCo2(s.co2Grams) : "—"} />
          <div className="flex-[1_1_180px] rounded-2xl bg-mint px-4 py-3.5">
            <div className="text-[11px] font-extrabold tracking-[1.2px] text-sub uppercase">
              Budget{pct != null ? ` · ${pct}% used` : ""}
            </div>
            <div className="font-display-heavy text-[34px] leading-[1.1]">{t.budgetCents != null ? money(t.budgetCents) : "None"}</div>
            {pct != null && (
              <div aria-hidden="true" className="mt-2 h-2 overflow-hidden rounded-full border-[1.5px] border-ink bg-white">
                <div className={cn("h-full", pct > 100 ? "bg-warn" : "bg-green")} style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5 rounded-[18px] bg-lime p-[22px]">
        <div className="text-xs font-extrabold tracking-[1.2px] uppercase">Less than flying</div>
        <div className="font-display-heavy text-[84px] leading-[0.85] tracking-[-3px]">
          {s ? Math.round(s.co2SavedGrams / 1000) : 0}
          <span className="text-[30px] tracking-[-0.5px]">kg</span>
        </div>
        <div className="text-[13px] font-bold">CO₂e saved on this trip</div>
        <div className="min-h-4 flex-1" />
        <Link
          href={`/trips/${t.id}`}
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-ink font-display-heavy text-base text-white no-underline hover:text-lime"
        >
          OPEN BOARD <ArrowRightIcon size={18} strokeWidth={2.6} />
        </Link>
      </div>
    </article>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-[1_1_140px] rounded-2xl bg-mint px-4 py-3.5">
      <div className="text-[11px] font-extrabold tracking-[1.2px] text-sub uppercase">{label}</div>
      <div className="font-display-heavy text-[34px] leading-[1.1]">{value}</div>
    </div>
  );
}
