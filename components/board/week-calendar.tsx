"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addAgendaAction, removeAgendaAction, restoreAgendaAction, type RemovedAgendaItem } from "@/app/actions";
import { BedIcon, CloseIcon, PlusIcon } from "@/components/aa/icons";
import { Widget } from "@/components/aa/widget";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CAL_END_HOUR, CAL_START_HOUR, weeks, type CalendarEvent, type StayBar } from "@/lib/board";
import type { BoardView } from "@/lib/board-view";
import { cn } from "@/lib/utils";

const HOUR_PX = 28;
const HOURS = Array.from({ length: CAL_END_HOUR - CAL_START_HOUR }, (_, i) => `${String(CAL_START_HOUR + i).padStart(2, "0")}:00`);
const GRID_HEIGHT = HOURS.length * HOUR_PX;
const COLS = 7;

type Day = BoardView["calendar"]["days"][number];

/** Side-by-side lanes for overlapping blocks within one day. */
function layoutDay(events: CalendarEvent[]) {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const placed: { ev: CalendarEvent; lane: number; lanes: number }[] = [];
  let cluster: typeof placed = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((p) => p.lane + 1));
    cluster.forEach((p) => (p.lanes = lanes));
    placed.push(...cluster);
    cluster = [];
  };
  for (const ev of sorted) {
    if (ev.startMin >= clusterEnd) flush();
    const laneEnds: number[] = [];
    cluster.forEach((p) => (laneEnds[p.lane] = Math.max(laneEnds[p.lane] ?? 0, p.ev.endMin)));
    let lane = laneEnds.findIndex((end) => end <= ev.startMin);
    if (lane === -1) lane = laneEnds.length;
    cluster.push({ ev, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, ev.endMin);
  }
  flush();
  return placed;
}

/** Stack stay bars into rows so overlapping stays don't collide. */
function stayRows(stays: StayBar[], days: (Day | null)[]) {
  const index = new Map(days.map((d, i) => [d?.iso, i]));
  const firstIso = days.find(Boolean)?.iso ?? "";
  const lastIso = [...days].reverse().find(Boolean)?.iso ?? "";
  const rows: { stay: StayBar; col: number; span: number }[][] = [];
  for (const stay of stays) {
    if (stay.to <= firstIso || stay.from > lastIso) continue;
    const startCol = stay.from < firstIso ? 0 : index.get(stay.from) ?? 0;
    // A stay covers its nights: from check-in up to the day before check-out.
    const lastNight = [...days].reverse().find((d) => d && d.iso < stay.to)?.iso ?? stay.from;
    const endCol = index.get(lastNight) ?? startCol;
    const item = { stay, col: startCol, span: endCol - startCol + 1 };
    const row = rows.find((r) => r.every((x) => x.col + x.span <= item.col || item.col + item.span <= x.col));
    if (row) row.push(item);
    else rows.push([item]);
  }
  return rows;
}

