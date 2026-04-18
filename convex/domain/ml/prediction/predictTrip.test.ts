import { describe, expect, it } from "bun:test";
import type { ConvexVesselTripWithML } from "../../../functions/vesselTrips/schemas";
import type { ModelType } from "../shared/types";
import { predictArriveEta, predictEtaOnDeparture } from "./predictTrip";
import type {
  ProductionModelParameters,
  VesselTripPredictionModelAccess,
} from "./vesselTripPredictionModelAccess";

const ms = (iso: string) => new Date(iso).getTime();

/**
 * Test double for orchestrator model access (returns a fixed doc for all loads).
 *
 * @param modelDoc - Parameters returned for production pair loads
 * @returns Port wired for {@link predictEtaOnDeparture} / {@link predictArriveEta} tests
 */
const makeModelAccess = (
  modelDoc: ProductionModelParameters
): VesselTripPredictionModelAccess => ({
  loadModelForProductionPair: async () => modelDoc,
  loadModelsForProductionPairBatch: async (_pairKey, modelTypes) =>
    Object.fromEntries(modelTypes.map((t) => [t, modelDoc])) as Record<
      ModelType,
      ProductionModelParameters | null
    >,
});

const makeTrip = (
  overrides: Partial<ConvexVesselTripWithML> = {}
): ConvexVesselTripWithML => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "SOU",
  ArrivingTerminalAbbrev: "VAI",
  RouteAbbrev: "f-v-s",
  TripKey: "CHE--2026-03-13--05:30--SOU-VAI",
  ScheduleKey: "CHE--2026-03-13--05:30--SOU-VAI",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "FAU",
  ArrivedCurrActual: ms("2026-03-13T09:30:00-07:00"),
  ArrivedNextActual: undefined,
  StartTime: ms("2026-03-13T09:00:00-07:00"),
  EndTime: undefined,
  ArriveDest: undefined,
  AtDockActual: undefined,
  TripStart: ms("2026-03-13T09:00:00-07:00"),
  AtDock: true,
  AtDockDuration: undefined,
  ScheduledDeparture: ms("2026-03-13T10:00:00-07:00"),
  LeftDock: undefined,
  LeftDockActual: undefined,
  TripDelay: undefined,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T09:00:00-07:00"),
  PrevScheduledDeparture: ms("2026-03-13T08:00:00-07:00"),
  PrevLeftDock: ms("2026-03-13T07:20:00-07:00"),
  NextScheduleKey: "CHE--2026-03-13--07:00--VAI-ORI",
  NextScheduledDeparture: ms("2026-03-13T11:15:00-07:00"),
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
  ...overrides,
});

describe("predictEtaOnDeparture", () => {
  it("uses canonical origin-arrival actuals instead of TripStart aliases", async () => {
    const trip = makeTrip({
      ArrivedCurrActual: ms("2026-03-13T09:30:00-07:00"),
      TripStart: ms("2026-03-13T09:50:00-07:00"),
      LeftDock: ms("2026-03-13T09:55:00-07:00"),
    });
    const access = makeModelAccess({
      featureKeys: ["slackBeforeCurrScheduledDepartMinutes"],
      coefficients: [1],
      intercept: 0,
      testMetrics: { mae: 0, stdDev: 0 },
    });

    const result = await predictEtaOnDeparture(access, trip);

    expect(result.predictedTime).toBe(ms("2026-03-13T10:30:00-07:00"));
  });
});

describe("predictArriveEta", () => {
  it("uses canonical departure actuals instead of raw LeftDock aliases", async () => {
    const trip = makeTrip({
      ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
      ArrivedNextActual: ms("2026-03-13T05:50:00-07:00"),
      LeftDockActual: ms("2026-03-13T05:40:00-07:00"),
      LeftDock: ms("2026-03-13T05:50:00-07:00"),
      TripStart: ms("2026-03-13T05:55:00-07:00"),
    });
    const access = makeModelAccess({
      featureKeys: ["currTripDelayMinutes"],
      coefficients: [1],
      intercept: 0,
      testMetrics: { mae: 0, stdDev: 0 },
    });

    const result = await predictArriveEta(access, trip);

    expect(result.predictedTime).toBe(ms("2026-03-13T05:50:00-07:00"));
  });
});
