import bikeshareFixture from "@/data/fixtures/bikeshare.json";
import { hash01 } from "./pricing";

export interface BikeDock {
  operator: string;
  initials: string;
  bg: string;
  fg: string;
  location: string;
  walkMin: number;
  bikesAvailable: number;
}

/** Bike share near a station. Step 2 adds a GBFS-backed implementation. */
export interface BikeShareProvider {
  readonly name: string;
  docksNear(stationId: string, now: Date): Promise<BikeDock[]>;
}

interface FixtureDock extends Omit<BikeDock, "bikesAvailable"> {
  bikes: number;
}

const DOCKS = (bikeshareFixture as { stations: Record<string, FixtureDock[]> }).stations;

export class MockBikeShare implements BikeShareProvider {
  readonly name = "mock";

  async docksNear(stationId: string, now: Date): Promise<BikeDock[]> {
    const day = now.toISOString().slice(0, 10);
    return (DOCKS[stationId] ?? [])
      .map(({ bikes, ...dock }) => {
        // Deterministic ±40% swing per dock per sim day.
        const swing = (hash01(`${stationId}|${dock.location}|${day}`) - 0.5) * 0.8;
        return { ...dock, bikesAvailable: Math.max(0, Math.round(bikes * (1 + swing))) };
      })
      .sort((a, b) => a.walkMin - b.walkMin);
  }
}

let cached: BikeShareProvider | null = null;

export function getBikeShare(): BikeShareProvider {
  cached ??= new MockBikeShare();
  return cached;
}
