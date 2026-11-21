"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addAttractionAction } from "@/app/actions";
import { Widget } from "@/components/aa/widget";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { hhmmToMinutes, minutesToHHMM, overlapping, type CalendarEvent } from "@/lib/board";
import type { AttractionView, StopView } from "@/lib/board-view";
import { cn } from "@/lib/utils";

export function ThingsToDo({ stops, variantId, events }: { stops: StopView[]; variantId: string; events: CalendarEvent[] }) {
  const [cityKey, setCityKey] = useState(stops[0]?.cityKey);
  const [picking, setPicking] = useState<AttractionView | null>(null);
  const stop = stops.find((s) => s.cityKey === cityKey) ?? stops[0];
  const addedCount = stop?.attractions.filter((a) => a.scheduled).length ?? 0;

  return (
    <Widget
      label="Things to do"
      title="Things to do"
      actions={
        stop && (
          <>
            <div role="tablist" aria-label="Choose a stop" className="ml-1.5 inline-flex overflow-hidden rounded-xl border-2 border-ink bg-white">
              {stops.map((s) => (
                <button
                  key={s.cityKey}
                  type="button"
                  role="tab"
                  aria-selected={s.cityKey === stop.cityKey}
                  onClick={() => setCityKey(s.cityKey)}
                  className={cn(
                    "min-h-8 px-3 font-display-heavy text-[13px]",
                    s.cityKey === stop.cityKey ? "bg-ink text-white" : "bg-white text-ink hover:bg-mint",
                  )}
                >
                  {s.city} · {s.attractions.length}
                </button>
              ))}
            </div>
            <span className="text-[13px] font-bold text-sub-2">{stop.whenLabel}</span>
            <div className="flex-1" />
            <span className="rounded-lg bg-mint px-2.5 py-1.5 text-xs font-extrabold tracking-[0.6px] uppercase">
              {addedCount} added to your week
            </span>
          </>
        )
      }
      bodyClassName="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5 p-2.5"
    >
      {!stop && <p className="m-0 text-sm font-semibold text-sub">Add a leg to a city to see things to do there.</p>}
      {stop && stop.attractions.length === 0 && (
        <p className="m-0 text-sm font-semibold text-sub">No suggestions for {stop.city} yet. Use + on the calendar to add your own plans.</p>
      )}
      {stop?.attractions.map((a) => (
        <article key={a.id} className="flex flex-col overflow-hidden rounded-[14px] border-2 border-ink bg-white">
          <div className="box-border flex h-10 items-end border-b-2 border-ink p-1.5" style={{ background: a.swatch }}>
            <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-extrabold tracking-[0.6px] text-lime uppercase">{a.tag}</span>
          </div>
          <div className="flex flex-1 flex-col gap-0.5 px-2.5 pt-1.5 pb-2.5">
            <div className="font-display-heavy text-[15px] leading-tight">{a.name}</div>
            <div className="mb-1.5 flex-1 text-[11px] font-semibold text-sub-2">{a.blurb}</div>
            {a.scheduled ? (
              <span className="inline-flex min-h-7 flex-wrap items-center gap-x-1.5 text-[11px] font-extrabold text-green">
                On your week · {a.scheduled.label} ✓
                <button
                  type="button"
                  onClick={() => setPicking(a)}
                  aria-label={`Change when ${a.name} is on your week`}
                  className="font-bold text-sub underline hover:text-ink"
                >
                  Change
                </button>
              </span>
            ) : (
              <button
                type="button"
                aria-label={`Add ${a.name} to your week`}
                onClick={() => setPicking(a)}
                className="btn btn-lime min-h-7 self-start rounded-lg px-2 text-[11px] shadow-hard-xs"
              >
                + Add to week
              </button>
            )}
          </div>
        </article>
      ))}

      {picking && stop && (
        <ScheduleDialog
          key={picking.id}
          attraction={picking}
          stop={stop}
          variantId={variantId}
          events={events}
          onClose={() => setPicking(null)}
        />
      )}
    </Widget>
  );
}

const label = "grid gap-1 text-[11px] font-extrabold tracking-[1px] uppercase";

/**
 * Choose when to do a suggestion: any day you're in the city, start and end time. Starts on
 * the suggested slot (or where it already is), keeps the duration when the start moves, and
 * warns, without blocking, if it overlaps something already on the calendar.
 */
