/**
 * Storage equality for vessel trips: sparse DB rows vs dense builder objects.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { isSameVesselTrip } from "../pipeline/tripComparison";

describe("isSameVesselTrip", () => {
  it("treats omitted optional keys like explicit undefined (sparse vs dense)", () => {
    const sparse: ConvexVesselTrip = {
      VesselAbbrev: "CHE",
      DepartingTerminalAbbrev: "CLI",
      TripKey: "CHE k",
      AtDock: true,
      InService: true,
      TimeStamp: 100,
    };

    const dense: ConvexVesselTrip = {
      VesselAbbrev: "CHE",
      DepartingTerminalAbbrev: "CLI",
      ArrivingTerminalAbbrev: undefined,
      RouteAbbrev: undefined,
      TripKey: "CHE k",
      ScheduleKey: undefined,
      SailingDay: undefined,
      PrevTerminalAbbrev: undefined,
      TripStart: undefined,
      TripEnd: undefined,
      AtDockDuration: undefined,
      ScheduledDeparture: undefined,
      LeftDock: undefined,
      LeftDockActual: undefined,
      TripDelay: undefined,
      Eta: undefined,
      AtSeaDuration: undefined,
      TotalDuration: undefined,
      AtDock: true,
      InService: true,
      TimeStamp: 200,
      PrevScheduledDeparture: undefined,
      PrevLeftDock: undefined,
      NextScheduleKey: undefined,
      NextScheduledDeparture: undefined,
    };

    expect(isSameVesselTrip(sparse, dense)).toBe(true);
  });

  it("returns false when a stored field value differs", () => {
    const a: ConvexVesselTrip = {
      VesselAbbrev: "CHE",
      DepartingTerminalAbbrev: "CLI",
      TripKey: "CHE k",
      AtDock: true,
      InService: true,
      Eta: 500,
      TimeStamp: 100,
    };

    const b: ConvexVesselTrip = {
      ...a,
      TimeStamp: 100,
      Eta: 501,
    };

    expect(isSameVesselTrip(a, b)).toBe(false);
  });
});
