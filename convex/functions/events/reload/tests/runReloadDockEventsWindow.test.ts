/**
 * Sync action-helper tests for windowed dock-event reload aggregation.
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
  it("defaults to two sailing days and aggregates counts", async () => {
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
    ).mockImplementation(async (_ctx, sailingDay) =>
      sailingDay === "2026-05-10"
        ? { scheduledCount: 2, actualCount: 1 }
        : { scheduledCount: 3, actualCount: 4 }
    );

    const result = await runReloadDockEventsWindow({} as ActionCtx);

    expect(daySpy.mock.calls.map((call) => call[1])).toEqual([
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
