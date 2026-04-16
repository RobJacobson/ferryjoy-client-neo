/**
 * Characterization tests for vessel-location conversion around non-terminal
 * marine facilities.
 */

import { describe, expect, it } from "bun:test";
import type { TerminalIdentity } from "../../../adapters/wsf";
import { toConvexVesselLocation } from "../schemas";

describe("toConvexVesselLocation", () => {
  it("stamps the canonical key when arriving terminal and scheduled departure are present", () => {
    const location = toConvexVesselLocation(
      makeRawLocation({
        ScheduledDeparture: new Date("2026-03-13T05:30:00-07:00"),
      }),
      [
        {
          VesselID: 2,
          VesselName: "Chelan",
          VesselAbbrev: "CHE",
        },
      ],
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

  it("omits key when arriving terminal is missing", () => {
    const location = toConvexVesselLocation(
      makeRawLocation({
        ArrivingTerminalID: undefined,
        ArrivingTerminalAbbrev: undefined,
        ArrivingTerminalName: undefined,
        ScheduledDeparture: new Date("2026-03-13T05:30:00-07:00"),
      }),
      [
        {
          VesselID: 2,
          VesselName: "Chelan",
          VesselAbbrev: "CHE",
        },
      ],
      [makeTerminal({ TerminalID: 1, TerminalAbbrev: "ANA" })]
    );

    expect(location.ScheduleKey).toBeUndefined();
  });

  it("omits key when scheduled departure is missing", () => {
    const location = toConvexVesselLocation(
      makeRawLocation({
        ScheduledDeparture: undefined,
      }),
      [
        {
          VesselID: 2,
          VesselName: "Chelan",
          VesselAbbrev: "CHE",
        },
      ],
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

  it("falls back to raw marine-location values when the terminal abbrev is unknown", () => {
    const location = toConvexVesselLocation(
      makeRawLocation({
        DepartingTerminalAbbrev: "ZZZ",
        DepartingTerminalName: "Mystery Yard",
        ArrivingTerminalAbbrev: "ORI",
        ArrivingTerminalName: "Orcas Island",
      }),
      [
        {
          VesselID: 2,
          VesselName: "Chelan",
          VesselAbbrev: "CHE",
        },
      ],
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

const makeRawLocation = (overrides: Record<string, unknown>) =>
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
  }) as unknown as Parameters<typeof toConvexVesselLocation>[0];
