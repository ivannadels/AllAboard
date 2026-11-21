"use client";

import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { createContext, useContext } from "react";
import { DragIcon } from "@/components/aa/icons";
import { cn } from "@/lib/utils";

interface HandleContext {
  label: string;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  /** Callback ref for the element that starts a drag (the handle). */
  activator: (el: HTMLElement | null) => void;
  isDragging: boolean;
}

/** Provided by the board's sortable wrapper; widgets render <DragHandle /> in their header. */
export const DragHandleContext = createContext<HandleContext | null>(null);

/** The ⠿ handle. Only the handle starts a drag, so buttons and inputs inside widgets keep working. */
export function DragHandle({ className }: { className?: string }) {
  const ctx = useContext(DragHandleContext);
  const base = "inline-flex size-8 flex-none items-center justify-center rounded-lg text-sub-2";
  if (!ctx) {
    return (
      <span aria-hidden="true" className={cn(base, className)}>
        <DragIcon />
      </span>
    );
  }
  // Destructure so only `activator` is treated as a ref by the React compiler.
  const { activator, attributes, listeners, label, isDragging } = ctx;
  return (
    <button
      type="button"
      ref={activator}
      {...attributes}
      {...listeners}
      aria-label={`Move ${label}`}
      title={`Drag to move ${label}`}
      className={cn(
        base,
        "cursor-grab touch-none hover:bg-mint hover:text-ink focus-visible:outline-2 focus-visible:outline-green",
        isDragging && "cursor-grabbing bg-lime text-ink",
        className,
      )}
    >
      <DragIcon />
    </button>
  );
}
