import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon, CheckIcon, CloseIcon } from "@/components/aa/icons";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { closeBooking, syncCheckoutSession } from "@/lib/payments/booking";
import { getStripe } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

const eur = (c: number) => formatMoney(c, "EUR", { decimals: true });

const STATUS = {
  PAID: { title: "You're booked", tone: "bg-lime", body: "Payment received. Your legs are marked as booked on the board." },
  PENDING: { title: "Payment pending", tone: "bg-paper", body: "We're waiting for confirmation from the payment provider. This page will show the result once it arrives." },
  FAILED: { title: "Payment declined", tone: "bg-warn-bg", body: "Nothing was charged. Your legs are still selected, so you can try again from the board." },
  CANCELED: { title: "Checkout cancelled", tone: "bg-paper", body: "Nothing was charged. Your legs are still selected on the board." },
} as const;

/** Where Stripe Checkout (and the mock checkout) send the traveler back. */
export default async function CheckoutReturnPage({ searchParams }: PageProps<"/checkout/return">) {
  const sp = await searchParams;
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : null;
  let bookingId = typeof sp.booking === "string" ? sp.booking : null;

  // Confirm with Stripe directly, so this works even without the webhook running.
  if (sessionId && getStripe()) bookingId = (await syncCheckoutSession(sessionId)) ?? bookingId;
  if (bookingId && sp.cancelled === "1") await closeBooking(bookingId, "CANCELED");
  if (!bookingId) notFound();

  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { items: true, transfers: true, trip: true } });
  if (!booking) notFound();
  const s = STATUS[booking.status];

  return (
    <main className="mx-auto box-border w-full max-w-[760px] px-4 py-10 sm:px-8">
      <section className="overflow-hidden rounded-[18px] border-2 border-ink bg-white shadow-hard">
        <div className={`flex items-center gap-3 border-b-2 border-ink px-5 py-4 ${s.tone}`}>
          <span className="flex size-10 items-center justify-center rounded-full border-2 border-ink bg-white">
            {booking.status === "PAID" ? <CheckIcon size={20} /> : <CloseIcon size={18} />}
          </span>
          <div>
            <h1 className="m-0 font-display-heavy text-2xl uppercase">{s.title}</h1>
            <p className="m-0 text-sm font-semibold text-sub">{s.body}</p>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="mb-2 text-[11px] font-extrabold tracking-[1.2px] text-sub uppercase">
            {booking.trip.name} · {booking.travelers} {booking.travelers === 1 ? "traveller" : "travellers"} ·{" "}
            {booking.provider === "stripe" ? "Stripe (test mode)" : "Mock payment"}
          </div>
          <ul className="m-0 list-none p-0">
            {booking.items.map((i) => (
              <li key={i.id} className="flex items-baseline justify-between gap-3 border-b-[1.5px] border-line py-2 text-sm">
                <span className="font-semibold">{i.description}</span>
                <span className="font-bold whitespace-nowrap">
                  {i.travelers} × {eur(i.fareCents)}
                </span>
              </li>
            ))}
            <li className="flex justify-between gap-3 border-b-[1.5px] border-line py-2 text-sm">
              <span className="font-semibold">AllAboard booking fee</span>
              <span className="font-bold">{eur(booking.feeCents)}</span>
            </li>
          </ul>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-sub">
              {booking.taxCents > 0 ? `Includes ${eur(booking.taxCents)} VAT on the booking fee` : "VAT on the booking fee is included"}
            </span>
            <span className="font-display-heavy text-3xl">{eur(booking.totalCents)}</span>
          </div>

          {booking.status === "PAID" && (
            <div className="mt-5 rounded-xl bg-mint px-4 py-3">
              <div className="mb-1 text-[11px] font-extrabold tracking-[1.2px] text-sub uppercase">Fares owed to operators</div>
              <ul className="m-0 list-none p-0 text-sm">
                {booking.transfers.map((t) => (
                  <li key={t.id} className="flex justify-between gap-3 py-0.5">
                    <span className="font-semibold">{t.operator}</span>
                    <span className="text-right">
                      <b>{eur(t.amountCents)}</b>{" "}
                      <span className="text-xs text-sub">
                        {/* Without Stripe Connect, AllAboard settles with operators outside Stripe. */}
                        {t.status === "sent" ? "· paid out via Stripe Connect" : t.status === "failed" ? "· payout failed, retry needed" : "· settled outside Stripe"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link
            href={`/trips/${booking.tripId}?plan=${booking.variantId}`}
            className="btn btn-ink mt-6 w-full rounded-full font-display-heavy text-base text-white hover:text-lime"
          >
            Back to your board <ArrowRightIcon size={18} />
          </Link>
        </div>
      </section>
    </main>
  );
}
