/**
 * Query behavior tests for eventsActual vessel/day reads.
 *
 * These tests exercise the public query handler contract without exporting a
 * reference-only internal reader from the actual table module.
 */

import { describe, expect, it } from "bun:test";
import type { Id } from "_generated/dataModel";
import type { QueryCtx } from "_generated/server";
import { listActualDockEventsForVesselSailingDay } from "functions/events/eventsActual/queries";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";

type ActualDoc = ConvexActualDockEvent & {
  _id?: Id<"eventsActual">;
  _creationTime?: number;
};

type MockQueryOptions = {
  rows: ActualDoc[];
  onWithIndex?: (indexName: string) => void;
};

type RegisteredQuery<TArgs, TReturn> = {
  _handler: (ctx: QueryCtx, args: TArgs) => Promise<TReturn>;
};

const args = { vesselAbbrev: "WEN", sailingDay: "2026-03-25" };

/**
 * Invokes a Convex registered query handler in unit tests.
 *
 * @param queryRef - Registered query object
 * @param ctx - Mock query context
 * @param queryArgs - Query arguments
 * @returns Query handler result
 */
const invokeRegisteredQuery = <TArgs, TReturn>(
  queryRef: unknown,
  ctx: QueryCtx,
  queryArgs: TArgs
): Promise<TReturn> =>
  (queryRef as RegisteredQuery<TArgs, TReturn>)._handler(ctx, queryArgs);

/**
 * Builds a minimal query context for eventsActual index reads.
 *
 * @param options - Rows to filter and optional index spy
 * @returns Query context for the actual list query
 */
const makeActualQueryCtx = (options: MockQueryOptions): QueryCtx =>
  ({
    db: {
      query: (tableName: string) => ({
        withIndex: (
          indexName: string,
          buildRange: (q: {
            eq: (fieldName: string, value: string) => unknown;
          }) => unknown
        ) => {
          options.onWithIndex?.(indexName);
          const range = makeRangeRecorder();
          buildRange(range);
          const rows =
            tableName === "eventsActual"
              ? filterRowsByRange(options.rows, range.filters)
              : [];

          return { collect: async () => rows };
        },
      }),
    },
  }) as unknown as QueryCtx;

/**
 * Creates a range recorder compatible with Convex q.eq chaining.
 *
 * @returns Range recorder used by mock withIndex callbacks
 */
const makeRangeRecorder = () => ({
  filters: [] as Array<{ fieldName: string; value: string }>,
  eq(fieldName: string, value: string) {
    this.filters.push({ fieldName, value });
    return this;
  },
});

/**
 * Filters mock rows according to recorded q.eq calls.
 *
 * @param rows - Rows available in the mock table
 * @param filters - Recorded equality filters
 * @returns Rows matching all filters
 */
const filterRowsByRange = <Row extends Record<string, unknown>>(
  rows: Row[],
  filters: Array<{ fieldName: string; value: string }>
): Row[] =>
  rows.filter((row) =>
    filters.every(({ fieldName, value }) => row[fieldName] === value)
  );

/**
 * Builds a UTC timestamp for compact test fixtures.
 *
 * @param hours - UTC hour
 * @param minutes - UTC minute
 * @returns Epoch milliseconds
 */
const at = (hours: number, minutes: number): number =>
  Date.UTC(2026, 2, 25, hours, minutes);

/**
 * Builds a complete actual dock event fixture.
 *
 * @returns Actual dock event row
 */
const baseActual = (): ConvexActualDockEvent => ({
  EventKey: "trip-1--dep-dock",
  TripKey: "trip-1",
  EventType: "dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  UpdatedAt: at(6, 0),
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  EventOccurred: true,
  EventActualTime: at(8, 5),
});

describe("listActualDockEventsForVesselSailingDay", () => {
  it("loads via by_vessel_and_sailing_day", async () => {
    let indexName = "";
    const ctx = makeActualQueryCtx({
      rows: [],
      onWithIndex: (name) => {
        indexName = name;
      },
    });

    await invokeRegisteredQuery<typeof args, ConvexActualDockEvent[]>(
      listActualDockEventsForVesselSailingDay,
      ctx,
      args
    );

    expect(indexName).toBe("by_vessel_and_sailing_day");
  });

  it("filters rows by vessel and sailing day", async () => {
    const ctx = makeActualQueryCtx({
      rows: [
        { ...baseActual(), EventKey: "other-vessel", VesselAbbrev: "OTH" },
        { ...baseActual(), EventKey: "other-day", SailingDay: "2026-03-26" },
        { ...baseActual(), EventKey: "matching-row" },
      ],
    });

    const rows = await invokeRegisteredQuery<
      typeof args,
      ConvexActualDockEvent[]
    >(listActualDockEventsForVesselSailingDay, ctx, args);

    expect(rows.map((row) => row.EventKey)).toEqual(["matching-row"]);
  });

  it("strips Convex metadata from returned rows", async () => {
    const ctx = makeActualQueryCtx({
      rows: [
        {
          ...baseActual(),
          _id: "actual1" as Id<"eventsActual">,
          _creationTime: 25,
        },
      ],
    });

    const rows = await invokeRegisteredQuery<
      typeof args,
      ConvexActualDockEvent[]
    >(listActualDockEventsForVesselSailingDay, ctx, args);

    expect("_id" in rows[0]).toBe(false);
    expect("_creationTime" in rows[0]).toBe(false);
  });

  it("sorts by ScheduledDeparture then EventKey", async () => {
    const ctx = makeActualQueryCtx({
      rows: [
        { ...baseActual(), EventKey: "event-b", ScheduledDeparture: at(9, 0) },
        { ...baseActual(), EventKey: "event-a", ScheduledDeparture: at(7, 0) },
        { ...baseActual(), EventKey: "event-c", ScheduledDeparture: at(9, 0) },
      ],
    });

    const rows = await invokeRegisteredQuery<
      typeof args,
      ConvexActualDockEvent[]
    >(listActualDockEventsForVesselSailingDay, ctx, args);

    expect(rows.map((row) => row.EventKey)).toEqual([
      "event-a",
      "event-b",
      "event-c",
    ]);
  });
});
