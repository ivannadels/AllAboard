"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createTripAction } from "@/app/actions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const label = "grid gap-1 text-[11px] font-extrabold tracking-[1px] uppercase";

/** NEW TRIP: name, dates, travelers, budget. Creates the trip with an empty Plan A and opens its board. */
export function NewTripDialog({ trigger, defaultStart }: { trigger: React.ReactNode; defaultStart: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="pin-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display-heavy text-2xl uppercase">Plan a new trip</DialogTitle>
          <DialogDescription>Start a blank board, then pin journeys to it from search.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const budget = Number(f.get("budget") || 0);
            startTransition(async () => {
              const res = await createTripAction({
                name: String(f.get("name") ?? ""),
                startDate: String(f.get("start") ?? ""),
                endDate: String(f.get("end") ?? ""),
                travelers: Number(f.get("travelers") ?? 1),
                budgetCents: budget > 0 ? Math.round(budget * 100) : null,
              });
              if (!res.ok) return void toast.error(res.error);
              setOpen(false);
              router.push(`/trips/${res.tripId}`);
            });
          }}
        >
          <label className={label}>
            Trip name
            <input name="name" required maxLength={80} placeholder="e.g. Alps by rail" className="field" autoFocus />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Start
              <input name="start" type="date" required defaultValue={defaultStart} className="field" />
            </label>
            <label className={label}>
              End
              <input name="end" type="date" required defaultValue={defaultStart} className="field" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Travellers
              <input name="travelers" type="number" min={1} max={9} defaultValue={2} required className="field" />
            </label>
            <label className={label}>
              Budget (€, optional)
              <input name="budget" type="number" min={0} step={10} placeholder="1500" className="field" />
            </label>
          </div>
          <div className="mt-1 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-white">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="btn btn-lime shadow-hard-sm">
              {pending ? "Creating…" : "Create trip"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
