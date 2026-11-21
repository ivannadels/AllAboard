"use client";

import { Check, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { removeOptionAction, selectOptionAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { OptionStatus } from "@/lib/types";

export function OptionActions({ optionId, status }: { optionId: string; status: OptionStatus }) {
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Something went wrong");
    });

  if (status === "BOOKED") return <span className="text-xs font-medium text-muted-foreground">Booked</span>;

  return (
    <div className="flex items-center gap-1.5">
      {status === "SELECTED" ? (
        <Button size="sm" variant="secondary" disabled className="gap-1.5">
          <Check className="size-4" />
          Selected
        </Button>
      ) : (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => selectOptionAction(optionId))}>
          Select
        </Button>
      )}
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Remove option"
        disabled={pending}
        onClick={() => run(() => removeOptionAction(optionId))}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
