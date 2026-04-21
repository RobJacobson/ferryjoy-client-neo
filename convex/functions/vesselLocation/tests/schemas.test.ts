/**
 * Characterization tests for vessel-location conversion around non-terminal
 * marine facilities.
 */

import { describe, expect, it } from "bun:test";
import { computeVesselLocationRows } from "domain/vesselOrchestration/updateVesselLocations";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { VesselLocation as WsfVesselLocation } from "ws-dottie/wsf-vessels/core";

describe("computeVesselLocationRows ScheduleKey behavior", () => {
  it("stamps the canonical key when arriving terminal and scheduled departure are present", async () => {
    const location = await convertOne(
      makeRawLocation({
        ScheduledDeparture: new Date("2026-03-13T05:30:00-07:00"),
      }),
      [
        makeTerminal({
          TerminalID: 1,
          TerminalAbbrev: "ANA",
          TerminalName: "Anacortes",
        }),
        makeTerminal({
          TerminalID: 15,
          TerminalAbbrev: "ORI",
          TerminalName: "Orcas Island",
        }),
      ]
    );

    expect(location.ScheduleKey).toBe("CHE--2026-03-13--05:30--ANA-ORI");
  });

  it("omits key when arriving terminal is missing", async () => {
    const location = await convertOne(
      makeRawLocation({
        ArrivingTerminalID: undefined,
        ArrivingTerminalAbbrev: undefined,
        ArrivingTerminalName: undefined,
        ScheduledDeparture: new Date("2026-03-13T05:30:00-07:00"),
      }),
      [makeTerminal({ TerminalID: 1, TerminalAbbrev: "ANA" })]
    );

    expect(location.ScheduleKey).toBeUndefined();
  });

  it("omits key when scheduled departure is missing", async () => {
    const location = await convertOne(
      makeRawLocation({
        ScheduledDeparture: undefined,
      }),
      [
        makeTerminal({
          TerminalID: 1,
          TerminalAbbrev: "ANA",
          TerminalName: "Anacortes",
        }),
        makeTerminal({
          TerminalID: 15,
          TerminalAbbrev: "ORI",
          TerminalName: "Orcas Island",
        }),
      ]
    );

    expect(location.ScheduleKey).toBeUndefined();
  });

  it("falls back to raw marine-location values when the terminal abbrev is unknown", async () => {
    const location = await convertOne(
      makeRawLocation({
        DepartingTerminalAbbrev: "ZZZ",
        DepartingTerminalName: "Mystery Yard",
        ArrivingTerminalAbbrev: "ORI",
        ArrivingTerminalName: "Orcas Island",
      }),
      [
        makeTerminal({
          TerminalID: 1,
          TerminalAbbrev: "ANA",
          TerminalName: "Anacortes",
        }),
        makeTerminal({
          TerminalID: 15,
          TerminalAbbrev: "ORI",
          TerminalName: "Orcas Island",
        }),
      ]
    );

    expect(location.DepartingTerminalAbbrev).toBe("ZZZ");
    expect(location.DepartingTerminalName).toBe("Mystery Yard");
    expect(location.DepartingDistance).toBeUndefined();
    expect(location.ArrivingTerminalAbbrev).toBe("ORI");
    expect(location.ArrivingTerminalName).toBe("Orcas Island");
    expect(location.ScheduleKey).toBeUndefined();
  });
});

/**
 * Converts one raw WSF row through the canonical locations concern and returns
 * the single normalized result.
 *
 * @param rawFeedLocation - Raw WSF vessel-location row
 * @param terminalsIdentity - Terminal identity rows used during normalization
 * @returns The single normalized vessel-location row
 */
const convertOne = async (
  rawFeedLocation: WsfVesselLocation,
  terminalsIdentity: ReadonlyArray<TerminalIdentity>
) => {
  const result = await computeVesselLocationRows({
    pingStartedAt: Date.now(),
    rawFeedLocations: [rawFeedLocation],
    vesselsIdentity: [
      {
        VesselID: 2,
        VesselName: "Chelan",
        VesselAbbrev: "CHE",
      },
    ],
    terminalsIdentity,
  });

  const location = result.vesselLocations[0];

  if (!location) {
    throw new Error("Expected one vessel location to convert.");
  }

  return location;
};

/**
 * Builds a terminal identity fixture with sane defaults for ScheduleKey tests.
 */
const makeTerminal = (
  overrides: Partial<TerminalIdentity>
): TerminalIdentity => ({
  TerminalID: 1,
  TerminalName: "Anacortes",
  TerminalAbbrev: "ANA",
  IsPassengerTerminal: true,
  Latitude: 48.507351,
  Longitude: -122.677,
  ...overrides,
});

/**
 * Builds a raw WSF vessel-location fixture with sane defaults for conversion tests.
 */
const makeRawLocation = (
  overrides: Partial<WsfVesselLocation>
): WsfVesselLocation =>
  ({
    VesselID: 2,
    VesselName: "Chelan",
    DepartingTerminalID: 1,
    DepartingTerminalName: "Anacortes",
    DepartingTerminalAbbrev: "ANA",
    ArrivingTerminalID: 15,
    ArrivingTerminalName: "Orcas Island",
    ArrivingTerminalAbbrev: "ORI",
    Latitude: 48.5,
    Longitude: -122.6,
    Speed: 12,
    Heading: 180,
    InService: true,
    AtDock: false,
    LeftDock: undefined,
    Eta: undefined,
    ScheduledDeparture: undefined,
    OpRouteAbbrev: ["ana-sj"],
    VesselPositionNum: 1,
    TimeStamp: new Date("2026-03-31T12:00:00-07:00"),
    ...overrides,
  }) as WsfVesselLocation;