function ScheduleDialog({
  attraction: a,
  stop,
  variantId,
  events,
  onClose,
}: {
  attraction: AttractionView;
  stop: StopView;
  variantId: string;
  events: CalendarEvent[];
  onClose: () => void;
}) {
  const initial = a.scheduled?.time
    ? { date: a.scheduled.date, time: a.scheduled.time, endTime: a.scheduled.endTime ?? minutesToHHMM(hhmmToMinutes(a.scheduled.time) + a.durationMin) }
    : a.suggested;
  const [day, setDay] = useState(stop.days.some((d) => d.iso === initial.date) ? initial.date : (stop.days[0]?.iso ?? initial.date));
  const [time, setTime] = useState(initial.time);
  const [endTime, setEndTime] = useState(initial.endTime);
  const [pending, startTransition] = useTransition();

  const validTimes = /^\d\d:\d\d$/.test(time) && /^\d\d:\d\d$/.test(endTime);
  const endBeforeStart = validTimes && endTime <= time;
  const clashes = validTimes && !endBeforeStart ? overlapping(events, day, hhmmToMinutes(time), hhmmToMinutes(endTime), a.scheduled?.agendaId) : [];

  // Moving the start keeps the current duration.
  const changeStart = (next: string) => {
    if (/^\d\d:\d\d$/.test(next) && validTimes && !endBeforeStart) {
      const duration = hhmmToMinutes(endTime) - hhmmToMinutes(time);
      setEndTime(minutesToHHMM(hhmmToMinutes(next) + duration));
    }
    setTime(next);
  };

  const save = () =>
    startTransition(async () => {
      const res = await addAttractionAction({ variantId, attractionId: a.id, date: day, time, endTime });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      onClose();
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="pin-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display-heavy text-2xl uppercase">{a.scheduled ? "Move" : "Add"} {a.name}</DialogTitle>
          <DialogDescription>
            {a.blurb}. You&apos;re in {stop.city} {stop.whenLabel.replace(" · ", " (")}).
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!endBeforeStart) save();
          }}
        >
          <fieldset className="m-0 grid gap-1.5 border-0 p-0">
            <legend className="mb-1.5 text-[11px] font-extrabold tracking-[1px] uppercase">Day</legend>
            <div role="radiogroup" aria-label="Day" className="flex flex-wrap gap-1.5">
              {stop.days.map((d) => (
                <button
                  key={d.iso}
                  type="button"
                  role="radio"
                  aria-checked={d.iso === day}
                  onClick={() => setDay(d.iso)}
                  className={cn(
                    "min-h-9 rounded-full border-2 border-ink px-3 text-[13px] font-bold",
                    d.iso === day ? "bg-ink text-white" : "bg-white text-ink hover:bg-mint",
                  )}
                >
                  {d.label}
                  {d.iso === a.suggested.date && <span className={cn("ml-1 text-[10px]", d.iso === day ? "text-lime" : "text-green")}>★</span>}
                </button>
              ))}
            </div>
            <span className="text-[11px] font-semibold text-sub">★ suggested day</span>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              From
              <input type="time" value={time} onChange={(e) => changeStart(e.target.value)} required className="field" />
            </label>
            <label className={label}>
              Until
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required className="field" />
            </label>
          </div>

          <button
            type="button"
            onClick={() => {
              setDay(a.suggested.date);
              setTime(a.suggested.time);
              setEndTime(a.suggested.endTime);
            }}
            className="justify-self-start text-xs font-bold text-sub underline hover:text-ink"
          >
            Use the suggested time ({a.suggested.label})
          </button>

          {endBeforeStart && <p className="m-0 text-sm font-bold text-warn">The end time must be after the start.</p>}
          {clashes.length > 0 && (
            <p className="m-0 rounded-lg border-2 border-ink bg-warn-bg px-3 py-2 text-[13px] font-bold text-warn">
              Overlaps with {clashes.map((c) => `${c.title} (${c.timeLabel})`).join(", ")}. You can still add it.
            </p>
          )}

          <div className="mt-1 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-white">
              Cancel
            </button>
            <button type="submit" disabled={pending || endBeforeStart || !validTimes} className="btn btn-lime whitespace-nowrap shadow-hard-sm">
              {pending ? "Saving…" : a.scheduled ? "Move it" : "Add to week"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
