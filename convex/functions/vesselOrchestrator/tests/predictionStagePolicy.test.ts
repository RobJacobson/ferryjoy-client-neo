import { describe, expect, it } from "bun:test";
import type { CompletedTripBoundaryFact } from "domain/vesselOrchestration/shared";
import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrips";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import { buildPredictionStageInputs } from "../predictionStage";

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

const makeTripUpdate = (
  vesselAbbrev: string,
  overrides: Partial<VesselTripUpdate> = {}
): VesselTripUpdate => ({
  vesselLocation: makeLocation(vesselAbbrev),
  existingActiveTrip: makeTrip(vesselAbbrev),
  activeTripCandidate: makeTrip(vesselAbbrev),
  completedTrip: undefined,
  replacementTrip: undefined,
  tripStorageChanged: false,
  tripLifecycleChanged: false,
  ...overrides,
});

const makeCompletedHandoff = (
  vesselAbbrev: string,
  overrides: Partial<CompletedTripBoundaryFact> = {}
): CompletedTripBoundaryFact => ({
  existingTrip: makeTrip(vesselAbbrev),
  tripToComplete: makeTrip(vesselAbbrev, {
    TripEnd: ms("2026-03-13T06:40:00-07:00"),
  }),
  events: {
    isFirstTrip: false,
    isTripStartReady: true,
    isCompletedTrip: true,
    didJustArriveAtDock: true,
    didJustLeaveDock: false,
    scheduleKeyChanged: false,
  },
  scheduleTrip: makeTrip(vesselAbbrev, {
    TripKey: generateTripKey(vesselAbbrev, ms("2026-03-13T06:41:00-07:00")),
    DepartingTerminalAbbrev: "ORI",
    ArrivingTerminalAbbrev: "LOP",
  }),
  ...overrides,
});

describe("prediction stage off-ramp policy", () => {
  it("continues only when trip storage or lifecycle changed", () => {
    const unchangedInput = buildPredictionStageInputs(
      [
        makeTripUpdate("CHE", {
          tripStorageChanged: false,
          tripLifecycleChanged: false,
        }),
      ],
      []
    );
    const storageChangedInput = buildPredictionStageInputs(
      [
        makeTripUpdate("TAC", {
          tripStorageChanged: true,
          tripLifecycleChanged: false,
        }),
      ],
      []
    );
    const lifecycleChangedInput = buildPredictionStageInputs(
      [
        makeTripUpdate("SAM", {
          tripStorageChanged: false,
          tripLifecycleChanged: true,
        }),
      ],
      []
    );

    expect(unchangedInput.activeTrips).toEqual([]);
    expect(storageChangedInput.activeTrips.map((trip) => trip.VesselAbbrev)).toEqual([
      "TAC",
    ]);
    expect(
      lifecycleChangedInput.activeTrips.map((trip) => trip.VesselAbbrev)
    ).toEqual(["SAM"]);
  });

  it("filters prediction inputs down to the changed-vessel subset", () => {
    const unchangedChe = makeTripUpdate("CHE");
    const changedTac = makeTripUpdate("TAC", {
      tripStorageChanged: true,
      activeTripCandidate: makeTrip("TAC", {
        TimeStamp: ms("2026-03-13T06:35:00-07:00"),
      }),
    });
    const changedSam = makeTripUpdate("SAM", {
      tripLifecycleChanged: true,
      completedTrip: makeTrip("SAM", {
        TripEnd: ms("2026-03-13T06:45:00-07:00"),
      }),
      replacementTrip: makeTrip("SAM", {
        TripKey: generateTripKey("SAM", ms("2026-03-13T06:46:00-07:00")),
        DepartingTerminalAbbrev: "ORI",
        ArrivingTerminalAbbrev: "LOP",
      }),
      activeTripCandidate: makeTrip("SAM", {
        TripKey: generateTripKey("SAM", ms("2026-03-13T06:46:00-07:00")),
        DepartingTerminalAbbrev: "ORI",
        ArrivingTerminalAbbrev: "LOP",
      }),
    });
    const unchangedCheTrip = unchangedChe.activeTripCandidate;
    const changedTacTrip = changedTac.activeTripCandidate;
    const changedSamTrip = changedSam.activeTripCandidate;
    const changedSamCompletedTrip = changedSam.completedTrip;

    if (
      unchangedCheTrip === undefined ||
      changedTacTrip === undefined ||
      changedSamTrip === undefined ||
      changedSamCompletedTrip === undefined
    ) {
      throw new Error("Test setup requires concrete trip rows.");
    }

    const predictionInputs = buildPredictionStageInputs(
      [unchangedChe, changedTac, changedSam],
      [makeCompletedHandoff("SAM")]
    );

    expect(
      predictionInputs.activeTrips.map((trip) => trip.VesselAbbrev)
    ).toEqual(["TAC", "SAM"]);
    expect(
      predictionInputs.completedHandoffs.map(
        (handoff) => handoff.tripToComplete.VesselAbbrev
      )
    ).toEqual(["SAM"]);
  });

  it("returns empty prediction inputs when every vessel is unchanged", () => {
    const predictionInputs = buildPredictionStageInputs(
      [makeTripUpdate("CHE"), makeTripUpdate("TAC")],
      []
    );

    expect(predictionInputs.activeTrips).toEqual([]);
    expect(predictionInputs.completedHandoffs).toEqual([]);
  });
});
