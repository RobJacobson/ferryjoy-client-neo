import { describe, expect, it } from "bun:test";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { buildScheduleSnapshotQueryArgs } from "../buildScheduleSnapshotQueryArgs";

describe("buildScheduleSnapshotQueryArgs", () => {
  it("includes tick sailing day padding, trip days, and segment keys from trips and locations", () => {
    const vessels: VesselIdentity[] = [
      { VesselID: 1, VesselName: "A", VesselAbbrev: "CHE" },
    ];
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
      vessels,
      activeTrips,
      locations,
      tickStartedAt
    );

    expect(args.vesselAbbrevs).toEqual(["CHE"]);
    expect(args.segmentKeys.sort()).toEqual(
      ["seg-from-loc", "seg-from-trip", "seg-next"].sort()
    );
    expect(args.sailingDays.length).toBeLessThanOrEqual(5);
    expect(args.sailingDays).toContain("2026-03-13");
  });
});
