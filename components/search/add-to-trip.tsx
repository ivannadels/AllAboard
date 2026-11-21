"use client";

import { Check, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addJourneyToLeg, addJourneyToPlan, type ActionResult } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDay } from "@/lib/format";
import type { TripPicker } from "@/lib/queries";
import { normalize } from "@/lib/text";

interface JourneyRef {
  externalId: string;
  departAt: Date;
  originCity: string;
  destCity: string;
  seatsLeft: number | null;
}

function useSaveResult() {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const handle = (res: ActionResult) => {
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setSaved(true);
    toast.success(res.message, {
      action: { label: "View trip", onClick: () => router.push(`/trips/${res.tripId}`) },
    });
  };
  return { saved, handle };
}

/** Search opened from a leg: one click saves the result to that leg. */
export function SaveToLegButton({ journey, legId }: { journey: JourneyRef; legId: string }) {
  const [pending, startTransition] = useTransition();
  const { saved, handle } = useSaveResult();
  return (
    <Button
      size="sm"
      className="w-full gap-1.5"
      variant={saved ? "secondary" : "default"}
      disabled={pending || saved}
      onClick={() => startTransition(async () => handle(await addJourneyToLeg({ externalId: journey.externalId, legId })))}
    >
      {saved ? <Check className="size-4" /> : <Plus className="size-4" />}
      {saved ? "Saved to leg" : pending ? "Saving…" : "Save to leg"}
    </Button>
  );
}

/** Pick a trip and plan; the journey joins the matching leg or creates a new one. */
export function AddToTripDialog({
  journey,
  trips,
  defaultTripId,
}: {
  journey: JourneyRef;
  trips: TripPicker;
  defaultTripId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [tripId, setTripId] = useState(defaultTripId ?? trips[0]?.id ?? "");
  const trip = trips.find((t) => t.id === tripId);
  const [variantId, setVariantId] = useState(trip?.variants[0]?.id ?? "");
  const variant = trip?.variants.find((v) => v.id === variantId) ?? trip?.variants[0];
  const [pending, startTransition] = useTransition();
  const { saved, handle } = useSaveResult();

  const day = journey.departAt.toISOString().slice(0, 10);
  // Mirrors the server's leg matching (lib/itinerary.ts findOrCreateLeg) for the preview.
  const matchingLeg = variant?.legs.find(
    (l) =>
      l.date === day &&
      normalize(l.originCity) === normalize(journey.originCity) &&
      normalize(l.destCity) === normalize(journey.destCity),
  );
  const tooFewSeats = trip != null && journey.seatsLeft != null && journey.seatsLeft < trip.travelers;

  if (trips.length === 0) {
    return (
      <Button size="sm" variant="outline" className="w-full" asChild>
        <Link href="/">Create a trip first</Link>
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full gap-1.5" variant={saved ? "secondary" : "default"}>
          {saved ? <Check className="size-4" /> : <Plus className="size-4" />}
          {saved ? "Added" : "Add to trip"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to a trip</DialogTitle>
          <DialogDescription>
            {journey.originCity} → {journey.destCity}, {formatDay(journey.departAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Trip</Label>
            <Select
              value={tripId}
              onValueChange={(id) => {
                setTripId(id);
                setVariantId(trips.find((t) => t.id === id)?.variants[0]?.id ?? "");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a trip" />
              </SelectTrigger>
              <SelectContent>
                {trips.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {trip && (
            <div className="grid gap-1.5">
              <Label>Plan</Label>
              <Select value={variant?.id ?? ""} onValueChange={setVariantId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a plan" />
                </SelectTrigger>
                <SelectContent>
                  {trip.variants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {variant && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              {matchingLeg
                ? `Adds this journey as an option on the ${matchingLeg.originCity} → ${matchingLeg.destCity} leg. You can compare and select it on the trip page.`
                : `${variant.name} has no ${journey.originCity} → ${journey.destCity} leg on ${formatDay(journey.departAt)} yet, so a new leg will be created.`}
            </p>
          )}
          {tooFewSeats && (
            <p className="text-sm text-destructive">
              Only {journey.seatsLeft} seats left. Not enough for {trip.travelers} travelers.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!variant || pending || tooFewSeats}
            onClick={() =>
              variant &&
              startTransition(async () => {
                const res = await addJourneyToPlan({ externalId: journey.externalId, variantId: variant.id });
                handle(res);
                if (res.ok) setOpen(false);
              })
            }
          >
            {pending ? "Adding…" : matchingLeg ? "Add option" : "Create leg"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
