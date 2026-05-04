/**
 * Covers Pacific-hour guard behavior for the cron-backed boundary reload action.
 */

import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { ActionCtx } from "_generated/server";
import * as time from "../../../../shared/time";
import { reloadDockEventsAtSailingDayBoundary } from "../actions";
import * as windowReload from "../reloadDockEventsWindow";

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
  it("skips outside the Pacific 3 AM hour", async () => {
    spyOn(time, "getPacificTimeComponents").mockReturnValue({
      hour: 4,
      minute: 0,
      second: 0,
      dayOfWeek: 0,
    });
    const windowSpy = spyOn(windowReload, "runReloadDockEventsWindow");

    const result = await boundaryHandler({} as ActionCtx, { daysToSync: 2 });

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("outside_pacific_3am_window");
    expect(windowSpy).not.toHaveBeenCalled();
  });

  it("runs the windowed reload during the Pacific 3 AM hour", async () => {
    spyOn(time, "getPacificTimeComponents").mockReturnValue({
      hour: 3,
      minute: 5,
      second: 0,
      dayOfWeek: 1,
    });
    spyOn(windowReload, "runReloadDockEventsWindow").mockResolvedValue({
      totalScheduled: 4,
      totalActual: 6,
      daysProcessed: [],
    });

    const result = await boundaryHandler({} as ActionCtx, { daysToSync: 2 });

    expect(result.skipped).toBe(false);
    expect(result.totalScheduled).toBe(4);
    expect(result.totalActual).toBe(6);
  });
});
