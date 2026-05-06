/**
 * Query behavior tests for eventsPredicted vessel/day reads.
 *
 * Tests cover the public list query and the grouped trip loader used by vessel
 * trip API enrichment.
 */

import { describe, expect, it } from "bun:test";
import type { Id } from "_generated/dataModel";
import type { QueryCtx } from "_generated/server";
import {
  listPredictedDockEventsForVesselSailingDay,
  loadPredictedRowsGroupedForTrips,
} from "functions/events/eventsPredicted/queries";
import type { ConvexPredictedDockEvent } from "functions/events/eventsPredicted/schemas";
import { buildVesselSailingDayScopeKey } from "shared/keys";

type PredictedDoc = ConvexPredictedDockEvent & {
  _id?: Id<"eventsPredicted">;
  _creationTime?: number;
};

type MockQueryOptions = {
  rows: PredictedDoc[];
  onCollect?: (scope: { vesselAbbrev: string; sailingDay: string }) => void;
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
 * Builds a minimal query context for eventsPredicted index reads.
 *
 * @param options - Rows to filter and optional spies
 * @returns Query context for predicted query behavior tests
 */
const makePredictedQueryCtx = (options: MockQueryOptions): QueryCtx =>
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
            tableName === "eventsPredicted"
              ? filterRowsByRange(options.rows, range.filters)
              : [];

          return {
            collect: async () => {
              const vesselAbbrev = range.filters.find(
                (filter) => filter.fieldName === "VesselAbbrev"
              )?.value;
              const sailingDay = range.filters.find(
                (filter) => filter.fieldName === "SailingDay"
              )?.value;

              if (vesselAbbrev !== undefined && sailingDay !== undefined) {
                options.onCollect?.({ vesselAbbrev, sailingDay });
              }

              return rows;
            },
          };
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
 * Builds a complete predicted dock event fixture.
 *
 * @returns Predicted dock event row
 */
const basePredicted = (): ConvexPredictedDockEvent => ({
  Key: "trip-1--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  UpdatedAt: at(6, 0),
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  EventPredictedTime: at(8, 5),
  PredictionType: "AtDockDepartCurr",
  PredictionSource: "ml",
});

describe("listPredictedDockEventsForVesselSailingDay", () => {
  it("loads via by_vessel_and_sailing_day", async () => {
    let indexName = "";
    const ctx = makePredictedQueryCtx({
      rows: [],
      onWithIndex: (name) => {
        indexName = name;
      },
    });

    await invokeRegisteredQuery<typeof args, ConvexPredictedDockEvent[]>(
      listPredictedDockEventsForVesselSailingDay,
      ctx,
      args
    );

    expect(indexName).toBe("by_vessel_and_sailing_day");
  });

  it("filters rows by vessel and sailing day", async () => {
    const ctx = makePredictedQueryCtx({
      rows: [
        { ...basePredicted(), Key: "other-vessel", VesselAbbrev: "OTH" },
        { ...basePredicted(), Key: "other-day", SailingDay: "2026-03-26" },
        { ...basePredicted(), Key: "matching-row" },
      ],
    });

    const rows = await invokeRegisteredQuery<
      typeof args,
      ConvexPredictedDockEvent[]
    >(listPredictedDockEventsForVesselSailingDay, ctx, args);

    expect(rows.map((row) => row.Key)).toEqual(["matching-row"]);
  });

  it("strips Convex metadata from returned rows", async () => {
    const ctx = makePredictedQueryCtx({
      rows: [
        {
          ...basePredicted(),
          _id: "predicted1" as Id<"eventsPredicted">,
          _creationTime: 25,
        },
      ],
    });

    const rows = await invokeRegisteredQuery<
      typeof args,
      ConvexPredictedDockEvent[]
    >(listPredictedDockEventsForVesselSailingDay, ctx, args);

    expect("_id" in rows[0]).toBe(false);
    expect("_creationTime" in rows[0]).toBe(false);
  });

  it("sorts by ScheduledDeparture then Key", async () => {
    const ctx = makePredictedQueryCtx({
      rows: [
        { ...basePredicted(), Key: "key-b", ScheduledDeparture: at(9, 0) },
        { ...basePredicted(), Key: "key-a", ScheduledDeparture: at(7, 0) },
        { ...basePredicted(), Key: "key-c", ScheduledDeparture: at(9, 0) },
      ],
    });

    const rows = await invokeRegisteredQuery<
      typeof args,
      ConvexPredictedDockEvent[]
    >(listPredictedDockEventsForVesselSailingDay, ctx, args);

    expect(rows.map((row) => row.Key)).toEqual(["key-a", "key-b", "key-c"]);
  });
});

describe("loadPredictedRowsGroupedForTrips", () => {
  it("loads each scope once and groups by composite prediction key", async () => {
    const collectedScopes: string[] = [];
    const ctx = makePredictedQueryCtx({
      rows: [
        {
          ...basePredicted(),
          Key: "boundary-a",
          PredictionType: "AtDockDepartCurr",
          PredictionSource: "ml",
        },
        {
          ...basePredicted(),
          Key: "boundary-a",
          PredictionType: "AtSeaArriveNext",
          PredictionSource: "ml",
        },
        {
          ...basePredicted(),
          Key: "boundary-b",
          VesselAbbrev: "KLA",
          SailingDay: "2026-03-26",
        },
      ],
      onCollect: (scope) => {
        collectedScopes.push(
          buildVesselSailingDayScopeKey(scope.vesselAbbrev, scope.sailingDay)
        );
      },
    });

    const grouped = await loadPredictedRowsGroupedForTrips(ctx, [
      { VesselAbbrev: "WEN", SailingDay: "2026-03-25" },
      { VesselAbbrev: "WEN", SailingDay: "2026-03-25" },
      { VesselAbbrev: "WEN" },
      { VesselAbbrev: "KLA", SailingDay: "2026-03-26" },
    ]);

    const wenScope = buildVesselSailingDayScopeKey("WEN", "2026-03-25");
    const klaScope = buildVesselSailingDayScopeKey("KLA", "2026-03-26");

    expect(collectedScopes).toEqual([wenScope, klaScope]);
    expect(
      grouped.get(wenScope)?.get("boundary-a|AtDockDepartCurr|ml")?.Key
    ).toBe("boundary-a");
    expect(
      grouped.get(wenScope)?.get("boundary-a|AtSeaArriveNext|ml")?.Key
    ).toBe("boundary-a");
    expect(
      grouped.get(klaScope)?.get("boundary-b|AtDockDepartCurr|ml")?.Key
    ).toBe("boundary-b");
  });
});
