"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { bookAction, removeOptionAction, selectOptionAction } from "@/app/actions";
import { CheckIcon, ChevronDownIcon, ExternalIcon, ModeGlyph, SearchIcon, TrashIcon, TrendDownIcon } from "@/components/aa/icons";
import { Widget } from "@/components/aa/widget";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trendPolyline } from "@/lib/board";
import type { BoardView, JourneyLegView, OptionView } from "@/lib/board-view";
import { formatCo2, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const eur = (cents: number) => formatMoney(cents, "EUR", { decimals: cents % 100 !== 0 });

type Bookable = BoardView["journeys"]["bookable"][number];

export function SelectedJourneys({ journeys, travelers }: { journeys: BoardView["journeys"]; travelers: number }) {
  const [booking, setBooking] = useState<Bookable[] | null>(null);
  const title = journeys.allTrains ? "Selected trains" : "Selected journeys";

  return (
    <Widget
      label={title}
      title={title}
      actions={
        <>
          <div className="flex-1" />
          <span className="text-xs font-bold text-sub-2">
            {journeys.legs.length} {journeys.legs.length === 1 ? "leg" : "legs"}
          </span>
        </>
      }
      bodyClassName="flex flex-col gap-2 p-2.5"
    >
      {journeys.legs.length === 0 && (
        <p className="m-0 rounded-xl bg-mint p-3 text-sm font-semibold text-sub">
          No legs yet. Search a journey and pin it to this trip.
        </p>
      )}
      {journeys.legs.map((leg) => (
        <LegCard
          key={leg.legId}
          leg={leg}
          onBook={() => {
            const b = journeys.bookable.find((x) => x.optionId === leg.chosen?.id);
            if (b) setBooking([b]);
          }}
        />
      ))}

      {journeys.legs.length > 0 && (
        <div className="flex items-center gap-2.5 px-0.5 pt-1">
          <div>
            <div className="text-[11px] font-bold tracking-[0.8px] text-sub-2 uppercase">Total per person</div>
            <div className="font-display-heavy text-[22px] leading-none">{eur(journeys.totalPerPersonCents)}</div>
            {travelers > 1 && (
              <div className="text-xs font-semibold text-sub-2">
                {eur(journeys.totalPerPersonCents * travelers)} for {travelers}
              </div>
            )}
          </div>
          <div className="flex-1" />
          <button
            type="button"
            disabled={journeys.bookable.length === 0}
            onClick={() => setBooking(journeys.bookable)}
            className="btn btn-green min-h-9 px-3.5 text-[13px] shadow-hard-sm"
          >
            {journeys.bookable.length === 0
              ? "All booked"
              : `Book ${journeys.bookable.length === 1 ? "the last leg" : `all ${journeys.bookable.length} legs`}`}
          </button>
        </div>
      )}

      <BookingDialog items={booking} travelers={travelers} onClose={() => setBooking(null)} />
    </Widget>
  );
}

function LegCard({ leg, onBook }: { leg: JourneyLegView; onBook: () => void }) {
  const [open, setOpen] = useState(false);
  const [undo, setUndo] = useState<{ previousId: string; savingCents: number; depart: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const c = leg.chosen;

  const select = (optionId: string, after?: () => void) =>
    startTransition(async () => {
      const res = await selectOptionAction(optionId);
      if (!res.ok) toast.error(res.error);
      else after?.();
    });

  return (
    <article className="overflow-hidden rounded-[14px] border-2 border-ink">
      <div className="flex items-start gap-2 px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold tracking-[0.8px] text-sub-2 uppercase">
            {leg.dateLabel}
            {c && ` · ${c.operator}`}
          </div>
          <div className="font-display-heavy text-base leading-tight">
            {leg.originCity} → {leg.destCity}
          </div>
          {c ? (
            <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold">
              <ModeGlyph mode={c.mode} size={14} />
              {c.depart} → {c.arrive}
              {c.plusDays > 0 && <sup>+{c.plusDays}</sup>} · {c.duration} · {c.changes}
            </div>
          ) : (
            <div className="mt-0.5 text-[13px] font-semibold text-sub">No option chosen yet</div>
          )}
        </div>
        {c && (
          <div className="text-right">
            <div className="font-display-heavy text-lg leading-tight">{eur(c.priceCents)}</div>
            {leg.previousPriceCents != null ? (
              <div className="text-[11px] font-semibold text-sub-2 line-through">{eur(leg.previousPriceCents)}</div>
            ) : (
              <div className="text-[11px] font-semibold text-sub-2">per person</div>
            )}
            {c.status === "BOOKED" && (
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[11px] font-extrabold text-lime">
                <CheckIcon size={11} /> Booked
              </div>
            )}
          </div>
        )}
      </div>

      {/* Strips: rising price, cheaper swap / undo, or steady */}
      {c && leg.strip?.kind === "rising" && (
        <Strip className="bg-warn-bg">
          <svg aria-hidden="true" width="64" height="20" viewBox="0 0 64 20" fill="none" stroke="var(--aa-warn)" strokeWidth="2">
            <polyline points={trendPolyline(leg.history)} />
          </svg>
          <span className="flex-1 text-[12.5px] font-bold text-warn">
            Up {eur(leg.strip.changeCents)} since {leg.strip.sinceDay}
            {leg.strip.stillRising ? " · still rising" : ""}
          </span>
          {c.status === "SELECTED" && (
            <button type="button" onClick={onBook} className="btn btn-white min-h-7 rounded-lg px-2.5 text-xs">
              Book now
            </button>
          )}
        </Strip>
      )}
      {leg.swap && !undo && (
        <Strip className="bg-lime">
          <TrendDownIcon size={18} />
          <span className="flex-1 text-[12.5px] font-bold">
            Cheaper option: <b>{eur(leg.swap.priceCents)}</b> on the {leg.swap.depart} · save {eur(leg.swap.savingCents)}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const previousId = c!.id;
              const { savingCents, depart } = leg.swap!;
              select(leg.swap!.optionId, () => setUndo({ previousId, savingCents, depart }));
            }}
            className="btn btn-ink min-h-7 rounded-lg px-2.5 text-xs text-lime hover:text-lime"
          >
            Swap
          </button>
        </Strip>
      )}
      {undo && (
        <Strip className="bg-paper">
          <CheckIcon size={18} className="text-green" />
          <span className="flex-1 text-[12.5px] font-bold">
            Swapped to the {undo.depart} · saved {eur(undo.savingCents)} pp
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => select(undo.previousId, () => setUndo(null))}
            className="btn btn-white min-h-7 rounded-lg px-2.5 text-xs font-bold"
          >
            Undo
          </button>
        </Strip>
      )}
      {c && leg.strip && leg.strip.kind !== "rising" && !leg.swap && !undo && (
        <Strip className="bg-paper">
          <svg aria-hidden="true" width="64" height="20" viewBox="0 0 64 20" fill="none" stroke="var(--aa-green)" strokeWidth="2">
            <polyline points={trendPolyline(leg.history)} />
          </svg>
          <span className="text-xs font-bold">
            {leg.strip.kind === "falling"
              ? `Down ${eur(leg.strip.changeCents)} this week`
              : `Price steady for ${leg.strip.weeks || 1} week${leg.strip.weeks === 1 ? "" : "s"}`}
          </span>
          <div className="flex-1" />
          <span className="text-[11px] font-bold text-green">{formatCo2(c.co2Grams)} CO₂</span>
        </Strip>
      )}

      {/* Options expander */}
      <div className="border-t-2 border-dashed border-dots">
        <div className="flex items-center">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="flex flex-1 items-center gap-2 px-2.5 py-1 text-left text-xs font-extrabold hover:bg-mint"
          >
            <ChevronDownIcon size={14} className={cn("transition-transform", open && "rotate-180")} />
            {leg.options.length} {leg.options.length === 1 ? "option" : "options"} saved
          </button>
          <Link href={leg.findHref} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-extrabold text-green no-underline">
            <SearchIcon size={13} /> Find options
          </Link>
        </div>
        {open && (
          <ul className="m-0 list-none border-t-[1.5px] border-line p-0">
            {leg.options.map((o) => (
              <OptionRow key={o.id} option={o} pending={pending} onSelect={() => select(o.id, () => setUndo(null))} />
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

function Strip({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex items-center gap-2 border-t-2 border-dashed border-dots px-2.5 py-1", className)}>{children}</div>;
}

const BADGE_LABEL = { greenest: "Greenest", cheapest: "Cheapest", fastest: "Fastest" } as const;

function OptionRow({ option: o, pending, onSelect }: { option: OptionView; pending: boolean; onSelect: () => void }) {
  const [removing, startRemove] = useTransition();
  return (
    <li className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 border-b-[1.5px] border-line px-3.5 py-2.5 last:border-b-0", o.status !== "CANDIDATE" && "bg-paper")}>
      <ModeGlyph mode={o.mode} size={16} className="flex-none" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-extrabold">
          {o.depart} → {o.arrive}
          {o.plusDays > 0 && <sup>+{o.plusDays}</sup>} <span className="font-semibold text-sub">· {o.operator}</span>
        </div>
        <div className="text-xs font-semibold text-sub-2">
          {o.duration} · {o.changes} · {formatCo2(o.co2Grams)} CO₂
          {o.badges.map((b) => (
            <span key={b} className="ml-1.5 rounded-full border border-ink bg-lime px-1.5 text-[10px] font-extrabold tracking-[0.5px] text-ink uppercase">
              {BADGE_LABEL[b]}
            </span>
          ))}
        </div>
      </div>
      <div className="font-display-heavy text-base">{eur(o.priceCents)}</div>
      {o.status === "CANDIDATE" ? (
        <button type="button" disabled={pending} onClick={onSelect} className="btn btn-white min-h-8 rounded-lg px-2.5 text-xs">
          Select
        </button>
      ) : (
        <span className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-ink px-2.5 text-xs font-extrabold text-lime">
          <CheckIcon size={12} /> {o.status === "BOOKED" ? "Booked" : "Selected"}
        </span>
      )}
      {o.status !== "BOOKED" && (
        <button
          type="button"
          aria-label={`Remove ${o.operator} ${o.depart}`}
          disabled={removing}
          onClick={() =>
            startRemove(async () => {
              const res = await removeOptionAction(o.id);
              if (!res.ok) toast.error(res.error);
            })
          }
          className="inline-flex size-8 items-center justify-center rounded-lg text-sub hover:bg-mint hover:text-ink"
        >
          <TrashIcon size={15} />
        </button>
      )}
    </li>
  );
}

/** "Book all": a checklist of operator links (mock URLs); confirming marks the legs BOOKED. */
function BookingDialog({ items, travelers, onClose }: { items: Bookable[] | null; travelers: number; onClose: () => void }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const list = items ?? [];
  return (
    <Dialog
      open={!!items}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setChecked(new Set());
        }
      }}
    >
      <DialogContent className="pin-dialog sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display-heavy text-2xl uppercase">Book {list.length === 1 ? "this leg" : `${list.length} legs`}</DialogTitle>
          <DialogDescription>
            Book each leg on the operator&apos;s site, then tick it off here. Links are mock in this prototype.
          </DialogDescription>
        </DialogHeader>
        <ul className="m-0 grid list-none gap-2 p-0">
          {list.map((b) => (
            <li key={b.optionId} className="flex items-center gap-3 rounded-xl border-2 border-ink p-3">
              <input
                type="checkbox"
                aria-label={`I booked ${b.label}`}
                checked={checked.has(b.optionId)}
                onChange={(e) =>
                  setChecked((s) => {
                    const n = new Set(s);
                    if (e.target.checked) n.add(b.optionId);
                    else n.delete(b.optionId);
                    return n;
                  })
                }
                className="size-[18px] flex-none accent-green"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-extrabold">{b.label}</div>
                <div className="text-xs font-semibold text-sub">
                  {b.operator} · {eur(b.priceCents * travelers)} for {travelers}
                </div>
              </div>
              <a href={b.bookingUrl} target="_blank" rel="noopener noreferrer" className="btn btn-white min-h-9 rounded-[10px] px-3 text-xs">
                Open <ExternalIcon size={13} />
              </a>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-white">
            Cancel
          </button>
          <button
            type="button"
            disabled={checked.size === 0 || pending}
            onClick={() =>
              startTransition(async () => {
                const res = await bookAction([...checked]);
                if (res.ok) {
                  toast.success(`${checked.size} ${checked.size === 1 ? "leg" : "legs"} marked as booked`);
                  setChecked(new Set());
                  onClose();
                } else toast.error(res.error);
              })
            }
            className="btn btn-green shadow-hard-sm"
          >
            {pending ? "Saving…" : `Mark ${checked.size || ""} as booked`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
