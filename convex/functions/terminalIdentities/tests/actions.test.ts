/**
 * Characterization tests for backend terminal refresh helpers.
 */

import { describe, expect, it } from "bun:test";
import { mergeKnownMarineLocations } from "adapters/wsf";
import type { TerminalIdentity } from "functions/terminalIdentities/schemas";

describe("mergeKnownMarineLocations", () => {
  it("appends known marine facilities without overriding fetched passenger terminals", () => {
    const updatedAt = 123;
    const merged = mergeKnownMarineLocations(
      [
        makeTerminal({
          TerminalID: 7,
          TerminalAbbrev: "P52",
          TerminalName: "Seattle",
          IsPassengerTerminal: true,
        }),
      ],
      updatedAt
    );

    expect(
      merged.find((terminal) => terminal.TerminalAbbrev === "P52")
    ).toEqual(
      makeTerminal({
        TerminalID: 7,
        TerminalAbbrev: "P52",
        TerminalName: "Seattle",
        IsPassengerTerminal: true,
      })
    );
    expect(
      merged.find((terminal) => terminal.TerminalAbbrev === "EAH")
    ).toEqual(
      expect.objectContaining({
        TerminalID: -1001,
        TerminalAbbrev: "EAH",
        TerminalName: "Eagle Harbor Maintenance Facility",
        IsPassengerTerminal: false,
        UpdatedAt: updatedAt,
      })
    );
    expect(
      merged.find((terminal) => terminal.TerminalAbbrev === "VIG")
    ).toEqual(
      expect.objectContaining({
        TerminalID: -1002,
        TerminalAbbrev: "VIG",
        TerminalName: "Vigor Shipyard",
        IsPassengerTerminal: false,
        UpdatedAt: updatedAt,
      })
    );
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
  UpdatedAt: 1,
  ...overrides,
});
