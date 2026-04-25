/**
 * Tests for the vessel-location normalization concern.
 */

import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import type { VesselLocation as WsfVesselLocation } from "ws-dottie/wsf-vessels/core";
import { computeVesselLocationRows } from "../computeVesselLocationRows";

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

afterEach(() => {
  mock.restore();
});

describe("computeVesselLocationRows", () => {
  it("returns one location and skips rows that fail conversion", () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

    const result = computeVesselLocationRows({
      rawFeedLocations: [validRawRow(), unknownVesselRow()],
      vesselsIdentity: vesselsFixture,
      terminalsIdentity: terminalsFixture,
    });

    expect(result.vesselLocations).toHaveLength(1);
    expect(result.vesselLocations[0]?.VesselAbbrev).toBe("KIT");
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("throws when every row fails conversion", () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

    expect(() =>
      computeVesselLocationRows({
        rawFeedLocations: [unknownVesselRow(), unknownVesselRow()],
        vesselsIdentity: vesselsFixture,
        terminalsIdentity: terminalsFixture,
      })
    ).toThrow(/All 2 vessel location rows failed conversion/);

    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it("preserves raw marine terminal values when the terminal abbrev is unknown", () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

    const result = computeVesselLocationRows({
      rawFeedLocations: [
        validRawRow({
          DepartingTerminalAbbrev: "QQQ",
          DepartingTerminalName: "Mystery Yard",
        }),
      ],
      vesselsIdentity: vesselsFixture,
      terminalsIdentity: terminalsFixture,
    });

    expect(result.vesselLocations[0]?.DepartingTerminalAbbrev).toBe("QQQ");
    expect(result.vesselLocations[0]?.DepartingTerminalName).toBe(
      "Mystery Yard"
    );
    expect(result.vesselLocations[0]?.DepartingDistance).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("skips rows missing a departing terminal abbreviation", () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

    const result = computeVesselLocationRows({
      rawFeedLocations: [
        validRawRow({
          DepartingTerminalAbbrev: "",
        }),
        validRawRow(),
      ],
      vesselsIdentity: vesselsFixture,
      terminalsIdentity: terminalsFixture,
    });

    expect(result.vesselLocations).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(
      /Missing departing terminal abbreviation/
    );
  });
});

const validRawRow = (
  overrides: Partial<WsfVesselLocation> = {}
): WsfVesselLocation =>
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
    ...overrides,
  }) as WsfVesselLocation;

/**
 * Raw row that fails vessel resolution against {@link vesselsFixture}.
 */
const unknownVesselRow = (): WsfVesselLocation =>
  ({
    ...validRawRow(),
    VesselName: "Not In Snapshot",
    VesselID: 999,
  }) as WsfVesselLocation;
