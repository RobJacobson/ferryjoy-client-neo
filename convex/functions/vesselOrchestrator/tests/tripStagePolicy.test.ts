import { describe, expect, it } from "bun:test";
import type { ScheduleSnapshot } from "domain/vesselOrchestration/shared/scheduleSnapshot/scheduleSnapshotTypes";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselLocationUpdates } from "functions/vesselOrchestrator/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import { computeTripBatchForPing } from "../testing";

const ms = (iso: string) => new Date(iso).getTime();

const emptyScheduleSnapshot: ScheduleSnapshot = {
  SailingDay: "2026-03-13",
  scheduledDepartureBySegmentKey: {},
  scheduledDeparturesByVesselAbbrev: {},
};

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
  locationChanged: boolean,
  overrides: Partial<ConvexVesselLocation> = {}
): VesselLocationUpdates => ({
  vesselLocation: makeLocation(vesselAbbrev, overrides),
  locationChanged,
});

describe("trip stage schedule-inference gating", () => {
  it("skips trip recomputation for unchanged locations", async () => {
    const tripBatch = await computeTripBatchForPing(
      [
        makeLocationUpdate("CHE", false),
        makeLocationUpdate("TAC", true, {
          TimeStamp: ms("2026-03-13T06:35:00-07:00"),
        }),
      ],
      [makeTrip("CHE"), makeTrip("TAC")],
      emptyScheduleSnapshot,
      "2026-03-13"
    );

    expect(tripBatch.updates).toHaveLength(1);
    expect(tripBatch.updates[0]?.vesselLocation.VesselAbbrev).toBe("TAC");
    expect(tripBatch.rows.activeTrips).toHaveLength(2);
  });
});
