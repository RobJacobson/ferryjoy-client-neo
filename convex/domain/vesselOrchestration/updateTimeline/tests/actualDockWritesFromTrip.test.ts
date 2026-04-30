/**
 * Trip-driven sparse actual dock write tests.
 */

import { describe, expect, it } from "bun:test";
import { buildActualDockEventFromWrite } from "domain/timelineRows";
import {
  buildArrivalActualDockWriteForTrip,
  buildDepartureActualDockWriteForTrip,
} from "domain/vesselOrchestration/updateTimeline/actualDockWritesFromTrip";
import type { ConvexVesselTripWithPredictions } from "functions/vesselTrips/schemas";

const at = (hours: number, minutes: number) =>
  Date.UTC(2026, 2, 25, hours, minutes);

describe("buildDepartureActualDockWriteForTrip", () => {
  it("returns a write from LeftDockActual when SailingDay and ScheduledDeparture are omitted", () => {
    const trip = {
      VesselAbbrev: "WEN",
      TripKey: "WEN 2026-03-25 19:20:00Z",
      ScheduleKey: "trip-key",
      DepartingTerminalAbbrev: "BBI",
      LeftDockActual: at(12, 23),
      LeftDock: at(12, 24),
    } as ConvexVesselTripWithPredictions;

    const write = buildDepartureActualDockWriteForTrip(trip);

    expect(write).not.toBeNull();
    if (!write) {
      throw new Error("expected write");
    }
    expect(write.SailingDay).toBeUndefined();
    expect(write.ScheduledDeparture).toBeUndefined();

    const row = buildActualDockEventFromWrite(write, at(15, 0));
    expect(row.SailingDay).toBe("2026-03-25");
    expect(row.ScheduledDeparture).toBe(at(12, 23));
  });

  it("does not fall back to legacy departure mirrors when the canonical field is absent", () => {
    const trip = {
      VesselAbbrev: "WEN",
      TripKey: "WEN 2026-03-25 19:20:00Z",
      ScheduleKey: "trip-key",
      DepartingTerminalAbbrev: "BBI",
      LeftDock: at(12, 24),
    } as ConvexVesselTripWithPredictions;

    const write = buildDepartureActualDockWriteForTrip(trip);

    expect(write).toBeNull();
  });
});

describe("buildArrivalActualDockWriteForTrip", () => {
  it("returns a write from TripEnd when completion has backfilled the physical arrival terminal", () => {
    const trip = {
      VesselAbbrev: "WEN",
      TripKey: "WEN 2026-03-25 19:20:00Z",
      ScheduleKey: undefined,
      ArrivingTerminalAbbrev: "P52",
      TripEnd: at(12, 59),
    } as ConvexVesselTripWithPredictions;

    const write = buildArrivalActualDockWriteForTrip(trip);

    expect(write).not.toBeNull();
    if (!write) {
      throw new Error("expected write");
    }
    expect(write.TerminalAbbrev).toBe("P52");
    expect(write.EventType).toBe("arv-dock");

    const row = buildActualDockEventFromWrite(write, at(15, 0));
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
      TripEnd: undefined,
    } as ConvexVesselTripWithPredictions;

    expect(buildArrivalActualDockWriteForTrip(trip)).toBeNull();
  });
});
