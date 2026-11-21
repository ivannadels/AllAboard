import { operatorStyle } from "@/lib/operators";
import { cn } from "@/lib/utils";

/** 50×50 operator badge (initials until real logos are added). "+1" when several operators. */
export function OperatorBadge({ operator, size = 50, className }: { operator: string; size?: number; className?: string }) {
  const s = operatorStyle(operator);
  return (
    <span aria-hidden="true" className={cn("relative flex-none", className)} style={{ width: size, height: size }}>
      {s.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.logoUrl} alt="" width={size} height={size} className="rounded-xl border-2 border-ink" />
      ) : (
        <span
          className="flex size-full items-center justify-center rounded-xl border-2 border-ink font-display-heavy"
          style={{ background: s.bg, color: s.fg, fontSize: size * 0.32 }}
        >
          {s.initials}
        </span>
      )}
      {s.extra > 0 && (
        <span className="absolute -right-2 -bottom-2 rounded-full border-2 border-ink bg-white px-1 text-[10px] font-extrabold">
          +{s.extra}
        </span>
      )}
    </span>
  );
}
