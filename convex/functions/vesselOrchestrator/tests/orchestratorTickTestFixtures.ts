/**
 * Shared sample `ConvexVesselLocation` rows for orchestrator-related tests
 * (e.g. `processVesselTrips.tick.test.ts`).
 *
 * Trip-eligible filtering and prediction-fallback policy are covered in domain
 * tests (`isTripEligibleLocation`, `computeShouldRunPredictionFallback`), not
 * duplicated here.
 */

import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";

/**
 * Minimal `terminalsIdentity` rows so default fixtures (ANA → ORI) and golden-path
 * legs involving LOP stay trip-eligible under passenger-terminal gating.
 */
export const orchestratorTickTestTerminalIdentities: TerminalIdentity[] = [
  {
    TerminalID: 1,
    TerminalName: "Anacortes",
    TerminalAbbrev: "ANA",
    IsPassengerTerminal: true,
  },
  {
    TerminalID: 15,
    TerminalName: "Orcas Island",
    TerminalAbbrev: "ORI",
    IsPassengerTerminal: true,
  },
  {
    TerminalID: 22,
    TerminalName: "Lopez Island",
    TerminalAbbrev: "LOP",
    IsPassengerTerminal: true,
  },
];

/**
 * Default CHE / ANA–ORI passenger-terminal fixture; optional overrides for
 * branch-isolation scenarios.
 *
 * @param overrides - Partial fields merged over the base fixture
 * @returns A `ConvexVesselLocation` suitable for tick tests
 */
export const makeOrchestratorTickTestLocation = (
  overrides: Partial<ConvexVesselLocation> = {}
): ConvexVesselLocation => ({
  VesselID: 2,
  VesselName: "Chelan",
  VesselAbbrev: "CHE",
  DepartingTerminalID: 1,
  DepartingTerminalName: "Anacortes",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalID: 15,
  ArrivingTerminalName: "Orcas Island",
  ArrivingTerminalAbbrev: "ORI",
  Latitude: 48,
  Longitude: -122,
  Speed: 0,
  Heading: 0,
  InService: true,
  AtDock: true,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: undefined,
  RouteAbbrev: "ana-sj",
  VesselPositionNum: 1,
  TimeStamp: new Date("2026-03-13T03:08:47-07:00").getTime(),
  ScheduleKey: undefined,
  DepartingDistance: 0,
  ArrivingDistance: undefined,
  ...overrides,
});
