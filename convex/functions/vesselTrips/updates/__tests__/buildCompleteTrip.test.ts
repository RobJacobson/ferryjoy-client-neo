/**
 * Unit tests for buildCompleteTrip (location-derived field construction).
 */

import { describe, expect, test } from "bun:test";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "../../schemas";
import { buildCompleteTrip } from "../buildCompleteTrip";

const baseLocation: ConvexVesselLocation = {
  VesselID: 1,
  VesselName: "Kodiak",
  VesselAbbrev: "KODIAK",
  DepartingTerminalID: 1,
  DepartingTerminalName: "Bainbridge",
  DepartingTerminalAbbrev: "BBI",
  ArrivingTerminalID: 2,
  ArrivingTerminalName: "Seattle",
  ArrivingTerminalAbbrev: "SEA",
  Latitude: 47.6,
  Longitude: -122.3,
  Speed: 0,
  Heading: 0,
  InService: true,
  AtDock: true,
  TimeStamp: 2000,
};

const baseTrip: ConvexVesselTrip = {
  VesselAbbrev: "KODIAK",
  DepartingTerminalAbbrev: "BBI",
  ArrivingTerminalAbbrev: "SEA",
  RouteID: 1,
  RouteAbbrev: "SEA-BI",
  SailingDay: "2026-02-22",
  Key: "key1",
  AtDock: true,
  InService: true,
  TimeStamp: 1000,
  PrevTerminalAbbrev: "SEA",
  TripStart: 1000,
  ScheduledDeparture: 1500,
  PrevScheduledDeparture: 500,
  PrevLeftDock: 600,
};

describe("buildCompleteTrip", () => {
  test("identity fields from currLocation", () => {
    const result = buildCompleteTrip(baseTrip, baseLocation);
    expect(result.VesselAbbrev).toBe("KODIAK");
    expect(result.DepartingTerminalAbbrev).toBe("BBI");
    expect(result.AtDock).toBe(true);
    expect(result.InService).toBe(true);
    expect(result.TimeStamp).toBe(2000);
  });

  test("ArrivingTerminalAbbrev uses fallback chain", () => {
    const locNoArriving = {
      ...baseLocation,
      ArrivingTerminalAbbrev: undefined,
    };
    const result = buildCompleteTrip(baseTrip, locNoArriving, {
      arrivalTerminal: "SEA",
    });
    expect(result.ArrivingTerminalAbbrev).toBe("SEA");
  });

  test("ArrivingTerminalAbbrev prefers currLocation over arrivalLookup", () => {
    const result = buildCompleteTrip(baseTrip, baseLocation, {
      arrivalTerminal: "OTHER",
    });
    expect(result.ArrivingTerminalAbbrev).toBe("SEA");
  });

  test("LeftDock inferred when AtDock flips false", () => {
    const atSea = { ...baseLocation, AtDock: false, LeftDock: undefined };
    const result = buildCompleteTrip(baseTrip, atSea);
    expect(result.LeftDock).toBe(2000);
    expect(result.AtDock).toBe(false);
  });

  test("ScheduledDeparture preserved when currLocation has null", () => {
    const locNoSched = {
      ...baseLocation,
      ScheduledDeparture: undefined,
      Eta: undefined,
    };
    const result = buildCompleteTrip(baseTrip, locNoSched);
    expect(result.ScheduledDeparture).toBe(1500);
  });
});
