/**
 * Trip-driven sparse actual boundary patch tests.
 */

import { describe, expect, it } from "bun:test";
import { buildActualBoundaryEventFromPatch } from "domain/timelineRows";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import {
  buildArrivalActualPatchForTrip,
  buildDepartureActualPatchForTrip,
} from "../projection/actualBoundaryPatchesFromTrip";

const at = (hours: number, minutes: number) =>
  Date.UTC(2026, 2, 25, hours, minutes);

describe("buildDepartureActualPatchForTrip", () => {
  it("returns a patch from DepartOriginActual when SailingDay and ScheduledDeparture are omitted", () => {
    const trip = {
      VesselAbbrev: "WEN",
      TripKey: "WEN 2026-03-25 19:20:00Z",
      ScheduleKey: "trip-key",
      DepartingTerminalAbbrev: "BBI",
      DepartOriginActual: at(12, 22),
      LeftDockActual: at(12, 23),
      LeftDock: at(12, 24),
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

  it("does not fall back to legacy departure mirrors when the canonical field is absent", () => {
    const trip = {
      VesselAbbrev: "WEN",
      TripKey: "WEN 2026-03-25 19:20:00Z",
      ScheduleKey: "trip-key",
      DepartingTerminalAbbrev: "BBI",
      LeftDockActual: at(12, 23),
      LeftDock: at(12, 24),
    } as ConvexVesselTrip;

    const patch = buildDepartureActualPatchForTrip(trip);

    expect(patch).toBeNull();
  });
});

describe("buildArrivalActualPatchForTrip", () => {
  it("returns a patch from ArriveDestDockActual when completion has backfilled the physical arrival terminal", () => {
    const trip = {
      VesselAbbrev: "WEN",
      TripKey: "WEN 2026-03-25 19:20:00Z",
      ScheduleKey: undefined,
      ArrivingTerminalAbbrev: "P52",
      ArriveDestDockActual: at(12, 59),
      ArriveDest: at(12, 58),
    } as ConvexVesselTrip;

    const patch = buildArrivalActualPatchForTrip(trip);

    expect(patch).not.toBeNull();
    if (!patch) {
      throw new Error("expected patch");
    }
    expect(patch.TerminalAbbrev).toBe("P52");
    expect(patch.EventType).toBe("arv-dock");

    const row = buildActualBoundaryEventFromPatch(patch, at(15, 0));
    expect(row.TerminalAbbrev).toBe("P52");
    expect(row.ScheduleKey).toBeUndefined();
    expect(row.ScheduledDeparture).toBe(at(12, 59));
  });

  it("does not fall back to legacy arrival mirrors when the canonical field is absent", () => {
    const trip = {
      VesselAbbrev: "WEN",
      TripKey: "WEN 2026-03-25 19:20:00Z",
      ScheduleKey: undefined,
      ArrivingTerminalAbbrev: "P52",
      ArriveDestDockActual: undefined,
      ArriveDest: at(12, 58),
    } as ConvexVesselTrip;

    expect(buildArrivalActualPatchForTrip(trip)).toBeNull();
  });
});
