import { ArrowLeft, Leaf, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Co2Meter } from "@/components/co2-meter";
import { JourneySummary } from "@/components/journey-summary";
import { ModeIcon } from "@/components/mode-icon";
import { OptionBadges } from "@/components/option-badges";
import { ForecastBanner, PriceInsight } from "@/components/price-insight";
import { OptionActions } from "@/components/trip/option-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCo2, formatDateRange, formatDay, formatDuration, formatMoney } from "@/lib/format";
import { getTripBoard, type BoardLeg, type BoardVariant } from "@/lib/queries";
import { searchHref } from "@/lib/search-params";
import { getSimNow } from "@/lib/sim-clock";
import { chosenOption } from "@/lib/trip-summary";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TripPage({ params, searchParams }: PageProps<"/trips/[id]">) {
  const { id } = await params;
  const { plan } = await searchParams;
  const simNow = await getSimNow();
  const trip = await getTripBoard(id, simNow);
  if (!trip) notFound();

  const variant = trip.variants.find((v) => v.id === plan) ?? trip.variants[0];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          All trips
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{trip.name}</h1>
        <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
          <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" />
            {trip.travelers} {trip.travelers === 1 ? "traveler" : "travelers"}
          </span>
          {trip.budgetCents != null && <span>Budget {formatMoney(trip.budgetCents, "EUR", { decimals: false })}</span>}
        </p>
      </div>

      {variant && (
        <>
          <nav aria-label="Plans" className="flex flex-wrap gap-1 border-b">
            {trip.variants.map((v) => (
              <Link
                key={v.id}
                href={`/trips/${trip.id}?plan=${v.id}`}
                aria-current={v.id === variant.id ? "page" : undefined}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground",
                  v.id === variant.id ? "border-primary font-medium text-foreground" : "border-transparent",
                )}
              >
                {v.name}
              </Link>
            ))}
          </nav>

          <SummaryStrip variant={variant} travelers={trip.travelers} budgetCents={trip.budgetCents} />

          <div className="space-y-4">
            {variant.legs.map((leg, i) => (
              <LegCard key={leg.id} leg={leg} index={i} travelers={trip.travelers} simNow={simNow} />
            ))}
            {variant.legs.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">No legs yet.</CardContent>
              </Card>
            )}
            <Button variant="outline" asChild className="gap-2">
              <Link href={searchHref({ tripId: trip.id, travelers: trip.travelers })}>
                <Plus className="size-4" />
                Add a leg
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryStrip({ variant, travelers, budgetCents }: { variant: BoardVariant; travelers: number; budgetCents: number | null }) {
  const s = variant.summary;
  const stats = [
    { label: "Transport", value: formatMoney(s.transportCents, "EUR", { decimals: false }) },
    {
      label: "Total with stays",
      value: formatMoney(s.totalCents, "EUR", { decimals: false }),
      note: budgetCents != null ? `${Math.round((s.totalCents / budgetCents) * 100)}% of budget` : undefined,
    },
    { label: "Time on the move", value: formatDuration(s.travelMin) },
    { label: `Travel CO2 (${travelers})`, value: formatCo2(s.co2Grams) },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.3fr)]">
      {stats.map((st) => (
        <Card key={st.label} className="gap-1 py-3">
          <CardContent className="px-4">
            <div className="text-xs text-muted-foreground">{st.label}</div>
            <div className="text-lg font-semibold tabular-nums">{st.value}</div>
            {st.note && <div className="text-xs text-muted-foreground">{st.note}</div>}
          </CardContent>
        </Card>
      ))}
      <Card className="gap-1 bg-eco-soft py-3">
        <CardContent className="space-y-0.5 px-4">
          <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Leaf className="size-3.5 text-eco" aria-hidden />
            Flight you didn&apos;t take
          </div>
          <div className="text-lg font-semibold tabular-nums">{formatCo2(s.co2SavedGrams)} saved</div>
          <div className="text-xs text-muted-foreground">
            Flying these legs ≈ {formatCo2(s.flightCo2Grams)} for {travelers}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LegCard({ leg, index, travelers, simNow }: { leg: BoardLeg; index: number; travelers: number; simNow: Date }) {
  const chosen = chosenOption(leg.options);
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">
            Leg {index + 1} · {formatDay(leg.date)}
          </div>
          <CardTitle className="flex items-center gap-2">
            <ModeIcon mode={chosen?.mode ?? null} className="size-4 text-muted-foreground" />
            {leg.origin.name} → {leg.dest.name}
          </CardTitle>
          {leg.notes && <p className="text-sm text-muted-foreground">{leg.notes}</p>}
        </div>
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href={searchHref({ legId: leg.id })}>
            <Search className="size-4" />
            Find options
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {(chosen ?? leg.options[0]) && chosen?.status !== "BOOKED" && (
          <ForecastBanner forecast={(chosen ?? leg.options[0]).forecast} dateLabel={formatDay(leg.date)} />
        )}
        {leg.options.length === 0 ? (
          <p className="text-sm text-muted-foreground">No options saved yet. Use “Find options” to search.</p>
        ) : (
          <ol className="divide-y">
            {leg.options.map((o) => (
              <li
                key={o.id}
                className="grid gap-4 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_9.5rem] md:items-start"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {o.status !== "CANDIDATE" && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                        {o.status === "BOOKED" ? "Booked" : "Selected"}
                      </span>
                    )}
                    <OptionBadges badges={o.badges} />
                  </div>
                  <JourneySummary journey={o} />
                </div>
                <Co2Meter co2Grams={o.co2Grams} flightCo2Grams={leg.flightCo2Grams} className="md:pt-7" />
                <div className="md:pt-6">
                  <PriceInsight
                    priceCents={o.priceCents}
                    travelers={travelers}
                    history={o.history}
                    trendPct7d={o.trendPct7d}
                    simNow={simNow}
                  />
                </div>
                <div className="flex md:justify-end md:pt-6">
                  <OptionActions optionId={o.id} status={o.status} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
