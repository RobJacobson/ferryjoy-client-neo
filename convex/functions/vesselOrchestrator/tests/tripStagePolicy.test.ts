import { describe, expect, it, mock, spyOn } from "bun:test";
import type { ActionCtx } from "_generated/server";
import type { ScheduleContinuityAccess } from "domain/vesselOrchestration/shared";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import { computeTripStageForLocation } from "../action/pipeline/tripStage";

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

const makeLocationUpdate = (
  vesselAbbrev: string,
  overrides: Partial<ConvexVesselLocation> = {}
): ConvexVesselLocation => makeLocation(vesselAbbrev, overrides);

describe("trip stage schedule-inference gating", () => {
  it("returns sparse writes for one changed location update", async () => {
    const scheduleAccess: ScheduleContinuityAccess = {
      getScheduledDeparturesForVesselAndSailingDay: async () => [],
      getScheduledSegmentByKey: async () => null,
    };
    const ctx = {
      runQuery: mock(async () => ({})),
    } as unknown as ActionCtx;
    const tripStage = await computeTripStageForLocation(
      ctx,
      makeLocationUpdate("CHE"),
      makeTrip("CHE"),
      scheduleAccess
    );

    expect(tripStage).not.toBeNull();
    expect(tripStage?.tripWrites.activeTripUpsert).toBeDefined();
  });

  it("returns null when a vessel trip update emits no writes", async () => {
    const tripUpdateMod = await import(
      "domain/vesselOrchestration/updateVesselTrip"
    );
    const computeTripSpy = spyOn(tripUpdateMod, "updateVesselTrip");
    const healthyActiveTrip = makeTrip("TAC", {
      TimeStamp: ms("2026-03-13T06:35:00-07:00"),
    });
    const scheduleAccess: ScheduleContinuityAccess = {
      getScheduledDeparturesForVesselAndSailingDay: async () => [],
      getScheduledSegmentByKey: async () => null,
    };
    const ctx = {
      runQuery: mock(async () => ({})),
    } as unknown as ActionCtx;

    computeTripSpy.mockImplementation(
      async (input: Parameters<typeof tripUpdateMod.updateVesselTrip>[0]) => {
        return {
          vesselAbbrev: "TAC",
          activeVesselTripUpdate:
            input.vesselLocation.VesselAbbrev === "CHE"
              ? undefined
              : healthyActiveTrip,
          completedVesselTripUpdate: undefined,
        };
      }
    );

    try {
      const tripStage = await computeTripStageForLocation(
        ctx,
        makeLocationUpdate("CHE"),
        makeTrip("CHE"),
        scheduleAccess
      );

      expect(tripStage).toBeNull();
    } finally {
      computeTripSpy.mockRestore();
    }
  });
});
