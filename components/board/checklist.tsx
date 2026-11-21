"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { addChecklistAction, removeChecklistAction, toggleChecklistAction } from "@/app/actions";
import { CloseIcon } from "@/components/aa/icons";

type Item = { id: string; text: string; done: boolean };

/** The pinned lime "To do" note. */
export function Checklist({ tripId, items }: { tripId: string; items: Item[] }) {
  const [text, setText] = useState("");
  const [, startTransition] = useTransition();
  const [optimistic, apply] = useOptimistic(items, (state: Item[], change: { id: string; done?: boolean; remove?: boolean; add?: Item }) => {
    if (change.add) return [...state, change.add];
    if (change.remove) return state.filter((i) => i.id !== change.id);
    return state.map((i) => (i.id === change.id ? { ...i, done: change.done ?? i.done } : i));
  });
  const done = optimistic.filter((i) => i.done).length;

  const mutate = (change: Parameters<typeof apply>[0], action: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      apply(change);
      const res = await action();
      if (!res.ok) toast.error(res.error ?? "Something went wrong");
    });

  return (
    <section
      aria-label="Checklist"
      className="relative min-w-0 flex-[1_1_300px] -rotate-[0.8deg] rounded-md border-2 border-ink bg-lime px-[18px] pt-[22px] pb-[18px] shadow-hard"
    >
      <span aria-hidden="true" className="absolute -top-[9px] left-1/2 -ml-[9px] size-[18px] rounded-full border-2 border-ink bg-forest shadow-[0_2px_0_rgba(0,0,0,0.25)]" />
      <div className="flex items-baseline gap-2">
        <h2 className="m-0 font-display-heavy text-[22px]">TO DO</h2>
        <span className="text-[13px] font-bold">
          {done} of {optimistic.length} done
        </span>
      </div>
      <ul className="mt-3 mb-0 flex list-none flex-col gap-0.5 p-0">
        {optimistic.map((c) => (
          <li key={c.id} className="group flex items-center">
            <label
              htmlFor={`chk-${c.id}`}
              className="flex min-h-9 flex-1 cursor-pointer items-center gap-2.5 text-sm font-semibold"
              style={{ textDecoration: c.done ? "line-through" : "none", opacity: c.done ? 0.6 : 1 }}
            >
              <input
                id={`chk-${c.id}`}
                type="checkbox"
                checked={c.done}
                onChange={(e) => mutate({ id: c.id, done: e.target.checked }, () => toggleChecklistAction(c.id, e.target.checked))}
                className="size-[18px] flex-none accent-ink"
              />
              {c.text}
            </label>
            <button
              type="button"
              aria-label={`Delete "${c.text}"`}
              onClick={() => mutate({ id: c.id, remove: true }, () => removeChecklistAction(c.id))}
              className="inline-flex size-7 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-white/50 focus-visible:opacity-100"
            >
              <CloseIcon size={12} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-2.5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          setText("");
          mutate({ id: `tmp-${t}`, add: { id: `tmp-${t}`, text: t, done: false } }, () => addChecklistAction(tripId, t));
        }}
      >
        <label htmlFor="newCheck" className="sr-only">
          New checklist item
        </label>
        <input
          id="newCheck"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add something…"
          maxLength={200}
          className="min-h-10 min-w-0 flex-1 rounded-[9px] border-2 border-ink bg-white/70 px-2.5 text-sm font-semibold text-ink"
        />
        <button type="submit" className="btn btn-ink min-h-10 rounded-[9px] px-3.5 text-lime hover:text-lime">
          Add
        </button>
      </form>
    </section>
  );
}
