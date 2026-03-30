/// <reference path="../../../src/bun-test.d.ts" />

import { describe, expect, it } from "bun:test";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";
import { calculateDistanceInMiles } from "../../shared/distanceUtils";
import { getTerminalLocationByAbbrev } from "../../shared/terminalLocations";
import type { VesselIdentity } from "../../shared/vessels";
import { toConvexVesselLocation } from "./schemas";

describe("calculateDistanceInMiles", () => {
  it("floors distances to one decimal place", () => {
    const flooredDistance = calculateDistanceInMiles(
      47.6205,
      -122.3493,
      47.6133,
      -122.35035
    );

    expect(flooredDistance).toBe(0.4);
  });
});

describe("toConvexVesselLocation", () => {
  it("computes both terminal distances when both terminals are known", () => {
    const location = toConvexVesselLocation(
      makeDottieLocation({
        VesselID: 1,
        VesselName: "Cathlamet",
        DepartingTerminalID: 1,
        DepartingTerminalName: "Anacortes",
        DepartingTerminalAbbrev: "ANA",
        ArrivingTerminalID: 15,
        ArrivingTerminalName: "Orcas Island",
        ArrivingTerminalAbbrev: "ORI",
        Latitude: 48.55,
        Longitude: -122.82,
        Speed: 15.7,
      }),
      TEST_VESSELS
    );

    const departing = getTerminalLocationByAbbrev("ANA");
    const arriving = getTerminalLocationByAbbrev("ORI");

    expect(location.DepartingDistance).toBe(
      calculateDistanceInMiles(
        48.55,
        -122.82,
        departing?.Latitude,
        departing?.Longitude
      )
    );
    expect(location.ArrivingDistance).toBe(
      calculateDistanceInMiles(
        48.55,
        -122.82,
        arriving?.Latitude,
        arriving?.Longitude
      )
    );
  });

  it("computes only departing distance when arriving terminal is absent", () => {
    const location = toConvexVesselLocation(
      makeDottieLocation({
        DepartingTerminalID: 3,
        DepartingTerminalName: "Bainbridge Island",
        DepartingTerminalAbbrev: "BBI",
        ArrivingTerminalID: null,
        ArrivingTerminalName: null,
        ArrivingTerminalAbbrev: null,
        Latitude: 47.62,
        Longitude: -122.45,
      }),
      TEST_VESSELS
    );

    expect(location.DepartingDistance).toBeDefined();
    expect(location.ArrivingDistance).toBeUndefined();
  });

  it("computes departing distance for Eagle Harbor maintenance-yard locations", () => {
    const location = toConvexVesselLocation(
      makeDottieLocation({
        DepartingTerminalID: 122,
        DepartingTerminalName: "Eagle Harbor",
        DepartingTerminalAbbrev: "EAH",
        Latitude: 47.620552,
        Longitude: -122.514245,
      }),
      TEST_VESSELS
    );

    expect(location.DepartingDistance).toBe(0);
  });

  it("normalizes vessel abbreviation and speed in the same pass", () => {
    const location = toConvexVesselLocation(
      makeDottieLocation({
        VesselID: 75,
        VesselName: "Suquamish",
        Speed: 0.15,
      }),
      TEST_VESSELS
    );

    expect(location.VesselAbbrev).toBe("SUQ");
    expect(location.Speed).toBe(0);
  });

  it("leaves departing distance undefined when departing terminal abbreviation is missing", () => {
    const location = toConvexVesselLocation(
      makeDottieLocation({
        VesselID: 32,
        VesselName: "Tacoma",
        DepartingTerminalID: 999,
        DepartingTerminalAbbrev: null,
      }),
      TEST_VESSELS
    );

    expect(location.DepartingDistance).toBeUndefined();
  });

  it("leaves departing distance undefined when departing terminal abbreviation is unknown", () => {
    const location = toConvexVesselLocation(
      makeDottieLocation({
        VesselID: 32,
        VesselName: "Tacoma",
        DepartingTerminalID: 999,
        DepartingTerminalAbbrev: "ZZZ",
      }),
      TEST_VESSELS
    );

    expect(location.DepartingDistance).toBeUndefined();
  });
});

const TEST_VESSELS: Array<VesselIdentity> = [
  {
    VesselID: 1,
    VesselName: "Cathlamet",
    VesselAbbrev: "CAT",
  },
  {
    VesselID: 32,
    VesselName: "Tacoma",
    VesselAbbrev: "TAC",
  },
  {
    VesselID: 75,
    VesselName: "Suquamish",
    VesselAbbrev: "SUQ",
  },
];

const makeDottieLocation = (
  overrides: Partial<DottieVesselLocation> = {}
): DottieVesselLocation => ({
  VesselID: 1,
  VesselName: "Cathlamet",
  Mmsi: null,
  DepartingTerminalID: 1,
  DepartingTerminalName: "Anacortes",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalID: 15,
  ArrivingTerminalName: "Orcas Island",
  ArrivingTerminalAbbrev: "ORI",
  Latitude: 48.507351,
  Longitude: -122.677,
  Speed: 12.3,
  Heading: 180,
  InService: true,
  AtDock: false,
  LeftDock: new Date("2026-03-26T12:00:00Z"),
  Eta: new Date("2026-03-26T13:00:00Z"),
  EtaBasis: null,
  ScheduledDeparture: new Date("2026-03-26T12:10:00Z"),
  OpRouteAbbrev: ["ana-sj"],
  VesselPositionNum: 1,
  SortSeq: 1,
  ManagedBy: 1,
  TimeStamp: new Date("2026-03-26T12:34:56Z"),
  VesselWatchShutID: 0,
  VesselWatchShutMsg: null,
  VesselWatchShutFlag: null,
  VesselWatchStatus: null,
  VesselWatchMsg: null,
  ...overrides,
});
