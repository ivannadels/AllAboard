import { DragIcon } from "@/components/aa/icons";
import { cn } from "@/lib/utils";

/** A pin-board card: 2px ink outline, hard shadow, header row with a (decorative) drag handle. */
export function Widget({
  title,
  label,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: React.ReactNode;
  label: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section aria-label={label} className={cn("overflow-hidden rounded-[18px] border-2 border-ink bg-white shadow-hard", className)}>
      <div className="flex flex-wrap items-center gap-2.5 border-b-2 border-ink py-3 pr-3.5 pl-2.5">
        <span className="inline-flex size-8 items-center justify-center text-sub-2" title="Widgets can be rearranged in a later version">
          <DragIcon />
        </span>
        <h2 className="m-0 font-display-heavy text-[22px] tracking-[-0.4px] uppercase">{title}</h2>
        {actions}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** Small uppercase label used above figures. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("text-[11px] font-extrabold tracking-[1.2px] text-sub uppercase", className)}>{children}</div>;
}

/** "Preview" marker for template content that isn't backed by data yet. */
export function PreviewTag({ note }: { note: string }) {
  return (
    <span
      title={note}
      className="inline-flex items-center rounded-md border border-dashed border-ink px-1.5 py-0.5 text-[10px] font-extrabold tracking-[0.8px] text-sub uppercase"
    >
      Preview
    </span>
  );
}
