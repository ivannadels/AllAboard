// The pin-board icon set, lifted from the allaboard-templates SVGs.
import type { SVGProps } from "react";
import type { Mode } from "@/lib/types";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function Svg({ size = 18, strokeWidth = 2.4, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const TrainIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="3" width="14" height="14" rx="3" />
    <path d="M5 11h14M9 21l-2-4M15 21l2-4" />
  </Svg>
);

export const BusIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="3" width="16" height="15" rx="3" />
    <path d="M4 11h16M8 18v3M16 18v3M8 14.5h.01M16 14.5h.01" />
  </Svg>
);

export const CarIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 13l1.6-4.6A2 2 0 0 1 8.5 7h7a2 2 0 0 1 1.9 1.4L19 13" />
    <rect x="3" y="13" width="18" height="5" rx="2" />
    <path d="M6 18v2M18 18v2" />
  </Svg>
);

export const BikeIcon = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}>
    <circle cx="6" cy="17" r="3.5" />
    <circle cx="18" cy="17" r="3.5" />
    <path d="M6 17l4-8h5l3 8M10 9l-1-3H7M14 9l-2 8" />
  </Svg>
);

export const LeafIcon = (p: IconProps) => (
  <Svg strokeWidth={2.6} {...p}>
    <path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l8-8" />
  </Svg>
);

export const CalendarIcon = (p: IconProps) => (
  <Svg strokeWidth={2.5} {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Svg>
);

export const PeopleIcon = (p: IconProps) => (
  <Svg strokeWidth={2.5} {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2.1.7 3.5 2.8 3.5 5.7" />
  </Svg>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Svg strokeWidth={2.8} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

/** The heavier "to" arrow used between city names. */
export const RouteArrowIcon = ({ label = "to", ...p }: IconProps & { label?: string }) => (
  <svg
    role="img"
    aria-label={label}
    width={p.size ?? 22}
    height={p.size ?? 22}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={3.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={p.className}
    style={{ flex: "none" }}
  >
    <path d="M4 12h15M13 5l7 7-7 7" />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg strokeWidth={3} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const SearchIcon = (p: IconProps) => (
  <Svg strokeWidth={2.6} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Svg>
);

export const SwapIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4" />
  </Svg>
);

export const BedIcon = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}>
    <path d="M3 18V7M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6" />
    <circle cx="7" cy="11" r="2" />
  </Svg>
);

export const ShareIcon = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" />
  </Svg>
);

export const GridPlusIcon = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <path d="M17.5 14v7M14 17.5h7" />
  </Svg>
);

export const DragIcon = ({ size = 16, ...p }: IconProps) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <circle cx="9" cy="6" r="1.6" />
    <circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" />
    <circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" />
    <circle cx="15" cy="18" r="1.6" />
  </svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg strokeWidth={3} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg strokeWidth={2.6} {...p}>
    <path d="M5 12l5 5L20 7" />
  </Svg>
);

export const TrendDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8l6 6 4-4 6 6M14 16h6v-6" />
  </Svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Svg strokeWidth={2.6} {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);

export const TrashIcon = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Svg>
);

export const ExternalIcon = (p: IconProps) => (
  <Svg strokeWidth={2.4} {...p}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Svg>
);

export function ModeGlyph({ mode, ...p }: IconProps & { mode: Mode | null }) {
  switch (mode) {
    case "TRAIN":
      return <TrainIcon {...p} />;
    case "BUS":
      return <BusIcon {...p} />;
    case "CARSHARE":
      return <CarIcon {...p} />;
    case "BIKE":
      return <BikeIcon {...p} />;
    default:
      return <CalendarIcon {...p} />;
  }
}

export const MODE_NAME: Record<Mode, string> = { TRAIN: "Train", BUS: "Bus", CARSHARE: "Car share", BIKE: "Bike" };
