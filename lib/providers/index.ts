import { MockProvider } from "./mock";
import type { TransportProvider } from "./types";

export type { JourneySearchParams, TransportProvider } from "./types";

let cached: TransportProvider | null = null;

/** Provider factory. `PROVIDER=mock` (default). Step 2 adds `transitous`. */
export function getProvider(): TransportProvider {
  if (cached) return cached;
  const name = process.env.PROVIDER ?? "mock";
  switch (name) {
    case "mock":
      cached = new MockProvider();
      break;
    default:
      throw new Error(`Unknown PROVIDER "${name}". Available: mock`);
  }
  return cached;
}
