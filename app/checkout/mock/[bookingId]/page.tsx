import { notFound } from "next/navigation";
import { MockPayButtons } from "@/components/checkout/mock-pay-buttons";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { paymentsMode } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

const eur = (c: number) => formatMoney(c, "EUR", { decimals: true });

/** Stand-in for Stripe Checkout when no Stripe key is configured (offline demo). */
export default async function MockCheckoutPage({ params }: PageProps<"/checkout/mock/[bookingId]">) {
  const { bookingId } = await params;
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { items: true } });
  if (!booking || booking.provider !== "mock") notFound();

  return (
    <main className="mx-auto box-border w-full max-w-[560px] px-4 py-10">
      <div className="mb-3 inline-flex rounded-md border-2 border-dashed border-ink bg-white px-2 py-1 text-[11px] font-extrabold tracking-[1px] uppercase">
        Mock checkout · no real payment · Stripe isn&apos;t configured
      </div>
      <section className="rounded-[18px] border-2 border-ink bg-white p-5 shadow-hard">
        <h1 className="m-0 mb-3 font-display-heavy text-2xl uppercase">Pay for your booking</h1>
        <ul className="m-0 list-none p-0 text-sm">
          {booking.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 border-b-[1.5px] border-line py-2">
              <span className="font-semibold">{i.description}</span>
              <b className="whitespace-nowrap">
                {i.travelers} × {eur(i.fareCents)}
              </b>
            </li>
          ))}
          <li className="flex justify-between border-b-[1.5px] border-line py-2">
            <span className="font-semibold">AllAboard booking fee</span>
            <b>{eur(booking.feeCents)}</b>
          </li>
        </ul>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-sm font-semibold text-sub">Total</span>
          <span className="font-display-heavy text-3xl">{eur(booking.totalCents)}</span>
        </div>
        {booking.status === "PENDING" && paymentsMode() === "mock" ? (
          <MockPayButtons bookingId={booking.id} />
        ) : (
          <p className="mt-4 mb-0 text-sm font-semibold text-sub">This checkout is no longer open ({booking.status.toLowerCase()}).</p>
        )}
      </section>
    </main>
  );
}
