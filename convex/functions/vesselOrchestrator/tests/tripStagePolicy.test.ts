import { describe, expect, it, spyOn } from "bun:test";
import type { ScheduleContinuityAccess } from "domain/vesselOrchestration/shared";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import { computeTripStageForLocations } from "../actions";

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
  it("runs trip recomputation for each supplied location update", async () => {
    const scheduleAccess: ScheduleContinuityAccess = {
      getScheduledDeparturesForVesselAndSailingDay: async () => [],
      getScheduledSegmentByKey: async () => null,
    };
    const locationUpdates = [
      makeLocationUpdate("CHE"),
      makeLocationUpdate("TAC", {
        TimeStamp: ms("2026-03-13T06:35:00-07:00"),
      }),
    ];
    const tripStage = await computeTripStageForLocations(
      locationUpdates,
      [makeTrip("CHE"), makeTrip("TAC")],
      scheduleAccess
    );

    expect(tripStage.predictionInputs.activeTrips).toHaveLength(2);
    expect(tripStage.tripWrites.activeTripUpserts).toHaveLength(2);
  });

  it("logs and skips a vessel whose trip computation throws", async () => {
    const tripUpdateMod = await import(
      "domain/vesselOrchestration/updateVesselTrips"
    );
    const computeTripSpy = spyOn(tripUpdateMod, "computeVesselTripUpdate");
    const consoleErrorSpy = spyOn(console, "error");
    const healthyActiveTrip = makeTrip("TAC", {
      TimeStamp: ms("2026-03-13T06:35:00-07:00"),
    });
    const scheduleAccess: ScheduleContinuityAccess = {
      getScheduledDeparturesForVesselAndSailingDay: async () => [],
      getScheduledSegmentByKey: async () => null,
    };

    computeTripSpy.mockImplementation(
      async (
        input: Parameters<typeof tripUpdateMod.computeVesselTripUpdate>[0]
      ) => {
        if (input.vesselLocation.VesselAbbrev === "CHE") {
          throw new Error("poisoned trip row");
        }

        return {
          vesselLocation: input.vesselLocation,
          existingActiveTrip: input.existingActiveTrip,
          activeTripCandidate: healthyActiveTrip,
          completedTrip: undefined,
          replacementTrip: undefined,
          tripStorageChanged: true,
          tripLifecycleChanged: false,
        };
      }
    );
    consoleErrorSpy.mockImplementation(() => {});

    try {
      const failedTrip = makeTrip("CHE");
      const tripStage = await computeTripStageForLocations(
        [
          makeLocationUpdate("CHE"),
          makeLocationUpdate("TAC", {
            TimeStamp: ms("2026-03-13T06:35:00-07:00"),
          }),
        ],
        [failedTrip, makeTrip("TAC")],
        scheduleAccess
      );

      expect(tripStage.tripWrites.completedTripWrites).toHaveLength(0);
      expect(tripStage.tripWrites.activeTripUpserts).toEqual([healthyActiveTrip]);
      expect(tripStage.predictionInputs.activeTrips).toEqual([
        healthyActiveTrip,
      ]);
      expect(tripStage.predictionInputs.completedHandoffs).toHaveLength(0);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy.mock.calls[0]?.[0]).toBe(
        "[VESSEL_ORCHESTRATOR_CRITICAL_PER_VESSEL_FAILURE]"
      );
      expect(consoleErrorSpy.mock.calls[0]?.[1]).toMatchObject({
        vesselAbbrev: "CHE",
        message: "poisoned trip row",
        existingTripKey: failedTrip.TripKey,
        existingScheduleKey: failedTrip.ScheduleKey,
      });
    } finally {
      computeTripSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });
});
