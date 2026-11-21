"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { duplicatePlanAction } from "@/app/actions";
import { GridPlusIcon } from "@/components/aa/icons";
import { cn } from "@/lib/utils";

export const WIDGETS = [
  ["calendar", "Week calendar"],
  ["bookings", "Selected journeys"],
  ["checklist", "Checklist"],
  ["attractions", "Things to do"],
  ["co2", "CO₂ vs flying"],
  ["bikes", "Bike share"],
  ["budget", "Budget"],
] as const;

export type WidgetKey = (typeof WIDGETS)[number][0];

const STORAGE_KEY = "aa-board-hidden-widgets";
const CHANGE_EVENT = "aa-board-widgets-change";

// Which widgets are hidden: a per-viewer convenience in localStorage. Read through
// useSyncExternalStore so the server render (everything shown) and the first client render
// agree, and a broken/blocked storage just means "show everything".
function readRaw(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function parseHidden(raw: string): Set<WidgetKey> {
  try {
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

/** Board layout + "Customize board" (which widgets show, remembered in this browser). */
export function BoardShell({
  headerLeft,
  headerRightTop,
  plans,
  variantId,
  tripId,
  widgets,
}: {
  headerLeft: React.ReactNode;
  headerRightTop: React.ReactNode;
  plans: { id: string; label: string; active: boolean }[];
  variantId: string;
  tripId: string;
  widgets: Record<WidgetKey, React.ReactNode>;
}) {
  const router = useRouter();
  const [customizing, setCustomizing] = useState(false);
  const raw = useSyncExternalStore(subscribe, readRaw, () => "[]");
  const hidden = parseHidden(raw);
  const [pending, startTransition] = useTransition();

  const toggle = (key: WidgetKey) => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {}
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  const show = (key: WidgetKey) => !hidden.has(key) && widgets[key];

  return (
    <main className="mx-auto box-border w-full max-w-[1440px] px-4 pt-7 pb-14 sm:px-8">
      <section className="mb-6 flex flex-wrap items-end gap-5">
        <div className="min-w-0 flex-[999_1_560px]">{headerLeft}</div>
        <div className="flex flex-col items-end gap-3">
          {headerRightTop}
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <div role="group" aria-label="Plan version" className="inline-flex overflow-hidden rounded-xl border-2 border-ink bg-white">
              {plans.map((p) => (
                <Link
                  key={p.id}
                  href={`/trips/${tripId}?plan=${p.id}`}
                  aria-current={p.active ? "true" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center px-4 text-sm font-bold no-underline",
                    p.active ? "bg-ink text-white hover:text-white" : "bg-white text-ink hover:bg-mint hover:text-ink",
                  )}
                >
                  {p.label}
                </Link>
              ))}
              <button
                type="button"
                aria-label="Duplicate this plan as a new version"
                title="Duplicate this plan"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await duplicatePlanAction(variantId);
                    if (!res.ok) return void toast.error(res.error);
                    toast.success(res.message);
                    router.push(`/trips/${tripId}?plan=${res.variantId}`);
                  })
                }
                className="min-h-11 w-11 border-l-2 border-ink bg-white text-lg font-bold text-ink hover:bg-lime"
              >
                +
              </button>
            </div>
            <button
              type="button"
              aria-expanded={customizing}
              onClick={() => setCustomizing((c) => !c)}
              className="btn btn-lime shadow-hard-sm"
            >
              <GridPlusIcon size={18} />
              Customize board
            </button>
          </div>
        </div>
      </section>

      {customizing && (
        <section aria-label="Customize board" className="mb-6 rounded-[18px] border-2 border-ink bg-white px-5 py-[18px] shadow-hard">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="m-0 font-display-heavy text-xl">Widgets on this board</h2>
            <span className="text-[13px] text-sub-2">Toggle widgets on or off. Your choice is saved in this browser.</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {WIDGETS.map(([key, label]) => (
              <label key={key} htmlFor={`w-${key}`} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 border-ink bg-mint px-3.5 text-sm font-bold">
                <input id={`w-${key}`} type="checkbox" checked={!hidden.has(key)} onChange={() => toggle(key)} className="size-[18px] accent-green" />
                {label}
              </label>
            ))}
            <button
              type="button"
              disabled
              title="Coming later: notes, weather and a packing list"
              className="min-h-11 rounded-full border-2 border-dashed border-ink bg-transparent px-3.5 text-sm font-bold text-ink disabled:opacity-60"
            >
              + Notes · Weather · Packing list
            </button>
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-start gap-[22px]">
        {show("calendar")}
        {(show("bookings") || show("co2")) && (
          <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-[18px]">
            {show("bookings")}
            {show("co2")}
          </div>
        )}
      </div>
      {show("attractions")}
      <div className="mt-[26px] flex flex-wrap items-start gap-[22px]">
        {show("checklist")}
        {(show("bikes") || show("budget")) && (
          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-[22px]">
            {show("bikes")}
            {show("budget")}
          </div>
        )}
      </div>
      <p className="mt-7 mb-0 text-xs font-semibold text-sub-2">
        Prices, seats and bike counts are mock data in this prototype. CO₂ figures are estimates.
      </p>
    </main>
  );
}
