/**
 * {@link appendArriveDockPredictions} re-runs phase-valid models on every tick.
 */

import { describe, expect, it } from "bun:test";
import type {
  ProductionModelParameters,
  VesselTripPredictionModelAccess,
} from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type { ModelType } from "domain/ml/shared/types";
import { appendArriveDockPredictions } from "domain/vesselOrchestration/updateVesselPredictions/appendPredictions";
import type { ConvexVesselTripWithPredictions } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";

const ms = (iso: string) => new Date(iso).getTime();

const makePrediction = (PredTime: number) => ({
  PredTime,
  MinTime: PredTime - 60_000,
  MaxTime: PredTime + 60_000,
  MAE: 1,
  StdDev: 1,
  Actual: undefined,
  DeltaTotal: undefined,
  DeltaRange: undefined,
});

const stubModel: ProductionModelParameters = {
  featureKeys: [],
  coefficients: [],
  intercept: 0,
  testMetrics: { mae: 1, stdDev: 1 },
};

const makeAtDockTrip = (): ConvexVesselTripWithPredictions => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "ORI",
  ArrivingTerminalAbbrev: "LOP",
  RouteAbbrev: "ana-sj",
  TripKey: generateTripKey("CHE", ms("2026-03-13T09:00:00-07:00")),
  ScheduleKey: "CHE--2026-03-13--09:30--ORI-LOP",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "SHI",
  ArrivedCurrActual: ms("2026-03-13T09:00:00-07:00"),
  ArriveDest: undefined,
  AtDockActual: ms("2026-03-13T09:00:00-07:00"),
  TripStart: ms("2026-03-13T09:00:00-07:00"),
  AtDock: true,
  AtDockDuration: 10,
  ScheduledDeparture: ms("2026-03-13T09:30:00-07:00"),
  LeftDock: undefined,
  LeftDockActual: undefined,
  TripDelay: 4,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T09:10:00-07:00"),
  PrevScheduledDeparture: ms("2026-03-13T08:10:00-07:00"),
  PrevLeftDock: ms("2026-03-13T08:12:00-07:00"),
  NextScheduleKey: "CHE--2026-03-13--10:15--LOP-ANA",
  NextScheduledDeparture: ms("2026-03-13T10:15:00-07:00"),
  AtDockDepartCurr: makePrediction(ms("2026-03-13T09:33:00-07:00")),
  AtDockArriveNext: makePrediction(ms("2026-03-13T10:05:00-07:00")),
  AtDockDepartNext: makePrediction(ms("2026-03-13T10:22:00-07:00")),
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
});

describe("appendArriveDockPredictions", () => {
  it("re-runs at-dock specs when slots already hold full predictions (batch load once)", async () => {
    let batchCalls = 0;
    const modelAccess: VesselTripPredictionModelAccess = {
      loadModelForProductionPair: async () => stubModel,
      loadModelsForProductionPairBatch: async (_pairKey, modelTypes) => {
        batchCalls++;
        return Object.fromEntries(
          modelTypes.map((t) => [t, stubModel])
        ) as Record<ModelType, ProductionModelParameters | null>;
      },
    };

    const trip = makeAtDockTrip();
    await appendArriveDockPredictions(modelAccess, trip);

    expect(batchCalls).toBe(1);
  });
});
