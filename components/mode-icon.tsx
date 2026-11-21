import { Bike, Bus, CarFront, CircleDashed, TrainFront, type LucideProps } from "lucide-react";
import type { Mode } from "@/lib/types";

const ICONS = { TRAIN: TrainFront, BUS: Bus, CARSHARE: CarFront, BIKE: Bike } as const;

export const MODE_LABEL: Record<Mode, string> = {
  TRAIN: "Train",
  BUS: "Bus",
  CARSHARE: "Car share",
  BIKE: "Bike",
};

/** Icon for a transport mode; dashed circle when no option is chosen yet. */
// SVG props already define a `mode` attribute, so omit it before adding ours.
export function ModeIcon({ mode, ...props }: { mode: Mode | null } & Omit<LucideProps, "mode">) {
  const Icon = mode ? ICONS[mode] : CircleDashed;
  return <Icon aria-label={mode ? MODE_LABEL[mode] : "Not chosen yet"} {...props} />;
}
