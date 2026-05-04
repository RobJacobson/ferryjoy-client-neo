/**
 * Verifies the internal reload mutation delegates to scheduled and actual table writers.
 */

import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { MutationCtx } from "_generated/server";
import * as eventsActual from "functions/events/eventsActual/mutations";
import * as eventsScheduled from "functions/events/eventsScheduled/mutations";
import { replaceDockEventsForSailingDay } from "../mutations";

type ReplaceHandler = (
  ctx: MutationCtx,
  args: { SailingDay: string; Events: unknown[] }
) => Promise<{ ScheduledCount: number; ActualCount: number }>;

const replaceHandler = (
  replaceDockEventsForSailingDay as unknown as { _handler: ReplaceHandler }
)._handler;

afterEach(() => {
  mock.restore();
});

describe("replaceDockEventsForSailingDay (internal)", () => {
  it("upserts scheduled rows and replaces actual rows for the same sailing day", async () => {
    const scheduledSpy = spyOn(
      eventsScheduled,
      "upsertScheduledRowsForSailingDay"
    ).mockResolvedValue(undefined);
    const actualSpy = spyOn(
      eventsActual,
      "replaceActualRowsForSailingDay"
    ).mockResolvedValue(undefined);

    const result = await replaceHandler(makeEmptyDbMutationCtx(), {
      SailingDay: "2026-04-10",
      Events: [],
    });

    expect(result).toEqual({ ScheduledCount: 0, ActualCount: 0 });
    expect(scheduledSpy).toHaveBeenCalledWith(
      expect.anything(),
      "2026-04-10",
      []
    );
    expect(actualSpy).toHaveBeenCalledWith(expect.anything(), "2026-04-10", []);
  });
});

/**
 * Returns a `MutationCtx` whose `db` queries always return no rows, which is
 * enough for the trip index and live-location inputs used by reload.
 *
 * @returns Stub context for replace handler tests
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
