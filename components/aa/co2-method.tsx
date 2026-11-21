"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CARSHARE_MIN_OCCUPANTS,
  DESNZ_2026,
  FLIGHT_DISTANCE_UPLIFT,
  GRID_EU_AVERAGE_G_PER_KWH,
  GRID_G_PER_KWH,
  HIGH_SPEED_MIN_AVG_KMH,
  RAIL_KWH_PER_PKM,
} from "@/lib/co2-factors";
import { cn } from "@/lib/utils";

const COUNTRY_NAME: Record<string, string> = {
  AT: "Austria",
  BE: "Belgium",
  CH: "Switzerland",
  DE: "Germany",
  ES: "Spain",
  FR: "France",
  GB: "United Kingdom",
  IT: "Italy",
  LU: "Luxembourg",
  NL: "Netherlands",
};

const g = (n: number) => `${n.toFixed(n < 10 ? 1 : 0)} g`;

/** "How we calculate" link + dialog explaining the emission factors and their sources. */
export function Co2Method({ className, label = "How we calculate" }: { className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const countries = Object.entries(GRID_G_PER_KWH).sort((a, b) => a[1] - b[1]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn("font-bold underline underline-offset-2 hover:text-ink", className)}>
        {label}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="pin-dialog max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display-heavy text-2xl uppercase">How we calculate CO₂e</DialogTitle>
            <DialogDescription>
              Estimates per passenger, in CO₂-equivalent, from fuel or electricity production to the wheels (well-to-wheel, as in ISO
              14083). Vehicle manufacturing and infrastructure aren&apos;t included.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 text-sm">
            <section>
              <h3 className="m-0 mb-1 font-display-heavy text-base">Trains</h3>
              <p className="m-0 text-sub">
                Electricity per passenger-km × the carbon intensity of the country&apos;s grid. High-speed trains (averaging{" "}
                {HIGH_SPEED_MIN_AVG_KMH}+ km/h) use about {RAIL_KWH_PER_PKM.highSpeed * 1000} Wh per passenger-km, intercity trains about{" "}
                {RAIL_KWH_PER_PKM.intercity * 1000} Wh. Cross-border trains use the average of both countries&apos; grids.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 rounded-lg bg-mint px-3 py-2 text-xs sm:grid-cols-3">
                {countries.map(([code, v]) => (
                  <span key={code} className="flex justify-between gap-2">
                    <span>{COUNTRY_NAME[code] ?? code}</span>
                    <b>{Math.round(v)}</b>
                  </span>
                ))}
                <span className="flex justify-between gap-2 text-sub">
                  <span>Other (EU avg.)</span>
                  <b>{Math.round(GRID_EU_AVERAGE_G_PER_KWH)}</b>
                </span>
              </div>
              <p className="m-0 mt-1 text-xs text-sub">Grid intensity in g CO₂e per kWh, 2025 (Ember).</p>
            </section>

            <section>
              <h3 className="m-0 mb-1 font-display-heavy text-base">Coaches and car shares</h3>
              <p className="m-0 text-sub">
                Coach: {g(DESNZ_2026.coachPerPkm)} per passenger-km. Car share: {g(DESNZ_2026.carPerVkm)} per car-km, shared between the
                driver and your group (at least {CARSHARE_MIN_OCCUPANTS} people).
              </p>
            </section>

            <section>
              <h3 className="m-0 mb-1 font-display-heavy text-base">The flight you didn&apos;t take</h3>
              <p className="m-0 text-sub">
                Straight-line distance between the cities +{Math.round((FLIGHT_DISTANCE_UPLIFT - 1) * 100)}% for real flight paths, at{" "}
                {g(DESNZ_2026.shortHaulFlightPerPkm)} per passenger-km (short-haul economy). That includes the extra warming from contrails
                and other effects at altitude; counting CO₂ only, it would be {g(DESNZ_2026.shortHaulFlightPerPkmNoRF)}.
              </p>
            </section>

            <section className="border-t-[1.5px] border-line pt-2 text-xs text-sub">
              Sources:{" "}
              <a href="https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026" target="_blank" rel="noopener noreferrer">
                UK DESNZ conversion factors 2026
              </a>
              ,{" "}
              <a href="https://ember-energy.org/data/yearly-electricity-data/" target="_blank" rel="noopener noreferrer">
                Ember electricity data
              </a>
              , Green Train programme and KTH (train energy use). Real emissions vary with the actual train, occupancy and route.
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
