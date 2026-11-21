import type { OptionDraft, Station } from "../types";

export interface JourneySearchParams {
  originId: string;
  destId: string;
  /** Travel date, "YYYY-MM-DD" (local calendar date). */
  date: string;
  travelers: number;
  /** Simulated "now" used for pricing. Callers pass SimClock.now; never Date.now(). */
  now: Date;
}

/**
 * Transport search. Step 1 ships MockProvider; Step 2 adds TransitousProvider behind the
 * same interface. Implementations must NEVER return flights.
 */
export interface TransportProvider {
  readonly name: string;
  searchStations(query: string): Promise<Station[]>;
  getStation(id: string): Promise<Station | null>;
  searchJourneys(params: JourneySearchParams): Promise<OptionDraft[]>;
  /**
   * Rebuild one journey from its `externalId`, priced at `now`. Used when saving a search
   * result, so the server never trusts prices sent back by the browser.
   */
  getJourney(externalId: string, now: Date, travelers?: number): Promise<OptionDraft | null>;
}
