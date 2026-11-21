"use client";

import { ArrowLeftRight, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { StationPicker, type StationOption } from "@/components/search/station-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { searchHref, type SearchFilters, type SearchTarget } from "@/lib/search-params";
import type { SortMode } from "@/lib/ranking";

/** From / to / date / travelers. Submitting navigates; the server page runs the search. */
export function SearchForm({
  initial,
  sort,
  filters,
  target,
}: {
  initial: { origin: StationOption | null; dest: StationOption | null; date: string; travelers: number };
  sort: SortMode;
  filters: SearchFilters;
  target: SearchTarget;
}) {
  const router = useRouter();
  const [origin, setOrigin] = useState(initial.origin);
  const [dest, setDest] = useState(initial.dest);
  const [date, setDate] = useState(initial.date);
  const [travelers, setTravelers] = useState(initial.travelers);
  const [pending, startTransition] = useTransition();

  const canSearch = origin && dest && origin.id !== dest.id && date;

  return (
    <form
      className="grid gap-3 rounded-xl border bg-card p-3 shadow-sm md:grid-cols-[1fr_auto_1fr_10rem_7rem_auto] md:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSearch) return;
        startTransition(() =>
          router.push(
            searchHref({ originId: origin.id, destId: dest.id, date, travelers, sort, ...filters, ...target }),
          ),
        );
      }}
    >
      <StationPicker label="From" value={origin} onChange={setOrigin} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="justify-self-center"
        aria-label="Swap origin and destination"
        onClick={() => {
          setOrigin(dest);
          setDest(origin);
        }}
      >
        <ArrowLeftRight className="size-4" />
      </Button>
      <StationPicker label="To" value={dest} onChange={setDest} />
      <div className="space-y-1">
        <Label htmlFor="search-date" className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Date
        </Label>
        <Input id="search-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Travelers</Label>
        <Select value={String(travelers)} onValueChange={(v) => setTravelers(Number(v))}>
          <SelectTrigger aria-label="Travelers" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={!canSearch || pending} className="gap-2">
        <Search className="size-4" />
        {pending ? "Searching…" : "Search"}
      </Button>
    </form>
  );
}
