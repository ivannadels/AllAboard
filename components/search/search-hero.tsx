"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BusIcon, CarIcon, LeafIcon, SearchIcon, SwapIcon, TrainIcon } from "@/components/aa/icons";
import { StationField, type StationOption } from "@/components/search/station-field";
import type { SortMode } from "@/lib/ranking";
import { searchHref, type SearchFilters, type SearchTarget } from "@/lib/search-params";
import type { Mode } from "@/lib/types";

const MODES: { mode: Mode; label: string; Icon: typeof TrainIcon }[] = [
  { mode: "TRAIN", label: "Train", Icon: TrainIcon },
  { mode: "BUS", label: "Bus", Icon: BusIcon },
  { mode: "CARSHARE", label: "Car share", Icon: CarIcon },
];
const ALL: Mode[] = MODES.map((m) => m.mode);
const SORT_TEXT: Record<SortMode, string> = { greenest: "greenest first", cheapest: "cheapest first", fastest: "fastest first" };

/** Hero + search form (template "FIND A JOURNEY"). Navigates; the server renders results. */
export function SearchHero({
  initial,
  sort,
  filters,
  target,
  hasResults,
  heading,
}: {
  initial: { origin: StationOption | null; dest: StationOption | null; date: string; travelers: number };
  sort: SortMode;
  filters: SearchFilters;
  target: SearchTarget;
  hasResults: boolean;
  heading?: React.ReactNode;
}) {
  const router = useRouter();
  const [origin, setOrigin] = useState(initial.origin);
  const [dest, setDest] = useState(initial.dest);
  const [date, setDate] = useState(initial.date);
  const [travelers, setTravelers] = useState(initial.travelers);
  // No mode filter means every mode is on.
  const [modes, setModes] = useState<Mode[]>(filters.modes.length ? filters.modes : ALL);
  const [pending, startTransition] = useTransition();

  const go = (nextModes = modes) => {
    if (!origin || !dest || origin.id === dest.id || !date) return;
    const modeFilter = nextModes.length === ALL.length ? [] : nextModes;
    startTransition(() =>
      router.push(searchHref({ originId: origin.id, destId: dest.id, date, travelers, sort, ...filters, modes: modeFilter, ...target }), {
        scroll: false,
      }),
    );
  };

  const toggleMode = (m: Mode) => {
    const next = modes.includes(m) ? modes.filter((x) => x !== m) : [...modes, m];
    if (next.length === 0) return; // keep at least one mode on
    setModes(next);
    if (hasResults) go(next);
  };

  return (
    <section className="border-b-2 border-ink dot-grid">
      <div className="mx-auto box-border max-w-[1280px] px-4 pt-14 pb-[60px] sm:px-8">
        {heading ?? (
          <>
            <div className="inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-[7px] text-xs font-extrabold tracking-[1.2px] text-lime uppercase">
              <LeafIcon size={14} />
              Never flights
            </div>
            <h1 className="mt-4 mb-2.5 font-display-heavy text-[clamp(48px,8vw,72px)] leading-[0.95] tracking-[-2.5px]">FIND A JOURNEY</h1>
            <p className="m-0 mb-[30px] text-lg font-semibold text-sub">Trains, buses and car shares across Europe, ranked greenest first.</p>
          </>
        )}
        <form
          aria-label="Journey search"
          onSubmit={(e) => {
            e.preventDefault();
            go();
          }}
          className="rounded-[20px] border-2 border-ink bg-white p-[18px] shadow-hard-lg"
        >
          <div className="flex flex-wrap items-end gap-3">
            <StationField id="from" label="From" value={origin} onChange={setOrigin} />
            <button
              type="button"
              aria-label="Swap from and to"
              onClick={() => {
                setOrigin(dest);
                setDest(origin);
              }}
              className="mb-1.5 inline-flex size-12 flex-none items-center justify-center rounded-full border-2 border-ink bg-lime text-ink"
            >
              <SwapIcon size={20} />
            </button>
            <StationField id="to" label="To" value={dest} onChange={setDest} />
            <div className="flex min-w-0 flex-[2_1_170px] flex-col gap-1.5">
              <label htmlFor="date" className="text-[11px] font-extrabold tracking-[1px] uppercase">
                Date
              </label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="box-border min-h-[60px] w-full rounded-xl border-2 border-ink bg-white px-3 text-[17px] font-bold text-ink"
              />
            </div>
            <div className="flex min-w-0 flex-[2_1_170px] flex-col gap-1.5">
              <span id="trav-label" className="text-[11px] font-extrabold tracking-[1px] uppercase">
                Travellers
              </span>
              <div role="group" aria-labelledby="trav-label" className="box-border flex min-h-[60px] items-center justify-between rounded-xl border-2 border-ink px-1.5">
                <button
                  type="button"
                  aria-label="One fewer traveller"
                  onClick={() => setTravelers((t) => Math.max(1, t - 1))}
                  className="size-11 rounded-[9px] bg-mint text-[22px] font-extrabold text-ink"
                >
                  −
                </button>
                <span aria-live="polite" className="font-display-heavy text-2xl">
                  {travelers}
                </span>
                <button
                  type="button"
                  aria-label="One more traveller"
                  onClick={() => setTravelers((t) => Math.min(9, t + 1))}
                  className="size-11 rounded-[9px] bg-mint text-[22px] font-extrabold text-ink"
                >
                  +
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={!origin || !dest || origin.id === dest.id || pending}
              className="btn btn-green min-h-[60px] flex-[1_1_150px] rounded-xl font-display-heavy text-lg shadow-hard-sm"
            >
              <SearchIcon size={20} />
              {pending ? "SEARCHING…" : "SEARCH"}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t-2 border-dashed border-line pt-3.5">
            <span className="mr-1 text-xs font-extrabold tracking-[1px] uppercase">Modes</span>
            {MODES.map(({ mode, label, Icon }) => {
              const on = modes.includes(mode);
              return (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleMode(mode)}
                  className="inline-flex min-h-10 items-center gap-[7px] rounded-full border-2 border-ink pr-4 pl-3 font-display-heavy text-[15px] text-ink"
                  style={{ background: on ? "var(--aa-lime)" : "#fff" }}
                >
                  <Icon size={18} />
                  {label}
                </button>
              );
            })}
            <div className="flex-1" />
            <span className="text-[13px] font-bold text-sub">
              Sorted by <b className="text-green">{SORT_TEXT[sort]}</b>
            </span>
          </div>
        </form>
      </div>
    </section>
  );
}
