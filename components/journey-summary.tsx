import { ArrowRight, ChevronDown, Clock } from "lucide-react";
import { MODE_LABEL, ModeIcon } from "@/components/mode-icon";
import { formatDuration, formatTime } from "@/lib/format";
import type { Mode } from "@/lib/types";

/** The shape both provider drafts and saved Options (with segments + stations) satisfy. */
export interface JourneyView {
  departAt: Date;
  arriveAt: Date;
  durationMin: number;
  changes: number;
  segments: {
    mode: Mode;
    operator: string;
    departAt: Date;
    arriveAt: Date;
    origin: { name: string; city: string };
    dest: { name: string; city: string };
  }[];
}

const DAY_MS = 86_400_000;

function dayOffset(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / DAY_MS);
}

export function changesLabel(changes: number): string {
  return changes === 0 ? "Direct" : changes === 1 ? "1 change" : `${changes} changes`;
}

/** Times, duration, changes, a per-segment mode strip, and expandable segment details. */
export function JourneySummary({ journey }: { journey: JourneyView }) {
  const { segments } = journey;
  const plusDays = dayOffset(journey.departAt, journey.arriveAt);
  const vias = segments.slice(0, -1).map((s) => s.dest.city);

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold tabular-nums">{formatTime(journey.departAt)}</span>
        <ArrowRight className="size-4 self-center text-muted-foreground" aria-label="to" />
        <span className="text-lg font-semibold tabular-nums">
          {formatTime(journey.arriveAt)}
          {plusDays > 0 && (
            <sup className="ml-0.5 text-xs font-medium text-muted-foreground" title="Arrives the next day">
              +{plusDays}
            </sup>
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5" />
          {formatDuration(journey.durationMin)}
        </span>
        <span>
          {changesLabel(journey.changes)}
          {vias.length > 0 && ` via ${vias.join(", ")}`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1 text-xs">
        {segments.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            {i > 0 && <span className="h-px w-2 bg-border" aria-hidden />}
            <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5">
              <ModeIcon mode={s.mode} className="size-3.5" />
              {s.operator}
            </span>
          </span>
        ))}
      </div>

      <details className="group text-xs">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
          <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
          Journey details
        </summary>
        <ol className="mt-2 space-y-2 border-l pl-3">
          {segments.map((s, i) => {
            const next = segments[i + 1];
            const transferMin = next ? Math.round((next.departAt.getTime() - s.arriveAt.getTime()) / 60_000) : 0;
            return (
              <li key={i} className="space-y-1">
                <div className="flex items-start gap-2">
                  <ModeIcon mode={s.mode} className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <div>
                    <div>
                      <span className="font-medium tabular-nums">{formatTime(s.departAt)}</span> {s.origin.name}
                    </div>
                    <div>
                      <span className="font-medium tabular-nums">{formatTime(s.arriveAt)}</span> {s.dest.name}
                    </div>
                    <div className="text-muted-foreground">
                      {MODE_LABEL[s.mode]} · {s.operator} ·{" "}
                      {formatDuration(Math.round((s.arriveAt.getTime() - s.departAt.getTime()) / 60_000))}
                    </div>
                  </div>
                </div>
                {next && (
                  <div className="text-muted-foreground">
                    Change {next.origin.name === s.dest.name ? `at ${s.dest.name}` : `from ${s.dest.name} to ${next.origin.name}`}{" "}
                    · {formatDuration(transferMin)}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </details>
    </div>
  );
}
