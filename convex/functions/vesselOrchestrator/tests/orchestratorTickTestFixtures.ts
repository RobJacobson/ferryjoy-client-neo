/**
 * Shared sample `ConvexVesselLocation` rows for orchestrator tick tests
 * (`executeVesselOrchestratorTick.integration.test.ts`,
 * `executeVesselOrchestratorTick.behavior.test.ts`).
 *
 * Trip-eligible filtering and prediction-fallback policy are covered in domain
 * tests (`isTripEligibleLocation`, `computeShouldRunPredictionFallback`), not
 * duplicated here.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";

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
