import { describe, expect, it } from "bun:test";
import type { PredictedTripComputation } from "domain/vesselOrchestration/shared";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselLocationUpdates } from "functions/vesselOrchestrator/schemas";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import { buildOrchestratorPersistenceBundle } from "../testing";

const ms = (iso: string) => new Date(iso).getTime();

const makeTrip = (
  vesselAbbrev: string,
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: vesselAbbrev,
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalAbbrev: "ORI",
  RouteAbbrev: "ana-sj",
  TripKey: generateTripKey(vesselAbbrev, ms("2026-03-13T04:33:00-07:00")),
  ScheduleKey: `${vesselAbbrev}--2026-03-13--05:30--ANA-ORI`,
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "ORI",
  ArriveDest: undefined,
  TripStart: ms("2026-03-13T04:33:00-07:00"),
  AtDock: false,
  AtDockDuration: undefined,
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  LeftDock: ms("2026-03-13T05:29:38-07:00"),
  TripDelay: undefined,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T06:28:45-07:00"),
  PrevScheduledDeparture: ms("2026-03-12T19:30:00-07:00"),
  PrevLeftDock: ms("2026-03-12T19:34:26-07:00"),
  NextScheduleKey: undefined,
  NextScheduledDeparture: undefined,
  EndTime: undefined,
  StartTime: ms("2026-03-13T04:33:00-07:00"),
  AtDockActual: ms("2026-03-13T04:33:00-07:00"),
  ...overrides,
});

const makeLocation = (
  vesselAbbrev: string,
  overrides: Partial<ConvexVesselLocation> = {}
): ConvexVesselLocation => ({
  VesselID: 1,
  VesselAbbrev: vesselAbbrev,
  VesselName: vesselAbbrev,
  DepartingTerminalID: 10,
  Speed: 15,
  Heading: 90,
  Latitude: 47.0,
  Longitude: -122.0,
  DepartingTerminalName: "Anacortes",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalID: 20,
  ArrivingTerminalName: "Orcas",
  ArrivingTerminalAbbrev: "ORI",
  AtDock: false,
  LeftDock: ms("2026-03-13T05:29:38-07:00"),
  Eta: undefined,
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  VesselPositionNum: 1,
  InService: true,
  TimeStamp: ms("2026-03-13T06:28:45-07:00"),
  RouteAbbrev: "ana-sj",
  ...overrides,
});

const makePredictionRow = (
  vesselAbbrev: string,
  overrides: Partial<VesselTripPredictionProposal> = {}
): VesselTripPredictionProposal => ({
  VesselAbbrev: vesselAbbrev,
  TripKey: generateTripKey(vesselAbbrev, ms("2026-03-13T04:33:00-07:00")),
  PredictionType: "AtSeaArriveNext",
  prediction: {
    PredTime: ms("2026-03-13T06:55:00-07:00"),
    MinTime: ms("2026-03-13T06:50:00-07:00"),
    MaxTime: ms("2026-03-13T07:00:00-07:00"),
    MAE: 60_000,
    StdDev: 30_000,
    Actual: undefined,
    DeltaTotal: undefined,
    DeltaRange: undefined,
  },
  ...overrides,
});

const makePredictedTripComputation = (
  vesselAbbrev: string,
  overrides: Partial<PredictedTripComputation> = {}
): PredictedTripComputation => ({
  vesselAbbrev,
  branch: "current",
  activeTrip: makeTrip(vesselAbbrev),
  finalPredictedTrip: undefined,
  ...overrides,
});

describe("buildOrchestratorPersistenceBundle", () => {
  it("merges stage outputs into the compact mutation payload", () => {
    const changedLocationUpdate: VesselLocationUpdates = {
      vesselLocation: makeLocation("CHE", {
        TimeStamp: ms("2026-03-13T06:35:00-07:00"),
      }),
      locationChanged: true,
    };
    const cheTrip = makeTrip("CHE", {
      TimeStamp: ms("2026-03-13T06:35:00-07:00"),
    });
    const cheCompleted = makeTrip("CHE", {
      TripEnd: ms("2026-03-13T06:40:00-07:00"),
    });
    const bundle = buildOrchestratorPersistenceBundle({
      pingStartedAt: ms("2026-03-13T06:35:00-07:00"),
      changedLocations: [
        {
          vesselLocation: changedLocationUpdate.vesselLocation,
          existingLocationId: changedLocationUpdate.existingLocationId,
        },
      ],
      existingActiveTrips: [makeTrip("CHE"), makeTrip("TAC")],
      tripRows: {
        activeTrips: [cheTrip, makeTrip("TAC")],
        completedTrips: [cheCompleted],
      },
      predictionRows: [makePredictionRow("CHE")],
      predictedTripComputations: [makePredictedTripComputation("CHE")],
    });

    expect(
      bundle.changedLocations.map((row) => row.vesselLocation.VesselAbbrev)
    ).toEqual(["CHE"]);
    expect(
      bundle.tripRows.completedTrips.map((row) => row.VesselAbbrev)
    ).toEqual(["CHE"]);
    expect(bundle.tripRows.activeTrips.map((row) => row.VesselAbbrev)).toEqual([
      "CHE",
      "TAC",
    ]);
    expect(bundle.predictionRows.map((row) => row.VesselAbbrev)).toEqual([
      "CHE",
    ]);
    expect(
      bundle.predictedTripComputations.map((row) => row.vesselAbbrev)
    ).toEqual(["CHE"]);
    expect(bundle.existingActiveTrips.map((row) => row.VesselAbbrev)).toEqual([
      "CHE",
      "TAC",
    ]);
  });
});
