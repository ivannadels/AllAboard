"use client";

import { useEffect, useState } from "react";
import { TrainIcon } from "@/components/aa/icons";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface StationOption {
  id: string;
  name: string;
  city: string;
  countryCode: string;
}

/** The template's big From/To input, backed by station autocomplete (/api/stations). */
export function StationField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: StationOption | null;
  onChange: (s: StationOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StationOption[]>([]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/stations?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then(setResults)
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  return (
    <div className="flex min-w-0 flex-[3_1_220px] flex-col gap-1.5">
      <label htmlFor={id} className="text-[11px] font-extrabold tracking-[1px] uppercase">
        {label}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            className={cn(
              "box-border flex min-h-[60px] w-full items-center rounded-xl border-2 border-ink bg-white px-3.5 text-left font-display text-[19px] font-bold",
              value ? "text-ink" : "text-sub-2",
            )}
          >
            <span className="truncate">{value ? value.name : "City or station"}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 rounded-xl border-2 border-ink p-0 shadow-hard-sm" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search stations…" value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>No stations found.</CommandEmpty>
              <CommandGroup>
                {results.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={s.id}
                    onSelect={() => {
                      onChange(s);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <TrainIcon size={16} className="text-sub" />
                    <span className="flex-1 truncate font-semibold">
                      {s.name}
                      <span className="ml-1.5 text-xs font-medium text-sub">
                        {s.city}, {s.countryCode}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
