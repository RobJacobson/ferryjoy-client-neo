/**
 * Focused tests for {@link applyVesselPredictions} orchestration (ML tail).
 * Model access is intentionally inert in these cases so we can pin the
 * phase-selection and leave-dock actualization behavior without depending on
 * ML internals.
 */

import { describe, expect, it } from "bun:test";
import type { VesselTripPredictionModelAccess } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type { ModelType } from "domain/ml/shared/types";
import { applyVesselPredictions } from "domain/vesselOrchestration/updateVesselPredictions/applyVesselPredictions";
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

const minimalTrip = (
  overrides: Partial<ConvexVesselTripWithPredictions> = {}
): ConvexVesselTripWithPredictions => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "ORI",
  ArrivingTerminalAbbrev: "LOP",
  RouteAbbrev: "ana-sj",
  TripKey: generateTripKey("CHE", ms("2026-03-13T09:00:00-07:00")),
  ScheduleKey: "CHE--2026-03-13--09:30--ORI-LOP",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "SHI",
  TripEnd: undefined,
  TripStart: ms("2026-03-13T09:00:00-07:00"),
  AtDock: false,
  AtDockDuration: 10,
  ScheduledDeparture: ms("2026-03-13T09:30:00-07:00"),
  LeftDock: ms("2026-03-13T09:34:00-07:00"),
  LeftDockActual: ms("2026-03-13T09:34:00-07:00"),
  TripDelay: 4,
  Eta: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T09:39:00-07:00"),
  PrevScheduledDeparture: ms("2026-03-13T08:10:00-07:00"),
  PrevLeftDock: ms("2026-03-13T08:12:00-07:00"),
  NextScheduleKey: "CHE--2026-03-13--10:15--LOP-ANA",
  NextScheduledDeparture: ms("2026-03-13T10:15:00-07:00"),
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
  ...overrides,
});

/** Unused when the trip is not prediction-ready for the current phase. */
const noopModelAccess: VesselTripPredictionModelAccess = {
  loadModelForProductionPair: async () => null,
  loadModelsForProductionPairBatch: async () =>
    ({}) as Record<
      ModelType,
      | import("domain/ml/prediction/vesselTripPredictionModelAccess").ProductionModelParameters
      | null
    >,
};

describe("applyVesselPredictions", () => {
  const table: Array<{
    name: string;
    trip: ConvexVesselTripWithPredictions;
    expectSameRef: boolean;
  }> = [
    {
      name: "returns the original trip when no prediction phase applies",
      trip: minimalTrip(),
      expectSameRef: true,
    },
    {
      name: "leave-dock actualize is a no-op when no departure prediction exists",
      trip: minimalTrip(),
      expectSameRef: true,
    },
  ];

  for (const row of table) {
    it(row.name, async () => {
      const out = await applyVesselPredictions(noopModelAccess, row.trip);
      if (row.expectSameRef) {
        expect(out).toBe(row.trip);
      }
    });
  }

  it("leave-dock actualize applies departure actual after phase-based prediction work", async () => {
    const departPred = makePrediction(ms("2026-03-13T09:36:00-07:00"));
    const trip = minimalTrip({
      AtDockDepartCurr: departPred,
    });
    const out = await applyVesselPredictions(noopModelAccess, trip);
    expect(out).not.toBe(trip);
    expect(out.AtDockDepartCurr).toBeDefined();
    expect(out.AtDockDepartCurr?.Actual).toBe(trip.LeftDockActual);
  });
});
