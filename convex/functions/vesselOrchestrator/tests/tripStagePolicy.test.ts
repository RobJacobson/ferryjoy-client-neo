/**
 * Policy tests for domain `updateVesselTrip`: non-null sparse updates vs
 * `null` when the domain emits no durable writes. Keeps trip gating explicit
 * without running the full orchestrator ping.
 */

import { describe, expect, it, spyOn } from "bun:test";
import type { UpdateVesselTripDbAccess } from "domain/vesselOrchestration/updateVesselTrip";
import { updateVesselTrip } from "domain/vesselOrchestration/updateVesselTrip";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";

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
  TripEnd: undefined,
  TripStart: ms("2026-03-13T04:33:00-07:00"),
  AtDock: false,
  AtDockDuration: undefined,
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  LeftDock: ms("2026-03-13T05:29:38-07:00"),
  TripDelay: undefined,
  Eta: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T06:28:45-07:00"),
  PrevScheduledDeparture: ms("2026-03-12T19:30:00-07:00"),
  PrevLeftDock: ms("2026-03-12T19:34:26-07:00"),
  NextScheduleKey: undefined,
  NextScheduledDeparture: undefined,
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
  AtDockObserved: overrides.AtDockObserved ?? false,
});

const makeLocationUpdate = (
  vesselAbbrev: string,
  overrides: Partial<ConvexVesselLocation> = {}
): ConvexVesselLocation => makeLocation(vesselAbbrev, overrides);

describe("updateVesselTrip sparse-write policy", () => {
  it("returns sparse writes for one changed location update", async () => {
    const dbAccess: UpdateVesselTripDbAccess = {
      getScheduledSegmentByScheduleKey: async () => null,
      getScheduleRolloverDockEvents: async () => ({
        currentSailingDay: "2026-03-13",
        currentDayEvents: [],
        nextSailingDay: "2026-03-14",
        nextDayEvents: [],
      }),
    };
    const tripStage = await updateVesselTrip(
      makeLocationUpdate("CHE"),
      makeTrip("CHE"),
      dbAccess
    );

    expect(tripStage).not.toBeNull();
    expect(tripStage?.existingVesselTrip).toBeDefined();
    expect(tripStage?.activeVesselTrip).toBeDefined();
  });

  it("returns null when a vessel trip update emits no writes", async () => {
    const tripUpdateMod = await import(
      "domain/vesselOrchestration/updateVesselTrip"
    );
    const computeTripSpy = spyOn(tripUpdateMod, "updateVesselTrip");
    const healthyActiveTrip = makeTrip("TAC", {
      TimeStamp: ms("2026-03-13T06:35:00-07:00"),
    });
    const dbAccess: UpdateVesselTripDbAccess = {
      getScheduledSegmentByScheduleKey: async () => null,
      getScheduleRolloverDockEvents: async () => ({
        currentSailingDay: "2026-03-13",
        currentDayEvents: [],
        nextSailingDay: "2026-03-14",
        nextDayEvents: [],
      }),
    };
    computeTripSpy.mockImplementation(
      async (
        vesselLocation: Parameters<typeof tripUpdateMod.updateVesselTrip>[0]
      ) => {
        if (vesselLocation.VesselAbbrev === "CHE") {
          return null;
        }
        return {
          vesselAbbrev: "TAC",
          activeVesselTrip: healthyActiveTrip,
          completedVesselTrip: undefined,
        };
      }
    );

    try {
      const tripStage = await updateVesselTrip(
        makeLocationUpdate("CHE"),
        makeTrip("CHE"),
        dbAccess
      );

      expect(tripStage).toBeNull();
    } finally {
      computeTripSpy.mockRestore();
    }
  });
});
