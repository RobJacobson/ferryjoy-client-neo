import { describe, expect, it, mock } from "bun:test";
import { getVesselTripPredictionsFromTripUpdate } from "domain/vesselOrchestration/updateVesselPredictions";
import type { ConvexVesselTripWithPredictions } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";

const ms = (iso: string) => new Date(iso).getTime();

const makeTrip = (
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
  TripStart: ms("2026-03-13T09:00:00-07:00"),
  TripEnd: undefined,
  AtDock: true,
  AtDockDuration: 10,
  ScheduledDeparture: ms("2026-03-13T09:30:00-07:00"),
  LeftDock: undefined,
  LeftDockActual: undefined,
  TripDelay: 4,
  Eta: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T09:10:00-07:00"),
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

const predictionModelParametersByPairKey = {
  "ORI->LOP": {
    "at-dock-depart-curr": {
      featureKeys: [],
      coefficients: [],
      intercept: 3,
      testMetrics: { mae: 1, stdDev: 1 },
    },
    "at-dock-arrive-next": {
      featureKeys: [],
      coefficients: [],
      intercept: 20,
      testMetrics: { mae: 1, stdDev: 1 },
    },
    "at-dock-depart-next": {
      featureKeys: [],
      coefficients: [],
      intercept: 45,
      testMetrics: { mae: 1, stdDev: 1 },
    },
  },
};

const depsWithModels = {
  loadPredictionModelParameters: mock(async () =>
    Promise.resolve(predictionModelParametersByPairKey)
  ),
};

const depsEmptyModels = {
  loadPredictionModelParameters: mock(async () => Promise.resolve({})),
};

describe("getVesselTripPredictionsFromTripUpdate", () => {
  it("computes prediction rows and timeline handoffs from active trips", async () => {
    const trip = makeTrip();

    const output = await getVesselTripPredictionsFromTripUpdate(
      {
        vesselAbbrev: trip.VesselAbbrev,
        existingVesselTrip: undefined,
        activeVesselTrip: trip,
        completedVesselTrip: undefined,
      },
      depsWithModels
    );

    expect(output.predictedTripTimelineHandoffs).toHaveLength(1);
    expect(output.predictionRows).toHaveLength(3);
    expect(
      output.predictedTripTimelineHandoffs[0]?.finalPredictedTrip
        ?.AtDockDepartCurr?.PredTime
    ).toBe(ms("2026-03-13T09:33:00-07:00"));
  });

  it("computes completed-handoff replacement predictions from the replacement trip", async () => {
    const trip = makeTrip();
    const completedTrip = makeTrip({
      LeftDockActual: ms("2026-03-13T09:31:00-07:00"),
      TripEnd: ms("2026-03-13T10:05:00-07:00"),
    });
    const replacementTrip = makeTrip({
      TripKey: generateTripKey("CHE", ms("2026-03-13T10:06:00-07:00")),
      ScheduleKey: "CHE--2026-03-13--10:10--ORI-LOP",
      AtDock: true,
      LeftDockActual: undefined,
    });

    const output = await getVesselTripPredictionsFromTripUpdate(
      {
        vesselAbbrev: trip.VesselAbbrev,
        existingVesselTrip: trip,
        activeVesselTrip: replacementTrip,
        completedVesselTrip: completedTrip,
      },
      depsWithModels
    );

    expect(output.predictedTripTimelineHandoffs).toHaveLength(2);
    expect(output.predictionRows).toHaveLength(3);
    const completedHandoff = output.predictedTripTimelineHandoffs.find(
      (entry) => entry.branch === "completed"
    );
    const currentHandoff = output.predictedTripTimelineHandoffs.find(
      (entry) => entry.branch === "current"
    );
    expect(completedHandoff?.completedHandoffKey).toBe(
      `${completedTrip.VesselAbbrev}::${completedTrip.ScheduleKey}`
    );
    expect(completedHandoff?.finalPredictedTrip).toBeDefined();
    expect(currentHandoff?.finalPredictedTrip).toBeDefined();
    expect(completedHandoff?.finalPredictedTrip).toBe(
      currentHandoff?.finalPredictedTrip
    );
  });

  it("returns no prediction rows when prediction model parameters are empty", async () => {
    const trip = makeTrip();

    const output = await getVesselTripPredictionsFromTripUpdate(
      {
        vesselAbbrev: trip.VesselAbbrev,
        existingVesselTrip: undefined,
        activeVesselTrip: trip,
        completedVesselTrip: undefined,
      },
      depsEmptyModels
    );

    expect(output.predictionRows).toEqual([]);
    expect(output.predictedTripTimelineHandoffs[0]?.finalPredictedTrip).toEqual(
      trip
    );
  });
});
