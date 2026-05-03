import { describe, expect, it, mock, spyOn } from "bun:test";
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
  it("computes an enriched active trip from active trips", async () => {
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

    expect(output.enrichedActiveVesselTrip.AtDockDepartCurr?.PredTime).toBe(
      ms("2026-03-13T09:33:00-07:00")
    );
  });

  it("computes replacement predictions from the replacement trip", async () => {
    const trip = makeTrip();
    const completedTrip = makeTrip({
      LeftDockActual: ms("2026-03-13T09:31:00-07:00"),
      TripEnd: ms("2026-03-13T10:05:00-07:00"),
    });
    const replacementTrip = makeTrip({
      TripKey: generateTripKey("CHE", ms("2026-03-13T10:06:00-07:00")),
      ScheduleKey: "CHE--2026-03-13--10:10--ORI-LOP",
      ScheduledDeparture: ms("2026-03-13T10:10:00-07:00"),
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

    expect(output.enrichedActiveVesselTrip.TripKey).toBe(
      replacementTrip.TripKey
    );
    expect(output.enrichedActiveVesselTrip.AtDockDepartCurr?.PredTime).toBe(
      ms("2026-03-13T10:13:00-07:00")
    );
  });

  it("returns the original trip when prediction model parameters are empty", async () => {
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

    expect(output.enrichedActiveVesselTrip).toEqual(trip);
  });

  it("continues with the original trip when model loading fails", async () => {
    const trip = makeTrip();
    const consoleErrorSpy = spyOn(console, "error").mockImplementation(
      () => {}
    );

    const output = await getVesselTripPredictionsFromTripUpdate(
      {
        vesselAbbrev: trip.VesselAbbrev,
        existingVesselTrip: undefined,
        activeVesselTrip: trip,
        completedVesselTrip: undefined,
      },
      {
        loadPredictionModelParameters: mock(async () => {
          throw new Error("temporary model query failure");
        }),
      }
    );

    expect(output.enrichedActiveVesselTrip).toEqual(trip);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    mock.restore();
  });
});
