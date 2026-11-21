// Booking quote: what the traveler pays, what AllAboard keeps, and what each operator is owed.
// Pure functions (no Stripe, no DB) so the money math is unit-tested.

/** AllAboard's fee: €1.50 per leg per traveler, VAT included. */
export const BOOKING_FEE_CENTS = 150;

/**
 * Stripe Tax codes. Fares are passed through to the operators, whose VAT is already in the
 * fare, so they're marked nontaxable. The booking fee is AllAboard's own service to the
 * traveler ("General - Services"). Have a tax adviser confirm this before going live.
 */
export const FARE_TAX_CODE = "txcd_00000000"; // Nontaxable
export const BOOKING_FEE_TAX_CODE = "txcd_20030000"; // General - Services

export interface QuoteSegmentInput {
  operator: string;
  /** Per-traveler price of this segment at checkout time. */
  priceCents: number;
}

export interface QuoteLegInput {
  optionId: string;
  /** e.g. "Eurostar · Paris → Amsterdam" */
  title: string;
  /** e.g. "Thu 15 Apr · 10:13–13:32" */
  detail: string;
  operator: string;
  segments: QuoteSegmentInput[];
  /** Price the traveler last saw for this leg (per traveler), to flag changes. */
  shownPriceCents: number;
}

export interface QuoteItem {
  optionId: string;
  title: string;
  detail: string;
  operator: string;
  fareCents: number; // per traveler
  travelers: number;
  amountCents: number;
  /** Fare change since the traveler last saw it (0 if unchanged). */
  changeCents: number;
}

export interface Quote {
  currency: "EUR";
  travelers: number;
  items: QuoteItem[];
  faresCents: number;
  /** Number of fee units (legs × travelers) and the fee total. */
  feeUnits: number;
  feeCents: number;
  totalCents: number;
  /** Amount owed to each operator; sums to faresCents. */
  transfers: { operator: string; amountCents: number }[];
  priceChanged: boolean;
}

export function buildQuote(legs: QuoteLegInput[], travelers: number): Quote {
  if (!Number.isInteger(travelers) || travelers < 1) throw new Error("travelers must be a positive integer");
  if (legs.length === 0) throw new Error("nothing to book");

  const items: QuoteItem[] = legs.map((l) => {
    const fareCents = l.segments.reduce((sum, s) => sum + s.priceCents, 0);
    return {
      optionId: l.optionId,
      title: l.title,
      detail: l.detail,
      operator: l.operator,
      fareCents,
      travelers,
      amountCents: fareCents * travelers,
      changeCents: fareCents - l.shownPriceCents,
    };
  });

  const owed = new Map<string, number>();
  for (const l of legs) {
    for (const s of l.segments) owed.set(s.operator, (owed.get(s.operator) ?? 0) + s.priceCents * travelers);
  }

  const faresCents = items.reduce((sum, i) => sum + i.amountCents, 0);
  const feeUnits = legs.length * travelers;
  const feeCents = feeUnits * BOOKING_FEE_CENTS;
  return {
    currency: "EUR",
    travelers,
    items,
    faresCents,
    feeUnits,
    feeCents,
    totalCents: faresCents + feeCents,
    transfers: [...owed.entries()].map(([operator, amountCents]) => ({ operator, amountCents })).sort((a, b) => a.operator.localeCompare(b.operator)),
    priceChanged: items.some((i) => i.changeCents !== 0),
  };
}
