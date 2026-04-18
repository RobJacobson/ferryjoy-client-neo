/**
 * Characterization tests for backend terminals topology derivation.
 */

import { describe, expect, it } from "bun:test";
import { buildTerminalTopologyRows } from "adapters";
import type { TerminalIdentity } from "functions/terminals/schemas";

describe("buildTerminalTopologyRows", () => {
  it("merges mates, aggregate routes, and triangle normalization by terminal", () => {
    const topology = buildTerminalTopologyRows(
      [
        makeTerminal({
          TerminalID: 7,
          TerminalAbbrev: "P52",
          TerminalName: "Seattle",
        }),
        makeTerminal({
          TerminalID: 3,
          TerminalAbbrev: "BBI",
          TerminalName: "Bainbridge Island",
        }),
        makeTerminal({
          TerminalID: 9,
          TerminalAbbrev: "FAU",
          TerminalName: "Fauntleroy",
        }),
        makeTerminal({
          TerminalID: 20,
          TerminalAbbrev: "SOU",
          TerminalName: "Southworth",
        }),
        makeTerminal({
          TerminalID: 22,
          TerminalAbbrev: "VAI",
          TerminalName: "Vashon Island",
        }),
      ],
      [
        { DepartingTerminalID: 7, ArrivingTerminalID: 3 },
        { DepartingTerminalID: 9, ArrivingTerminalID: 20 },
        { DepartingTerminalID: 9, ArrivingTerminalID: 22 },
      ],
      new Map([
        ["7:3", ["sea-bi"]],
        ["9:20", ["f-v-s"]],
        ["9:22", ["f-v-s"]],
      ]),
      123
    );

    expect(topology.find((row) => row.TerminalAbbrev === "P52")).toEqual({
      TerminalAbbrev: "P52",
      TerminalMates: ["BBI"],
      RouteAbbrevs: ["sea-bi"],
      RouteAbbrevsByArrivingTerminal: {
        BBI: ["sea-bi"],
      },
      UpdatedAt: 123,
    });
    expect(topology.find((row) => row.TerminalAbbrev === "FAU")).toEqual({
      TerminalAbbrev: "FAU",
      TerminalMates: ["SOU", "VAI"],
      RouteAbbrevs: ["f-v-s"],
      RouteAbbrevsByArrivingTerminal: {
        SOU: ["f-v-s"],
        VAI: ["f-v-s"],
      },
      UpdatedAt: 123,
    });
  });
});

/**
 * Build one canonical terminal row for tests.
 *
 * @param overrides - Terminal field overrides
 * @returns Concrete terminal row
 */
const makeTerminal = (
  overrides: Partial<TerminalIdentity>
): TerminalIdentity => ({
  TerminalID: 1,
  TerminalName: "Anacortes",
  TerminalAbbrev: "ANA",
  Latitude: 48.507351,
  Longitude: -122.677,
  UpdatedAt: 1,
  ...overrides,
});
