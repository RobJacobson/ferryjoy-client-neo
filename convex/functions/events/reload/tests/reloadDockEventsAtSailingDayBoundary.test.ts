/**
 * Action tests for the Pacific-hour boundary reload guard.
 */

import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { ActionCtx } from "_generated/server";
import * as time from "shared/time";
import { reloadDockEventsAtSailingDayBoundary } from "../actions";
import * as sailingDayReload from "../reloadDockEventsForSailingDay";

type BoundaryHandler = (
  ctx: ActionCtx,
  args: { daysToSync?: number }
) => Promise<Record<string, unknown>>;

const boundaryHandler = (
  reloadDockEventsAtSailingDayBoundary as unknown as {
    _handler: BoundaryHandler;
  }
)._handler;

afterEach(() => {
  mock.restore();
});

describe("reloadDockEventsAtSailingDayBoundary", () => {
  it("skips outside Pacific hour three", async () => {
    spyOn(time, "getPacificTimeComponents").mockReturnValue({
      hour: 4,
      minute: 0,
      second: 0,
      dayOfWeek: 0,
    });
    const windowSpy = spyOn(sailingDayReload, "runReloadDockEventsWindow");

    const result = await boundaryHandler({} as ActionCtx, { daysToSync: 2 });

    expect(result).toEqual({
      skipped: true,
      reason: "outside_pacific_3am_window",
      totalScheduled: 0,
      totalActual: 0,
      daysProcessed: [],
    });
    expect(windowSpy).not.toHaveBeenCalled();
  });

  it("runs the window reload during Pacific hour three", async () => {
    spyOn(time, "getPacificTimeComponents").mockReturnValue({
      hour: 3,
      minute: 5,
      second: 0,
      dayOfWeek: 1,
    });
    spyOn(sailingDayReload, "runReloadDockEventsWindow").mockResolvedValue({
      totalScheduled: 4,
      totalActual: 6,
      daysProcessed: [],
    });

    const result = await boundaryHandler({} as ActionCtx, { daysToSync: 2 });

    expect(result).toEqual({
      skipped: false,
      totalScheduled: 4,
      totalActual: 6,
      daysProcessed: [],
    });
  });
});
