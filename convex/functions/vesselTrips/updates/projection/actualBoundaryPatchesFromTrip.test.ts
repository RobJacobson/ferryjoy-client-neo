/**
 * Trip-driven sparse actual boundary patch tests.
 */

import { describe, expect, it } from "bun:test";
import { buildActualBoundaryEventFromPatch } from "domain/vesselTimeline/normalizedEvents";
import type { ConvexVesselTrip } from "../../schemas";
import { buildDepartureActualPatchForTrip } from "./actualBoundaryPatchesFromTrip";

const at = (hours: number, minutes: number) =>
  Date.UTC(2026, 2, 25, hours, minutes);

describe("buildDepartureActualPatchForTrip", () => {
  it("returns a patch when the trip omits SailingDay and ScheduledDeparture", () => {
    const trip = {
      VesselAbbrev: "WEN",
      TripKey: "WEN 2026-03-25 19:20:00Z",
      Key: "trip-key",
      ScheduleKey: "trip-key",
      DepartingTerminalAbbrev: "BBI",
      LeftDock: at(12, 22),
    } as ConvexVesselTrip;

    const patch = buildDepartureActualPatchForTrip(trip);

    expect(patch).not.toBeNull();
    if (!patch) {
      throw new Error("expected patch");
    }
    expect(patch.SailingDay).toBeUndefined();
    expect(patch.ScheduledDeparture).toBeUndefined();

    const row = buildActualBoundaryEventFromPatch(patch, at(15, 0));
    expect(row.SailingDay).toBe("2026-03-25");
    expect(row.ScheduledDeparture).toBe(at(12, 22));
  });
});
