/**
 * Tests for runReloadDockEventsForSailingDay.
 *
 * Mocks adapter and identity seams; asserts reseed mutation payloads from the
 * public orchestration entrypoint only.
 */

import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { ActionCtx } from "_generated/server";
import * as adapters from "adapters";
import * as terminalActions from "functions/terminals/actions";
import * as vesselActions from "functions/vessels/actions";
import * as reloadSailingDay from "../reloadDockEventsForSailingDay";

afterEach(() => {
  mock.restore();
});

describe("runReloadDockEventsForSailingDay", () => {
  it("calls unified reseed mutation with hydrated dock status events", async () => {
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

    const mutationPayloads: unknown[] = [];
    const ctx = {
      runMutation: async (_ref: unknown, args: unknown) => {
        mutationPayloads.push(args);
        return { scheduledCount: 0, actualCount: 0 };
      },
    } as unknown as ActionCtx;

    const result = await reloadSailingDay.runReloadDockEventsForSailingDay(
      ctx,
      "2026-07-04"
    );

    expect(result).toEqual({ scheduledCount: 0, actualCount: 0 });
    expect(mutationPayloads).toEqual([
      {
        SailingDay: "2026-07-04",
        Events: [],
      },
    ]);
  });
});
