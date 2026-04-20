import { describe, expect, it } from "bun:test";
import { runUpdateVesselPredictions } from "domain/vesselOrchestration/updateVesselPredictions";
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
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
  ...overrides,
});

describe("runUpdateVesselPredictions", () => {
  it("computes predictions from active trips using plain-data model preload", async () => {
    const trip = makeTrip();

    const output = await runUpdateVesselPredictions({
      activeTrips: [trip],
      completedHandoffs: [],
      predictionContext: {
        productionModelsByPair: {
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
        },
      },
    });

    expect(output.predictedTripComputations).toHaveLength(1);
    expect(output.vesselTripPredictions).toHaveLength(3);
    expect(
      output.predictedTripComputations[0]?.finalPredictedTrip?.AtDockDepartCurr
        ?.PredTime
    ).toBe(ms("2026-03-13T09:33:00-07:00"));
  });

  it("computes completed-handoff replacement predictions from the replacement trip", async () => {
    const trip = makeTrip();
    const completedTrip = makeTrip({
      LeftDockActual: ms("2026-03-13T09:31:00-07:00"),
      ArrivedNextActual: ms("2026-03-13T10:05:00-07:00"),
      TripEnd: ms("2026-03-13T10:05:00-07:00"),
    });

    const output = await runUpdateVesselPredictions({
      activeTrips: [],
      completedHandoffs: [
        {
          existingTrip: trip,
          tripToComplete: completedTrip,
          // CompletedTripBoundaryFact still requires this legacy shape, but
          // prediction runs now ignore it and operate on trip rows directly.
          events: {
            isFirstTrip: false,
            isTripStartReady: false,
            shouldStartTrip: false,
            isCompletedTrip: true,
            didJustArriveAtDock: true,
            didJustLeaveDock: false,
            scheduleKeyChanged: false,
          },
          newTripCore: {
            withFinalSchedule: trip,
          },
        },
      ],
      predictionContext: {
        productionModelsByPair: {
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
        },
      },
    });

    expect(output.predictedTripComputations).toHaveLength(1);
    expect(output.predictedTripComputations[0]?.branch).toBe("completed");
    expect(output.predictedTripComputations[0]?.completedTrip?.TripKey).toBe(
      completedTrip.TripKey
    );
    expect(output.predictedTripComputations[0]?.finalPredictedTrip).toBeDefined();
  });

  it("gracefully returns no predictions when the preload has no models", async () => {
    const trip = makeTrip();

    const output = await runUpdateVesselPredictions({
      activeTrips: [trip],
      completedHandoffs: [],
      predictionContext: {},
    });

    expect(output.vesselTripPredictions).toEqual([]);
    expect(output.predictedTripComputations[0]?.finalPredictedTrip).toEqual(
      trip
    );
  });
});
