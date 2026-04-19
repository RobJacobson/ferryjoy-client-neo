/**
 * Tests for historic vessel-location capture using the shared normalization path.
 */

import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as adapters from "adapters";
import * as terminalActions from "functions/terminals/actions";
import * as vesselActions from "functions/vessels/actions";
import type { VesselLocation as WsfVesselLocation } from "ws-dottie/wsf-vessels/core";
import { captureHistoricVesselLocations } from "../actions";

type HistoricActionForTest = {
  _handler: (
    ctx: unknown,
    args: Record<string, never>
  ) => Promise<{ inserted: number }>;
};

afterEach(() => {
  mock.restore();
});

describe("captureHistoricVesselLocations", () => {
  it("normalizes raw WSF rows through the shared domain concern before inserting the snapshot", async () => {
    spyOn(adapters, "fetchRawWsfVesselLocations").mockResolvedValue([
      makeRawLocation(),
    ]);
    spyOn(vesselActions, "loadVesselIdentities").mockResolvedValue([
      { VesselID: 2, VesselName: "Chelan", VesselAbbrev: "CHE" },
    ]);
    spyOn(terminalActions, "loadTerminalIdentities").mockResolvedValue([
      {
        TerminalID: 1,
        TerminalName: "Anacortes",
        TerminalAbbrev: "ANA",
        Latitude: 48.507351,
        Longitude: -122.677,
      },
      {
        TerminalID: 15,
        TerminalName: "Orcas Island",
        TerminalAbbrev: "ORI",
        Latitude: 48.597313,
        Longitude: -122.92935,
      },
    ]);

    const calls: unknown[] = [];
    const ctx = {
      runMutation: async (_mutation: unknown, args: unknown) => {
        calls.push(args);
        return { inserted: 1 };
      },
    };

    const result = await (
      captureHistoricVesselLocations as unknown as HistoricActionForTest
    )._handler(ctx, {});

    expect(result).toEqual({ inserted: 1 });
    expect(calls).toHaveLength(1);
    expect(
      (
        calls[0] as {
          locations: Array<{ VesselAbbrev: string; SailingDay: string }>;
        }
      ).locations[0]?.VesselAbbrev
    ).toBe("CHE");
    expect(
      (calls[0] as { locations: Array<{ ScheduleKey?: string }> }).locations[0]
        ?.ScheduleKey
    ).toBe("CHE--2026-03-13--05:30--ANA-ORI");
  });
});

/**
 * Minimal raw WSF row that exercises the shared historic normalization path.
 */
const makeRawLocation = () =>
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
    ScheduledDeparture: new Date("2026-03-13T05:30:00-07:00"),
    OpRouteAbbrev: ["ana-sj"],
    VesselPositionNum: 1,
    TimeStamp: new Date("2026-03-31T12:00:00-07:00"),
  }) as unknown as WsfVesselLocation;
