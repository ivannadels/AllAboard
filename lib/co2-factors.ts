// Emission factors, in grams of CO2-equivalent (CO2e). "Well-to-wheel": direct emissions
// plus upstream fuel/electricity production (well-to-tank), the scope ISO 14083 asks for.
// Vehicle manufacturing and infrastructure are excluded (as in DESNZ and ISO 14083).
//
// Sources (retrieved Nov 2026):
//  - DESNZ: UK Government GHG Conversion Factors for Company Reporting 2026, flat format
//    (revised). https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026
//  - Ember: yearly electricity data, release of 17 Nov 2026, "Emissions intensity
//    (gCO2e/kWh)", 2025 values. https://ember-energy.org/data/yearly-electricity-data/
//  - Rail energy use: Green Train programme (46–62 Wh per passenger-km for high-speed trains,
//    grid electricity) and KTH (≈80 Wh per passenger-km for long-distance trains, 55–60% load).
//    https://www.kth.se/polopoly_fs/1.179879.1600688474!/Menu/general/column-content/attachment/Energy_060925_full_pdf.pdf

/** DESNZ 2026, kg → g. Each is direct + well-to-tank. */
export const DESNZ_2026 = {
  /** Coach, per passenger-km: 0.03948 + WTT 0.00656. */
  coachPerPkm: 39.48 + 6.56,
  /** Average car (unknown fuel), per vehicle-km: 0.16591 + WTT 0.04399. Includes DESNZ's real-world driving uplift. */
  carPerVkm: 165.91 + 43.99,
  /** Short-haul flight (to/from UK, < 3,700 km), economy, per passenger-km, WITH radiative forcing: 0.12576 + WTT 0.02249. */
  shortHaulFlightPerPkm: 125.76 + 22.49,
  /** Same flight, CO2e without the non-CO2 effects (radiative forcing): 0.07435 + WTT 0.02249. */
  shortHaulFlightPerPkmNoRF: 74.35 + 22.49,
  /** International rail (Eurostar), per passenger-km: 0.01135 + WTT 0.00117. Used only as a sanity reference in tests. */
  internationalRailPerPkm: 11.35 + 1.17,
} as const;

/** DESNZ: flights are ~8% longer than the great circle (routing, holding, delays). */
export const FLIGHT_DISTANCE_UPLIFT = 1.08;

/** Ember 2025 grid carbon intensity, gCO2e per kWh, by ISO country code. */
export const GRID_G_PER_KWH: Record<string, number> = {
  AT: 116.6,
  BE: 151.3,
  CH: 39.0,
  DE: 334.1,
  ES: 154.1,
  FR: 41.2,
  GB: 218.0,
  IT: 284.9,
  LU: 111.2,
  NL: 253.6,
};

/** Ember 2025 EU average, for countries not listed above. */
export const GRID_EU_AVERAGE_G_PER_KWH = 210.9;

/** Electricity drawn from the grid per passenger-km. */
export const RAIL_KWH_PER_PKM = {
  /** Green Train range 46–62 Wh/pkm → midpoint. */
  highSpeed: 0.054,
  /** KTH long-distance figure. */
  intercity: 0.08,
} as const;

/** Trains averaging at least this speed (stops included) are treated as high-speed. */
export const HIGH_SPEED_MIN_AVG_KMH = 125;

/**
 * Car share occupancy: the driver plus your group, and at least this many people in total.
 * An assumption (we don't know the other riders); DESNZ's 1.5 average is for all car trips,
 * which understates shared long-distance rides.
 */
export const CARSHARE_MIN_OCCUPANTS = 3;

/** Ground routes are longer than the straight line between two cities. */
export const GROUND_DETOUR_FACTOR = 1.2;
