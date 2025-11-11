import { toNormalizedMinutes } from "../shared";
import type {
  FeatureVector,
  TrainingExample,
  TripPair,
  ValidatedTrip,
} from "../types";

// ============================================================================
// MAIN ENCODING FUNCTION
// ============================================================================

const logPairInfo = (pair: TripPair) => {
  const { prevTrip, currTrip } = pair;
  console.log(
    `${prevTrip.VesselName} ${prevTrip.LeftDock.toDateString()} -------------------------------`
  );
  // logTrip(prevTrip);
  // logTrip(currTrip);
  console.log(
    `timeAnalysis: ${(toNormalizedMinutes(currTrip.LeftDock) - toNormalizedMinutes(currTrip.ArvDockActual)).toFixed(1)}`
  );
};

const padTimeString = (date: Date | undefined) =>
  (date?.toLocaleTimeString() || "").padStart(12);

const debugLogTrip = (trip: ValidatedTrip) =>
  `  ${trip.ArrivingTerminalAbbrev} -> ${trip.DepartingTerminalAbbrev}, Sched: ${padTimeString(trip.ScheduledDeparture)} -> Left: ${padTimeString(trip.LeftDock)} -> ETA: ${padTimeString(trip.Eta)} -> Arv: ${padTimeString(trip.ArvDockActual)}`;

/**
 * Converts trip pairs to feature vectors and training examples
 */
export const encodeFeatures = (pairs: TripPair[]): TrainingExample[] => {
  const result = pairs.reduce((acc: TrainingExample[], pair) => {
    if (
      pair.prevTrip.DepartingTerminalAbbrev !==
      pair.currTrip.ArrivingTerminalAbbrev
    ) {
      throw new Error(
        `Mismatched terminals: ${pair.prevTrip.ArrivingTerminalAbbrev} !== ${pair.currTrip.DepartingTerminalAbbrev} \n ${debugLogTrip(pair.prevTrip)} \n ${debugLogTrip(pair.currTrip)}`
      );
    }

    const input = extractFeatures(pair);
    // Target: dwell time at terminal (minutes) between previous arrival and current departure
    const target =
      toNormalizedMinutes(pair.currTrip.LeftDock) -
      toNormalizedMinutes(pair.prevTrip.Eta);

    acc.push({
      input,
      target,
    });
    return acc;
  }, [] as TrainingExample[]);

  return result;
};

/**
 * Extracts features from a trip pair
 */
const extractFeatures = (pair: TripPair): FeatureVector => {
  const { prevTrip: prev, currTrip: curr } = pair;

  const currHour = toHourOfDay(curr.ScheduledDeparture);
  const currDay = toDayOfWeek(curr.ScheduledDeparture);

  return {
    // Hour and day features
    ...createHourFeatures(currHour),
    ...createDayFeatures(currDay),

    // Terminal features
    ...createTerminalFeatures(curr.DepartingTerminalAbbrev),
    ...createTerminalFeatures(curr.ArrivingTerminalAbbrev),

    // Timestamp features (normalized)
    "timestamp.prevArvTimeActual": toNormalizedMinutes(prev.ArvDockActual),
    "timestamp.prevDepTimeSched": toNormalizedMinutes(prev.ScheduledDeparture),
    "timestamp.prevDepTime": toNormalizedMinutes(prev.LeftDock),
    "timestamp.currArvTimeActual": toNormalizedMinutes(curr.ArvDockActual),
    "timestamp.currDepTimeSched": toNormalizedMinutes(curr.ScheduledDeparture),
  };
};

// ============================================================================
// FEATURE EXTRACTION UTILITIES
// ============================================================================

// Create a vector set to zeros for all terminals
const ALL_TERMINALS = {
  ANA: 0, // Anacortes
  BBI: 0, // Bainbridge Island
  BRE: 0, // Bremerton
  CLI: 0, // Clinton
  COU: 0, // Coupeville
  EDM: 0, // Edmonds
  FAU: 0, // Fauntleroy
  FRH: 0, // Friday Harbor
  KIN: 0, // Kingston
  LOP: 0, // Lopez Island
  MUK: 0, // Mukilteo
  ORI: 0, // Orcas Island
  P52: 0, // Seattle
  POT: 0, // Port Townsend
  PTD: 0, // Point Defiance
  SHI: 0, // Shaw Island
  SID: 0, // Sidney B.C.
  SOU: 0, // Southworth
  TAH: 0, // Tahlequah
  VAI: 0, // Vashon Island
} as const;

const toHourOfDay = (date: Date): number => date.getHours();
const toDayOfWeek = (date: Date): number => date.getDay();

const createHourFeatures = (hour: number): Record<string, number> =>
  Object.fromEntries(
    Array.from({ length: 24 }, (_, i) => [
      `hourOfDay.$i.toString().padStart(2, "0")`,
      i === hour ? 1 : 0,
    ])
  );

const createDayFeatures = (day: number): Record<string, number> => ({
  "dayType.isWeekday": day >= 1 && day <= 5 ? 1 : 0,
  "dayType.isWeekend": day === 0 || day === 6 ? 1 : 0,
});

const createTerminalFeatures = (
  terminalAbrv: string
): Record<string, number> => {
  if (!(terminalAbrv in ALL_TERMINALS)) {
    throw new Error(`Invalid terminal abbreviation: $terminalAbrv`);
  }
  return {
    ...ALL_TERMINALS,
    [terminalAbrv]: 1,
  };
};
