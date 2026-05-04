/**
 * Verifies single-day reload delegates persistence to the replace mutation
 * with a Convex reload payload built from fetched slices.
 */

import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { ActionCtx } from "_generated/server";
import * as adapters from "adapters";
import * as terminalActions from "functions/terminals/actions";
import * as vesselActions from "functions/vessels/actions";
import * as fetchHistory from "../fetchHistoryRecordsForDate";
import { runReloadDockEventsForSailingDay } from "../reloadDockEventsForSailingDay";

afterEach(() => {
  mock.restore();
});

describe("runReloadDockEventsForSailingDay", () => {
  it("calls replaceDockEventsForSailingDay with a ConvexReloadDockData payload for the target date", async () => {
    spyOn(console, "log").mockImplementation(() => {});
    spyOn(adapters, "fetchAndTransformScheduledTrips").mockResolvedValue({
      routes: [],
      routeData: [],
      rawTrips: [],
      finalTrips: [],
      totalIndirect: 0,
    });
    spyOn(vesselActions, "loadVesselIdentities").mockResolvedValue([]);
    spyOn(terminalActions, "loadTerminalIdentities").mockResolvedValue([]);
    spyOn(fetchHistory, "fetchHistoryRecordsForDate").mockResolvedValue([]);

    const mutationPayloads: unknown[] = [];
    const ctx = {
      runMutation: async (_ref: unknown, args: unknown) => {
        mutationPayloads.push(args);
        return { ScheduledCount: 0, ActualCount: 0 };
      },
    } as unknown as ActionCtx;

    await runReloadDockEventsForSailingDay(ctx, "2026-07-04");

    expect(mutationPayloads).toHaveLength(1);
    expect(mutationPayloads[0]).toEqual({
      ReloadDockData: {
        SailingDay: "2026-07-04",
        ScheduleSegments: [],
        HistoryRecords: [],
      },
    });
  });
});
