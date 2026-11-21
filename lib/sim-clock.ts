import { prisma } from "./db";

/** Where the demo's clock starts after a seed/reset. Fixed so the demo is reproducible. */
export const DEFAULT_SIM_START = new Date("2027-03-01T09:00:00.000Z");

/** The demo's "now". All time-dependent logic must use this, never Date.now(). */
export async function getSimNow(): Promise<Date> {
  const clock = await prisma.simClock.findUnique({ where: { id: 1 } });
  return clock?.now ?? DEFAULT_SIM_START;
}
