import { ArrowRight, Leaf, Users } from "lucide-react";
import Link from "next/link";
import { ModeIcon } from "@/components/mode-icon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCo2, formatDateRange, formatMoney } from "@/lib/format";
import { getTripsOverview, type TripOverview } from "@/lib/queries";

// Live SQLite data + simulated clock: render on every request.
export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const trips = await getTripsOverview();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your trips</h1>
        <p className="text-sm text-muted-foreground">
          Draft itineraries, compare plans, and book when the price is right.
        </p>
      </div>

      {trips.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No trips yet. Run <code className="font-mono">npm run seed</code> to load the demo trips.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}

function TripCard({ trip }: { trip: TripOverview }) {
  const s = trip.summary;
  return (
    <Link href={`/trips/${trip.id}`} className="group block focus-visible:outline-none">
      <Card className="h-full transition-shadow group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <CardHeader>
          <CardTitle className="leading-snug">{trip.name}</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />
              {trip.travelers}
            </span>
            <span>
              {trip.variantCount} {trip.variantCount === 1 ? "plan" : "plans"}
            </span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            {trip.route.map((city, i) => (
              <span key={`${city}-${i}`} className="inline-flex items-center gap-1.5">
                {i > 0 && (
                  <ModeIcon mode={trip.legModes[i - 1]} className="size-4 text-muted-foreground" />
                )}
                <span className="font-medium">{city}</span>
              </span>
            ))}
          </div>

          {s && (
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Total ({trip.primaryVariantName})</dt>
                <dd className="font-semibold tabular-nums">{formatMoney(s.totalCents, "EUR", { decimals: false })}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Travel CO2</dt>
                <dd className="font-semibold tabular-nums">{formatCo2(s.co2Grams)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Budget</dt>
                <dd className="font-semibold tabular-nums">
                  {trip.budgetCents != null ? formatMoney(trip.budgetCents, "EUR", { decimals: false }) : "None"}
                </dd>
              </div>
            </dl>
          )}
        </CardContent>

        <CardFooter className="justify-between">
          {s && s.co2SavedGrams > 0 ? (
            <Badge className="gap-1 bg-eco-soft text-eco hover:bg-eco-soft">
              <Leaf className="size-3" />
              {formatCo2(s.co2SavedGrams)} less than flying
            </Badge>
          ) : (
            <span />
          )}
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground group-hover:text-foreground">
            Open board <ArrowRight className="size-4" />
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
