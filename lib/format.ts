// Display helpers. All dates are floating local times stored as UTC (see lib/types.ts),
// so every formatter pins timeZone to UTC.

const TZ = "UTC";
const LOCALE = "en-GB";

export function formatMoney(cents: number, currency = "EUR", opts: { decimals?: boolean } = {}): string {
  const decimals = opts.decimals ?? cents % 100 !== 0;
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(cents / 100);
}

/** 850 g · 17.5 kg · 1.24 t */
export function formatCo2(grams: number): string {
  if (grams < 1000) return `${Math.round(grams)} g`;
  if (grams < 1_000_000) return `${(grams / 1000).toFixed(grams < 100_000 ? 1 : 0)} kg`;
  return `${(grams / 1_000_000).toFixed(2)} t`;
}

/** 3h 19m · 45m */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}m`;
}

/** 08:16 */
export function formatTime(d: Date): string {
  return d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

/** Thu 15 Apr */
export function formatDay(d: Date): string {
  return d.toLocaleDateString(LOCALE, { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
}

/** 15 Apr 2027 */
export function formatDate(d: Date): string {
  return d.toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
}

/** 15–22 Apr 2027 · 28 Apr – 3 May 2027 */
export function formatDateRange(start: Date, end: Date): string {
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  if (sameMonth) {
    return `${start.getUTCDate()}–${formatDate(end)}`;
  }
  const startStr = start.toLocaleDateString(LOCALE, { day: "numeric", month: "short", timeZone: TZ });
  return `${startStr} – ${formatDate(end)}`;
}
