import { describe, expect, it } from "bun:test";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { buildScheduleSnapshotQueryArgs } from "../buildScheduleSnapshotQueryArgs";

describe("buildScheduleSnapshotQueryArgs", () => {
  it("includes tick day, persisted trip sailing days, and segment keys from trips and locations", () => {
    const activeTrips: ConvexVesselTrip[] = [
      {
        VesselAbbrev: "CHE",
        DepartingTerminalAbbrev: "CLI",
        ArrivingTerminalAbbrev: "MUK",
        RouteAbbrev: "r",
        TripKey: "t1",
        ScheduleKey: "seg-from-trip",
        NextScheduleKey: "seg-next",
        SailingDay: "2026-03-13",
        ScheduledDeparture: new Date("2026-03-15T12:00:00Z").getTime(),
      } as ConvexVesselTrip,
    ];
    const locations: ConvexVesselLocation[] = [
      {
        VesselAbbrev: "CHE",
        ScheduleKey: "seg-from-loc",
      } as ConvexVesselLocation,
    ];
    const tickStartedAt = new Date("2026-03-14T12:00:00Z").getTime();
    const args = buildScheduleSnapshotQueryArgs(
      activeTrips,
      locations,
      tickStartedAt
    );

    expect(args.segmentKeys.sort()).toEqual(
      ["seg-from-loc", "seg-from-trip", "seg-next"].sort()
    );
    expect(args.sailingDays).toEqual(["2026-03-13", "2026-03-14"]);
  });

  it("falls back to ScheduledDeparture when trip SailingDay is missing", () => {
    const activeTrips: ConvexVesselTrip[] = [
      {
        VesselAbbrev: "CHE",
        DepartingTerminalAbbrev: "CLI",
        ArrivingTerminalAbbrev: "MUK",
        RouteAbbrev: "r",
        TripKey: "t1",
        ScheduleKey: "seg-from-trip",
        ScheduledDeparture: new Date("2026-03-15T12:00:00Z").getTime(),
      } as ConvexVesselTrip,
    ];
    const args = buildScheduleSnapshotQueryArgs(
      activeTrips,
      [],
      new Date("2026-03-14T12:00:00Z").getTime()
    );

    expect(args.sailingDays).toEqual(["2026-03-14", "2026-03-15"]);
  });
});