export function WeekCalendar({ calendar, variantId }: { calendar: BoardView["calendar"]; variantId: string }) {
  const pages = weeks(calendar.days, COLS);
  const [page, setPage] = useState(0);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [removed, setRemoved] = useState<RemovedAgendaItem[]>([]);
  const [addDay, setAddDay] = useState<Day | null>(null);
  const [pending, startTransition] = useTransition();

  const current = pages[Math.min(page, pages.length - 1)];
  const days: (Day | null)[] = [...current, ...Array(Math.max(0, COLS - current.length)).fill(null)];
  const first = current[0];
  const last = current[current.length - 1];
  const title = first && last ? `Week · ${first.dayNum}–${last.dayNum} ${last.month}` : "Week";

  const remove = (ev: CalendarEvent) => {
    if (!ev.agendaId) return;
    const id = ev.agendaId;
    setHidden((h) => new Set(h).add(id));
    startTransition(async () => {
      const res = await removeAgendaAction([id]);
      if (res.ok && res.removed) setRemoved((r) => [...r, ...res.removed!]);
      else {
        setHidden((h) => {
          const n = new Set(h);
          n.delete(id);
          return n;
        });
        if (!res.ok) toast.error(res.error);
      }
    });
  };

  const restore = () =>
    startTransition(async () => {
      const res = await restoreAgendaAction(removed);
      if (res.ok) {
        setRemoved([]);
        setHidden(new Set());
      } else toast.error(res.error);
    });

  const rows = stayRows(calendar.stays, days);
  const allDay = calendar.allDay.filter((a) => days.some((d) => d?.iso === a.day));

  return (
    <Widget
      label="Week calendar"
      title={title}
      className="min-w-0"
      actions={
        <>
          <div className="ml-2 flex flex-wrap gap-3 text-xs font-semibold text-sub-2">
            <Legend swatch="bg-green" label="Travel" />
            <Legend swatch="border-[1.5px] border-green bg-white" label="Plan" />
            <Legend swatch="bg-sage" label="Stay" />
          </div>
          <div className="flex-1" />
          {removed.length > 0 && (
            <button type="button" onClick={restore} disabled={pending} className="btn btn-white min-h-9 rounded-[10px] px-3 text-[13px] font-bold">
              {removed.length} removed · Restore
            </button>
          )}
          <button
            type="button"
            aria-label="Previous week"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="btn btn-white size-9 min-h-9 rounded-[10px] p-0"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next week"
            disabled={page >= pages.length - 1}
            onClick={() => setPage((p) => p + 1)}
            className="btn btn-white size-9 min-h-9 rounded-[10px] p-0"
          >
            ›
          </button>
        </>
      }
    >
      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          {/* Day headers */}
          <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b-[1.5px] border-line">
            <div />
            {days.map((d, i) => (
              <div key={d?.iso ?? `pad-${i}`} className={cn("flex items-center gap-1.5 border-l-[1.5px] border-line px-2 py-1", !d && "opacity-35")}>
                {d ? (
                  <>
                    <div>
                      <div className="text-[10px] font-bold tracking-[1px] text-sub-2 uppercase">{d.weekday}</div>
                      <div className="font-display-heavy text-lg leading-none">{d.dayNum}</div>
                    </div>
                    <div className="flex-1" />
                    <button
                      type="button"
                      aria-label={`Add a plan on ${d.weekday} ${d.dayNum} ${d.month}`}
                      onClick={() => setAddDay(d)}
                      className="inline-flex size-6 items-center justify-center rounded-md border-[1.5px] border-ink bg-white text-ink hover:bg-lime"
                    >
                      <PlusIcon size={12} strokeWidth={2.6} />
                    </button>
                  </>
                ) : (
                  <div className="text-[11px] font-bold tracking-[1px] text-sub-2 uppercase">After trip</div>
                )}
              </div>
            ))}
          </div>

          {/* Stays + all-day notes */}
          {(rows.length > 0 || allDay.length > 0) && (
            <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] gap-y-1 border-b-[1.5px] border-line bg-paper py-1.5">
              <div className="px-1.5 py-1 text-[10px] font-bold text-sub-2 uppercase" style={{ gridRow: `1 / ${rows.length + 2}` }}>
                Stay
              </div>
              {rows.map((row, r) =>
                row.map(({ stay, col, span }) => (
                  <div
                    key={stay.id}
                    style={{ gridColumn: `${col + 2} / span ${span}`, gridRow: r + 1 }}
                    className="mx-1 flex min-w-0 items-center gap-1.5 rounded-md bg-sage px-2 py-0.5 text-[11px] font-bold"
                    title={`${stay.title}${stay.location ? ` · ${stay.location}` : ""} · ${stay.nights} nights`}
                  >
                    <BedIcon size={14} className="flex-none" />
                    <span className="truncate">
                      {stay.title}
                      {stay.location ? ` · ${stay.location}` : ""}
                    </span>
                  </div>
                )),
              )}
              {allDay.map((a) => (
                <div
                  key={a.id}
                  style={{ gridColumn: `${days.findIndex((d) => d?.iso === a.day) + 2} / span 1`, gridRow: rows.length + 1 }}
                  className="mx-1 truncate rounded-md border-[1.5px] border-dashed border-green bg-white px-2 py-1 text-xs font-bold"
                  title={a.title}
                >
                  {a.title}
                </div>
              ))}
            </div>
          )}

          {/* Hour grid */}
          <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))]">
            <div className="relative" style={{ height: GRID_HEIGHT }}>
              {HOURS.map((h) => (
                <div key={h} style={{ height: HOUR_PX }} className="-translate-y-1.5 pr-2 text-right text-[10px] font-semibold text-sub-2">
                  {h}
                </div>
              ))}
            </div>
            {days.map((d, i) => (
              <div
                key={d?.iso ?? `pad-${i}`}
                className={cn("relative border-l-[1.5px] border-line", !d && "bg-paper/60")}
                style={{
                  height: GRID_HEIGHT,
                  backgroundImage: `repeating-linear-gradient(to bottom, #E6EFE9 0, #E6EFE9 1px, transparent 1px, transparent ${HOUR_PX}px)`,
                }}
              >
                {d &&
                  layoutDay(calendar.events.filter((e) => e.day === d.iso && !(e.agendaId && hidden.has(e.agendaId)))).map(({ ev, lane, lanes }) => (
                    <EventBlock key={ev.key} ev={ev} lane={lane} lanes={lanes} onRemove={() => remove(ev)} />
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <AddPlanDialog day={addDay} variantId={variantId} onClose={() => setAddDay(null)} />
    </Widget>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("box-border size-3 rounded-[3px]", swatch)} />
      {label}
    </span>
  );
}

function EventBlock({ ev, lane, lanes, onRemove }: { ev: CalendarEvent; lane: number; lanes: number; onRemove: () => void }) {
  const durH = (ev.endMin - ev.startMin) / 60;
  const top = Math.round((ev.startMin / 60 - CAL_START_HOUR) * HOUR_PX) + 2;
  const height = Math.max(18, Math.round(durH * HOUR_PX) - 3);
  const travel = ev.kind === "transport";
  const width = `calc((100% - 6px) / ${lanes})`;
  return (
    <div
      className={cn(
        "absolute box-border overflow-hidden rounded-md border-[1.5px] py-0.5 pl-1.5 text-[10.5px] leading-tight",
        travel ? "border-green bg-green pr-[7px] text-white" : "border-green bg-white pr-[22px] text-ink",
      )}
      style={{ top, height, width, left: `calc(3px + ${width} * ${lane})` }}
      title={`${ev.title} · ${ev.timeLabel}`}
    >
      <div className="font-bold">{ev.title}</div>
      {height >= 36 && <div className="mt-0.5 font-medium">{ev.timeLabel}</div>}
      {ev.agendaId && (
        <button
          type="button"
          aria-label={`Remove ${ev.title}`}
          onClick={onRemove}
          className="absolute top-[3px] right-[3px] inline-flex size-[18px] items-center justify-center rounded-[5px] text-inherit hover:bg-mint"
        >
          <CloseIcon size={12} />
        </button>
      )}
    </div>
  );
}

function AddPlanDialog({ day, variantId, onClose }: { day: Day | null; variantId: string; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={!!day} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="pin-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display-heavy text-2xl uppercase">Add a plan</DialogTitle>
          <DialogDescription>
            {day ? `${day.weekday} ${day.dayNum} ${day.month}` : ""}. It goes on this plan&apos;s week.
          </DialogDescription>
        </DialogHeader>
        {day && (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const cost = Number(f.get("cost") || 0);
              startTransition(async () => {
                const res = await addAgendaAction({
                  variantId,
                  date: day.iso,
                  title: String(f.get("title") ?? ""),
                  time: String(f.get("time") ?? "") || null,
                  endTime: String(f.get("endTime") ?? "") || null,
                  kind: f.get("kind") === "NOTE" ? "NOTE" : "ACTIVITY",
                  location: String(f.get("location") ?? "") || null,
                  costCents: cost > 0 ? Math.round(cost * 100) : null,
                });
                if (res.ok) {
                  toast.success(res.message);
                  onClose();
                } else toast.error(res.error);
              });
            }}
          >
            <label className="grid gap-1 text-[11px] font-extrabold tracking-[1px] uppercase">
              What
              <input name="title" required maxLength={120} placeholder="e.g. Dinner in De Pijp" className="field" autoFocus />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-[11px] font-extrabold tracking-[1px] uppercase">
                From
                <input name="time" type="time" defaultValue="18:00" className="field" />
              </label>
              <label className="grid gap-1 text-[11px] font-extrabold tracking-[1px] uppercase">
                Until
                <input name="endTime" type="time" defaultValue="19:00" className="field" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-[11px] font-extrabold tracking-[1px] uppercase">
                Kind
                <select name="kind" className="field" defaultValue="ACTIVITY">
                  <option value="ACTIVITY">Activity</option>
                  <option value="NOTE">Note</option>
                </select>
              </label>
              <label className="grid gap-1 text-[11px] font-extrabold tracking-[1px] uppercase">
                Cost (€, group)
                <input name="cost" type="number" min={0} step="0.01" placeholder="0" className="field" />
              </label>
            </div>
            <label className="grid gap-1 text-[11px] font-extrabold tracking-[1px] uppercase">
              Where (optional)
              <input name="location" maxLength={120} className="field" />
            </label>
            <div className="mt-1 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn btn-white">
                Cancel
              </button>
              <button type="submit" disabled={pending} className="btn btn-lime shadow-hard-sm">
                {pending ? "Adding…" : "Add to week"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
