import { describe, expect, it } from "bun:test";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import {
  getPassengerTerminalAbbrevs,
  isPassengerTerminalAbbrev,
  isTripEligibleLocation,
} from "../updateVesselTrips";

describe("vesselOrchestration passenger terminal helpers", () => {
  it("treats passenger terminal membership as simple set membership", () => {
    const passengerTerminalAbbrevs = getPassengerTerminalAbbrevs([
      { TerminalAbbrev: "ANA", IsPassengerTerminal: true },
      { TerminalAbbrev: "ORI", IsPassengerTerminal: true },
      { TerminalAbbrev: "EAH", IsPassengerTerminal: false },
    ]);

    expect(isPassengerTerminalAbbrev("ANA", passengerTerminalAbbrevs)).toBe(
      true
    );
    expect(isPassengerTerminalAbbrev("EAH", passengerTerminalAbbrevs)).toBe(
      false
    );
  });

  it("allows trip processing for passenger-terminal locations", () => {
    const passengerTerminalAbbrevs = new Set(["ANA", "ORI"]);

    expect(
      isTripEligibleLocation(makeLocation(), passengerTerminalAbbrevs)
    ).toBe(true);
    expect(
      isTripEligibleLocation(
        makeLocation({ ArrivingTerminalAbbrev: undefined }),
        passengerTerminalAbbrevs
      )
    ).toBe(true);
  });

  it("rejects trip processing when either terminal is not a passenger terminal", () => {
    const passengerTerminalAbbrevs = new Set(["ANA", "ORI"]);

    expect(
      isTripEligibleLocation(
        makeLocation({ DepartingTerminalAbbrev: "EAH" }),
        passengerTerminalAbbrevs
      )
    ).toBe(false);
    expect(
      isTripEligibleLocation(
        makeLocation({ ArrivingTerminalAbbrev: "EAH" }),
        passengerTerminalAbbrevs
      )
    ).toBe(false);
  });
});

const makeLocation = (
  overrides: Partial<ConvexVesselLocation> = {}
): ConvexVesselLocation => ({
  VesselID: 2,
  VesselName: "Chelan",
  VesselAbbrev: "CHE",
  DepartingTerminalID: 1,
  DepartingTerminalName: "Anacortes",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalID: 15,
  ArrivingTerminalName: "Orcas Island",
  ArrivingTerminalAbbrev: "ORI",
  Latitude: 48,
  Longitude: -122,
  Speed: 0,
  Heading: 0,
  InService: true,
  AtDock: true,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: undefined,
  RouteAbbrev: "ana-sj",
  VesselPositionNum: 1,
  TimeStamp: new Date("2026-03-13T03:08:47-07:00").getTime(),
  ScheduleKey: undefined,
  DepartingDistance: 0,
  ArrivingDistance: undefined,
  ...overrides,
});
