/**
 * Covers multi-day aggregation for windowed dock-event reload helpers.
 */

import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { ActionCtx } from "_generated/server";
import * as reloadDay from "../reloadDockEventsForSailingDay";
import { runReloadDockEventsWindow } from "../reloadDockEventsWindow";

const fixedClockMs = Date.parse("2026-05-10T16:00:00.000Z");

afterEach(() => {
  mock.restore();
});

describe("runReloadDockEventsWindow", () => {
  it("reloads each sailing day in the window and aggregates counts", async () => {
    const OriginalDate = Date;
    const PatchedDate = function (this: unknown, ...args: unknown[]) {
      if (args.length === 0) {
        return new OriginalDate(fixedClockMs);
      }
      return new OriginalDate(...(args as [number | string | Date]));
    } as unknown as DateConstructor;
    spyOn(globalThis, "Date").mockImplementation(PatchedDate);
    Object.assign(globalThis.Date, {
      UTC: OriginalDate.UTC,
      parse: OriginalDate.parse,
      now: () => fixedClockMs,
    });

    const daySpy = spyOn(
      reloadDay,
      "runReloadDockEventsForSailingDay"
    ).mockImplementation(async (_ctx, sailingDay) => {
      if (sailingDay === "2026-05-10") {
        return { ScheduledCount: 2, ActualCount: 1 };
      }
      if (sailingDay === "2026-05-11") {
        return { ScheduledCount: 3, ActualCount: 4 };
      }
      return { ScheduledCount: 0, ActualCount: 0 };
    });

    const result = await runReloadDockEventsWindow({} as ActionCtx, 2);

    expect(daySpy).toHaveBeenCalledTimes(2);
    expect(daySpy.mock.calls.map((c) => c[1])).toEqual([
      "2026-05-10",
      "2026-05-11",
    ]);
    expect(result).toEqual({
      totalScheduled: 5,
      totalActual: 5,
      daysProcessed: [
        {
          sailingDay: "2026-05-10",
          scheduledCount: 2,
          actualCount: 1,
        },
        {
          sailingDay: "2026-05-11",
          scheduledCount: 3,
          actualCount: 4,
        },
      ],
    });
  });
});
