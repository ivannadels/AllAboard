"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addAttractionAction } from "@/app/actions";
import { Widget } from "@/components/aa/widget";
import type { StopView } from "@/lib/board-view";
import { cn } from "@/lib/utils";

export function ThingsToDo({ stops, variantId }: { stops: StopView[]; variantId: string }) {
  const [cityKey, setCityKey] = useState(stops[0]?.cityKey);
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState<string | null>(null);
  const stop = stops.find((s) => s.cityKey === cityKey) ?? stops[0];
  const addedCount = stop?.attractions.filter((a) => a.added).length ?? 0;

  return (
    <Widget
      label="Things to do"
      title="Things to do"
      className="mt-[26px]"
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
                    "min-h-10 px-4 font-display-heavy text-[15px]",
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
      bodyClassName="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4 px-4 py-[18px]"
    >
      {!stop && <p className="m-0 text-sm font-semibold text-sub">Add a leg to a city to see things to do there.</p>}
      {stop && stop.attractions.length === 0 && (
        <p className="m-0 text-sm font-semibold text-sub">No suggestions for {stop.city} yet. Use + on the calendar to add your own plans.</p>
      )}
      {stop?.attractions.map((a) => (
        <article key={a.id} className="flex flex-col overflow-hidden rounded-[14px] border-2 border-ink bg-white">
          <div className="box-border flex h-[92px] items-end border-b-2 border-ink p-2.5" style={{ background: a.swatch }}>
            <span className="rounded-md bg-ink px-2 py-[3px] text-[11px] font-extrabold tracking-[0.6px] text-lime uppercase">{a.tag}</span>
          </div>
          <div className="flex flex-1 flex-col gap-[3px] px-3.5 pt-3 pb-3.5">
            <div className="font-display-heavy text-[19px] leading-tight">{a.name}</div>
            <div className="mb-2.5 flex-1 text-[13px] font-semibold text-sub-2">{a.blurb}</div>
            {a.added ? (
              <span className="inline-flex min-h-[38px] items-center text-[13px] font-extrabold text-green">On your week · {a.slotLabel} ✓</span>
            ) : (
              <button
                type="button"
                aria-label={`Add ${a.name} to calendar, ${a.slotLabel}`}
                disabled={pending && adding === a.id}
                onClick={() => {
                  setAdding(a.id);
                  startTransition(async () => {
                    const res = await addAttractionAction({ variantId, attractionId: a.id });
                    if (!res.ok) toast.error(res.error);
                    setAdding(null);
                  });
                }}
                className="btn btn-lime min-h-[38px] self-start rounded-[10px] px-3 text-[13px] shadow-hard-xs"
              >
                {pending && adding === a.id ? "Adding…" : `+ Add · ${a.slotLabel}`}
              </button>
            )}
          </div>
        </article>
      ))}
    </Widget>
  );
}
