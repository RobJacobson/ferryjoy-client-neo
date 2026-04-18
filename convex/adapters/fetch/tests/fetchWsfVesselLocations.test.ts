/**
 * Tests for Dottie → Convex vessel location mapping and batch guards.
 */

import { describe, expect, it } from "bun:test";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";
import {
  assertAtLeastOneVesselLocationConverted,
  mapDottieVesselLocationsToConvex,
} from "../fetchWsfVesselLocations";

const vesselsFixture: VesselIdentity[] = [
  { VesselID: 101, VesselName: "Kittitas", VesselAbbrev: "KIT" },
];

const terminalsFixture: TerminalIdentity[] = [
  {
    TerminalID: 1,
    TerminalName: "Seattle",
    TerminalAbbrev: "SEA",
    Latitude: 47.6,
    Longitude: -122.3,
  },
  {
    TerminalID: 2,
    TerminalName: "Bremerton",
    TerminalAbbrev: "BME",
    Latitude: 47.55,
    Longitude: -122.62,
  },
];

/**
 * Minimal WSF row that converts with {@link vesselsFixture} /
 * {@link terminalsFixture}.
 */
const validDottieRow = (): DottieVesselLocation =>
  ({
    VesselID: 101,
    VesselName: "Kittitas",
    DepartingTerminalAbbrev: "SEA",
    DepartingTerminalName: "Seattle",
    ArrivingTerminalAbbrev: "BME",
    ArrivingTerminalName: "Bremerton",
    DepartingTerminalID: 1,
    ArrivingTerminalID: 2,
    Latitude: 47.6,
    Longitude: -122.3,
    Speed: 10,
    Heading: 90,
    InService: true,
    AtDock: false,
    LeftDock: null,
    Eta: null,
    ScheduledDeparture: null,
    OpRouteAbbrev: ["SR"],
    VesselPositionNum: 1,
    TimeStamp: new Date("2025-01-01T12:00:00.000Z"),
  }) as DottieVesselLocation;

const unknownVesselRow = (): DottieVesselLocation =>
  ({
    ...validDottieRow(),
    VesselName: "Not In Snapshot",
    VesselID: 999,
  }) as DottieVesselLocation;

describe("mapDottieVesselLocationsToConvex", () => {
  it("returns one location and skips rows that fail conversion", () => {
    const locations = mapDottieVesselLocationsToConvex(
      [validDottieRow(), unknownVesselRow()],
      vesselsFixture,
      terminalsFixture
    );

    expect(locations).toHaveLength(1);
    expect(locations[0]?.VesselAbbrev).toBe("KIT");
  });

  it("returns empty locations when every row fails", () => {
    const locations = mapDottieVesselLocationsToConvex(
      [unknownVesselRow(), unknownVesselRow()],
      vesselsFixture,
      terminalsFixture
    );

    expect(locations).toHaveLength(0);
  });
});

describe("assertAtLeastOneVesselLocationConverted", () => {
  it("throws when the API had rows but none converted", () => {
    expect(() => assertAtLeastOneVesselLocationConverted(2, [])).toThrow(
      /All 2 vessel location rows failed conversion/
    );
  });

  it("does not throw when at least one row converted", () => {
    expect(() =>
      assertAtLeastOneVesselLocationConverted(2, [
        { VesselAbbrev: "KIT" } as ConvexVesselLocation,
      ])
    ).not.toThrow();
  });

  it("does not throw when raw count is zero", () => {
    expect(() => assertAtLeastOneVesselLocationConverted(0, [])).not.toThrow();
  });
});
