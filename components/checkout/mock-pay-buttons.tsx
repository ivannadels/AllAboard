"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { mockPaymentAction } from "@/app/actions";

export function MockPayButtons({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = (outcome: "pay" | "decline") =>
    startTransition(async () => {
      const res = await mockPaymentAction(bookingId, outcome);
      if (!res.ok) return void toast.error(res.error);
      router.push(`/checkout/return?booking=${bookingId}`);
    });
  return (
    <div className="mt-5 grid gap-2">
      <button type="button" disabled={pending} onClick={() => go("pay")} className="btn btn-green min-h-12 font-display-heavy text-base shadow-hard-sm">
        {pending ? "Processing…" : "Pay (mock)"}
      </button>
      <button type="button" disabled={pending} onClick={() => go("decline")} className="btn btn-white">
        Simulate a declined card
      </button>
    </div>
  );
}
