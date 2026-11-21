"use client";

import {
  closestCenter,
  DndContext,
  getFirstCollision,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { duplicatePlanAction, saveBoardLayoutAction } from "@/app/actions";
import { DragHandleContext } from "@/components/aa/drag-handle";
import { GridPlusIcon } from "@/components/aa/icons";
import {
  COLUMN_IDS,
  COLUMN_LABELS,
  DEFAULT_LAYOUT,
  WIDGET_KEYS,
  WIDGET_LABELS,
  columnOf,
  isColumnId,
  isWidgetKey,
  moveWidget,
  sameLayout,
  setHidden,
  type BoardLayout,
  type ColumnId,
  type WidgetKey,
} from "@/lib/board-layout";
import { cn } from "@/lib/utils";

const labelOf = (id: UniqueIdentifier | undefined) =>
  isWidgetKey(id) ? WIDGET_LABELS[id] : isColumnId(id) ? `the ${COLUMN_LABELS[id]}` : "the board";

/**
 * The trip board: header, "Customize board", and a two-column board whose widgets can be
 * dragged (by their ⠿ handle, with mouse, touch or keyboard) within and between columns.
 * The arrangement and hidden widgets are saved on the trip.
 */
export function BoardShell({
  headerLeft,
  headerRightTop,
  plans,
  variantId,
  tripId,
  initialLayout,
  widgets,
}: {
  headerLeft: React.ReactNode;
  headerRightTop: React.ReactNode;
  plans: { id: string; label: string; active: boolean }[];
  variantId: string;
  tripId: string;
  initialLayout: BoardLayout;
  widgets: Record<WidgetKey, React.ReactNode>;
}) {
  const router = useRouter();
  const [customizing, setCustomizing] = useState(false);
  const [layout, setLayout] = useState(initialLayout);
  const [activeKey, setActiveKey] = useState<WidgetKey | null>(null);
  const saved = useRef(initialLayout);
  const beforeDrag = useRef(initialLayout);
  // Mirrors for the collision detector, which runs outside React's render.
  const layoutRef = useRef(initialLayout);
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const movedColumn = useRef(false);
  useEffect(() => {
    layoutRef.current = layout;
    // A cross-column move has been rendered; collisions can be trusted again.
    const frame = requestAnimationFrame(() => (movedColumn.current = false));
    return () => cancelAnimationFrame(frame);
  }, [layout]);
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const hidden = new Set(layout.hidden);
  const visible = (col: ColumnId) => layout.columns[col].filter((k) => !hidden.has(k));
  const containerOf = (id: UniqueIdentifier | undefined): ColumnId | null =>
    isColumnId(id) ? id : isWidgetKey(id) ? columnOf(layout, id) : null;

  /**
   * Multi-column collision detection (after dnd-kit's multiple-containers recipe): use what's
   * under the pointer (or overlapping, for keyboard), and inside a column pick its closest
   * widget. Right after a widget changes column, keep the previous target for a frame so
   * the two columns don't flip it back and forth.
   */
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerHits = pointerWithin(args);
    const hits = pointerHits.length > 0 ? pointerHits : rectIntersection(args);
    let overId = getFirstCollision(hits, "id");
    if (overId != null) {
      if (isColumnId(overId)) {
        const l = layoutRef.current;
        const items = l.columns[overId].filter((k) => !l.hidden.includes(k));
        if (items.length > 0) {
          overId =
            closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter((c) => c.id !== overId && isWidgetKey(c.id) && items.includes(c.id)),
            })[0]?.id ?? overId;
        }
      }
      lastOverId.current = overId;
      return [{ id: overId }];
    }
    if (movedColumn.current) lastOverId.current = args.active.id;
    return lastOverId.current ? [{ id: lastOverId.current }] : [];
  }, []);

  /** Show the new layout now; save it; put the last saved one back if saving fails. */
  const commit = (next: BoardLayout) => {
    setLayout(next);
    if (sameLayout(next, saved.current)) return;
    startTransition(async () => {
      const res = await saveBoardLayoutAction(tripId, next);
      if (res.ok) saved.current = next;
      else {
        toast.error(`Couldn't save the board layout. ${res.error}`);
        setLayout(saved.current);
      }
    });
  };

  // Crossing into another column moves the widget there while dragging.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || !isWidgetKey(active.id)) return;
    const from = containerOf(active.id);
    const to = containerOf(over.id);
    if (!from || !to || from === to) return;
    const key = active.id;
    movedColumn.current = true;
    setLayout((l) => {
      if (l.columns[to].includes(key)) return l; // already there: no re-render, no loop
      const target = l.columns[to].filter((k) => k !== key);
      let index = target.length;
      if (isWidgetKey(over.id)) {
        const overIndex = target.indexOf(over.id);
        const dragged = active.rect.current.translated;
        const below = dragged ? dragged.top > over.rect.top + over.rect.height / 2 : false;
        index = overIndex + (below ? 1 : 0);
      }
      return moveWidget(l, key, to, index);
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveKey(null);
    if (!isWidgetKey(active.id)) return;
    let next = layout;
    const col = containerOf(active.id);
    if (over && col && isWidgetKey(over.id) && over.id !== active.id && containerOf(over.id) === col) {
      next = moveWidget(layout, active.id, col, layout.columns[col].indexOf(over.id));
    }
    commit(next);
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${labelOf(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${labelOf(active.id)} is over ${labelOf(over.id)}.` : `${labelOf(active.id)} is not over a column.`),
    onDragEnd: ({ active, over }) => {
      const col = containerOf(active.id);
      return over && col ? `${labelOf(active.id)} moved to the ${COLUMN_LABELS[col]}.` : `${labelOf(active.id)} dropped.`;
    },
    onDragCancel: ({ active }) => `Moving ${labelOf(active.id)} was cancelled. It's back where it was.`,
  };

  return (
    <main className="mx-auto box-border w-full max-w-[1440px] px-4 pt-4 pb-10 sm:px-6">
      <section className="mb-3 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-[999_1_560px]">{headerLeft}</div>
        <div className="flex flex-col items-end gap-2">
          {headerRightTop}
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <div role="group" aria-label="Plan version" className="inline-flex overflow-hidden rounded-xl border-2 border-ink bg-white">
              {plans.map((p) => (
                <Link
                  key={p.id}
                  href={`/trips/${tripId}?plan=${p.id}`}
                  aria-current={p.active ? "true" : undefined}
                  className={cn(
                    "inline-flex min-h-9 items-center px-3 text-[13px] font-bold no-underline",
                    p.active ? "bg-ink text-white hover:text-white" : "bg-white text-ink hover:bg-mint hover:text-ink",
                  )}
                >
                  {p.label}
                </Link>
              ))}
              <button
                type="button"
                aria-label="Duplicate this plan as a new version"
                title="Duplicate this plan"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await duplicatePlanAction(variantId);
                    if (!res.ok) return void toast.error(res.error);
                    toast.success(res.message);
                    router.push(`/trips/${tripId}?plan=${res.variantId}`);
                  })
                }
                className="min-h-9 w-9 border-l-2 border-ink bg-white text-base font-bold text-ink hover:bg-lime"
              >
                +
              </button>
            </div>
            <button type="button" aria-expanded={customizing} onClick={() => setCustomizing((c) => !c)} className="btn btn-lime min-h-9 px-3 text-[13px] shadow-hard-sm">
              <GridPlusIcon size={16} />
              Customize board
            </button>
          </div>
        </div>
      </section>

      {customizing && (
        <section aria-label="Customize board" className="mb-3 rounded-[18px] border-2 border-ink bg-white px-4 py-3 shadow-hard">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="m-0 font-display-heavy text-xl">Widgets on this board</h2>
            <span className="text-[13px] text-sub-2">
              Toggle widgets on or off. Drag any widget by its ⠿ handle to move it (or focus the handle and use Space and the arrow keys).
            </span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {WIDGET_KEYS.map((key) => (
              <label key={key} htmlFor={`w-${key}`} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 border-ink bg-mint px-3.5 text-sm font-bold">
                <input
                  id={`w-${key}`}
                  type="checkbox"
                  checked={!hidden.has(key)}
                  onChange={(e) => commit(setHidden(layout, key, !e.target.checked))}
                  className="size-[18px] accent-green"
                />
                {WIDGET_LABELS[key]}
              </label>
            ))}
            <button
              type="button"
              disabled
              title="Coming later: notes, weather and a packing list"
              className="min-h-11 rounded-full border-2 border-dashed border-ink bg-transparent px-3.5 text-sm font-bold text-ink disabled:opacity-60"
            >
              + Notes · Weather · Packing list
            </button>
            <div className="flex-1" />
            <button type="button" disabled={sameLayout(layout, DEFAULT_LAYOUT)} onClick={() => commit(DEFAULT_LAYOUT)} className="btn btn-white">
              Reset layout
            </button>
          </div>
        </section>
      )}

      <DndContext
        id="trip-board"
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={({ active }) => {
          beforeDrag.current = layout;
          if (isWidgetKey(active.id)) setActiveKey(active.id);
        }}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveKey(null);
          setLayout(beforeDrag.current);
        }}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "To move a widget, press Space or Enter on its handle. Use the arrow keys to move it, including into the other column, then press Space or Enter to drop it, or Escape to cancel.",
          },
        }}
      >
        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {COLUMN_IDS.map((col) => (
            <BoardColumn key={col} id={col} dragging={activeKey != null}>
              <SortableContext items={visible(col)} strategy={verticalListSortingStrategy}>
                {visible(col).map((key) => (
                  <SortableWidget key={key} id={key}>
                    {widgets[key]}
                  </SortableWidget>
                ))}
              </SortableContext>
            </BoardColumn>
          ))}
        </div>
      </DndContext>

      <p className="mt-4 mb-0 text-xs font-semibold text-sub-2">
        Prices, seats and bike counts are mock data in this prototype. CO₂ figures are estimates.
      </p>
    </main>
  );
}

function BoardColumn({ id, dragging, children }: { id: ColumnId; dragging: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      aria-label={COLUMN_LABELS[id]}
      className={cn(
        // min-height keeps an emptied column droppable; nothing resizes while dragging.
        "flex min-h-40 min-w-0 flex-col gap-3 rounded-[22px] transition-[outline-color]",
        dragging && "outline-2 outline-offset-8 outline-transparent outline-dashed",
        dragging && isOver && "outline-ink/40",
      )}
    >
      {children}
    </div>
  );
}

function SortableWidget({ id, children }: { id: WidgetKey; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative min-w-0", isDragging && "z-30 opacity-90 [&>*]:shadow-[9px_9px_0_var(--aa-ink)]")}
    >
      <DragHandleContext.Provider value={{ label: WIDGET_LABELS[id], attributes, listeners, activator: setActivatorNodeRef, isDragging }}>
        {children}
      </DragHandleContext.Provider>
    </div>
  );
}
