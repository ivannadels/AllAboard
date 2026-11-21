"use client";

import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface StationOption {
  id: string;
  name: string;
  city: string;
  countryCode: string;
}

/** Station autocomplete backed by /api/stations (which goes through the provider). */
export function StationPicker({
  label,
  value,
  onChange,
  placeholder = "City or station",
}: {
  label: string;
  value: StationOption | null;
  onChange: (station: StationOption) => void;
  placeholder?: string;
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          className="h-auto w-full justify-between px-3 py-2 text-left font-normal"
        >
          <span className="min-w-0">
            <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
            <span className={cn("block truncate", !value && "text-muted-foreground")}>
              {value ? value.name : placeholder}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
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
                  <MapPin className="size-4 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    {s.name}
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {s.city}, {s.countryCode}
                    </span>
                  </span>
                  <Check className={cn("size-4", value?.id === s.id ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
