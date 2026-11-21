// Emission factors in grams of CO2 per passenger-km.
//
// PLACEHOLDER values: verify against EEA / ADEME before demo.
//
// - carshare assumes 3 occupants sharing one average car.
// - flight is used ONLY for the "flight you didn't take" counterfactual; we never sell flights.
export const CO2_FACTORS_G_PER_PKM = {
  TRAIN: 35,
  BUS: 30,
  CARSHARE: 55,
  BIKE: 0,
  CAR_SOLO: 170,
  FLIGHT: 200,
} as const;

/** Ground routes are longer than the straight line between two cities. */
export const GROUND_DETOUR_FACTOR = 1.2;
