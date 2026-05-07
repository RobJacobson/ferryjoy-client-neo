/**
 * Internal mutation tests for split dock-event reload persistence.
 */

import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { MutationCtx } from "_generated/server";
import * as eventsActual from "functions/events/eventsActual/mutations";
import * as eventsScheduled from "functions/events/eventsScheduled/mutations";
import {
  reloadActualDockEventsForSailingDay,
  replaceScheduledDockEventsForSailingDay,
} from "../mutations";
import type {
  ConvexReloadDockData,
  ConvexReloadDockScheduleData,
} from "../reloadDockDataSchemas";

type ActualHandler = (
  ctx: MutationCtx,
  args: { ReloadDockData: ConvexReloadDockData }
) => Promise<{ ActualCount: number }>;

type ScheduledHandler = (
  ctx: MutationCtx,
  args: { ReloadDockScheduleData: ConvexReloadDockScheduleData }
) => Promise<{ ScheduledCount: number }>;

afterEach(() => {
  mock.restore();
});

describe("split dock-event reload mutations", () => {
  it("delegates scheduled and actual reloads to the matching table helpers", async () => {
    const scheduledSpy = spyOn(
      eventsScheduled,
      "upsertScheduledRowsForSailingDay"
    ).mockResolvedValue(undefined);
    const actualSpy = spyOn(
      eventsActual,
      "replaceActualRowsForSailingDay"
    ).mockResolvedValue(undefined);
    const ctx = makeEmptyDbMutationCtx();

    const scheduled = await handler<ScheduledHandler>(
      replaceScheduledDockEventsForSailingDay
    )(ctx, {
      ReloadDockScheduleData: {
        SailingDay: "2026-04-10",
        ScheduleSegments: [],
      },
    });
    const actual = await handler<ActualHandler>(
      reloadActualDockEventsForSailingDay
    )(ctx, {
      ReloadDockData: {
        SailingDay: "2026-04-10",
        ScheduleSegments: [],
        HistoryRecords: [],
      },
    });

    expect(scheduled).toEqual({ ScheduledCount: 0 });
    expect(actual).toEqual({ ActualCount: 0 });
    expect(scheduledSpy).toHaveBeenCalledTimes(1);
    expect(scheduledSpy).toHaveBeenCalledWith(ctx, "2026-04-10", []);
    expect(actualSpy).toHaveBeenCalledTimes(1);
    expect(actualSpy).toHaveBeenCalledWith(ctx, "2026-04-10", [], {
      preserveAbsentTripKeys: new Set(),
    });
  });
});

/**
 * Reads a Convex test handler from an action or mutation reference.
 *
 * @param entrypoint - Convex function object exposed to tests
 * @returns Underlying handler with the requested type
 */
const handler = <Handler>(entrypoint: unknown): Handler =>
  (entrypoint as { _handler: Handler })._handler;

/**
 * Creates a MutationCtx mock whose table reads all return empty arrays.
 *
 * @returns Stub context for empty reload payload tests
 */
const makeEmptyDbMutationCtx = (): MutationCtx =>
  ({
    db: {
      query: () => ({
        withIndex: (
          _indexName: string,
          _buildRange: (q: {
            eq: (fieldName: string, value: string) => unknown;
          }) => unknown
        ) => ({
          collect: async () => [],
        }),
        collect: async () => [],
      }),
    },
  }) as unknown as MutationCtx;
