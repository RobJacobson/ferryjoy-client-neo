import { describe, expect, it } from "bun:test";
import { runUpdateVesselPredictions } from "domain/vesselOrchestration/updateVesselPredictions";
import type { TripEvents } from "domain/vesselOrchestration/updateVesselTrips";
import type { ConvexVesselTripWithPredictions } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";

const ms = (iso: string) => new Date(iso).getTime();

const defaultEvents: TripEvents = {
  isFirstTrip: false,
  isTripStartReady: false,
  shouldStartTrip: false,
  isCompletedTrip: false,
  didJustArriveAtDock: false,
  didJustLeaveDock: false,
  scheduleKeyChanged: false,
};

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
  it("computes predictions from tripComputations using plain-data model preload", async () => {
    const trip = makeTrip();

    const output = await runUpdateVesselPredictions({
      tickStartedAt: ms("2026-03-13T09:10:00-07:00"),
      tripComputations: [
        {
          vesselAbbrev: trip.VesselAbbrev,
          branch: "current",
          events: defaultEvents,
          existingTrip: undefined,
          activeTrip: trip,
          tripCore: {
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
    expect(output.vesselTripPredictions).toHaveLength(3);
    expect(
      output.predictedTripComputations[0]?.finalPredictedTrip?.AtDockDepartCurr
        ?.PredTime
    ).toBe(ms("2026-03-13T09:33:00-07:00"));
  });

  it("derives gates from tripCore.withFinalSchedule when Stage C omits ML gate fields", async () => {
    const trip = makeTrip();

    const output = await runUpdateVesselPredictions({
      tickStartedAt: trip.TimeStamp,
      tripComputations: [
        {
          vesselAbbrev: trip.VesselAbbrev,
          branch: "current",
          events: defaultEvents,
          existingTrip: undefined,
          activeTrip: trip,
          tripCore: {
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
    expect(
      output.predictedTripComputations[0]?.finalPredictedTrip
    ).toBeDefined();
  });

  it("gracefully returns no predictions when the preload has no models", async () => {
    const trip = makeTrip();

    const output = await runUpdateVesselPredictions({
      tickStartedAt: trip.TimeStamp,
      tripComputations: [
        {
          vesselAbbrev: trip.VesselAbbrev,
          branch: "current",
          events: undefined,
          existingTrip: undefined,
          activeTrip: trip,
          tripCore: {
            withFinalSchedule: trip,
          },
        },
      ],
      predictionContext: {},
    });

    expect(output.vesselTripPredictions).toEqual([]);
    expect(output.predictedTripComputations[0]?.finalPredictedTrip).toEqual(
      trip
    );
  });
});
