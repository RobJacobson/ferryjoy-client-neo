/**
 * Query behavior tests for eventsScheduled vessel/day reads.
 *
 * These tests cover the Stage 2 contract: indexed scope reads, Convex metadata
 * stripping, and stable scheduled dock ordering.
 */

import { describe, expect, it } from "bun:test";
import type { Id } from "_generated/dataModel";
import type { QueryCtx } from "_generated/server";
import { readScheduledDockEventsForVesselSailingDay } from "functions/events/eventsScheduled/queries";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";

type ScheduledDoc = ConvexScheduledDockEvent & {
  _id?: Id<"eventsScheduled">;
  _creationTime?: number;
};

type MockQueryOptions = {
  rows: ScheduledDoc[];
  onWithIndex?: (indexName: string) => void;
};

const args = { vesselAbbrev: "WEN", sailingDay: "2026-03-25" };

/**
 * Builds a minimal query context for eventsScheduled index reads.
 *
 * @param options - Rows to filter and optional index spy
 * @returns Query context for the scheduled reader
 */
const makeScheduledQueryCtx = (options: MockQueryOptions): QueryCtx =>
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
            tableName === "eventsScheduled"
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
 * Builds a complete scheduled dock event fixture.
 *
 * @returns Scheduled dock event row
 */
const baseScheduled = (): ConvexScheduledDockEvent => ({
  Key: "trip-1--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  UpdatedAt: at(6, 0),
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  NextTerminalAbbrev: "BBI",
  EventType: "dep-dock",
  EventScheduledTime: at(8, 0),
});

describe("readScheduledDockEventsForVesselSailingDay", () => {
  it("loads via by_vessel_and_sailing_day", async () => {
    let indexName = "";
    const ctx = makeScheduledQueryCtx({
      rows: [],
      onWithIndex: (name) => {
        indexName = name;
      },
    });

    await readScheduledDockEventsForVesselSailingDay(ctx, args);

    expect(indexName).toBe("by_vessel_and_sailing_day");
  });

  it("filters rows by vessel and sailing day", async () => {
    const ctx = makeScheduledQueryCtx({
      rows: [
        { ...baseScheduled(), Key: "other-vessel", VesselAbbrev: "OTH" },
        { ...baseScheduled(), Key: "other-day", SailingDay: "2026-03-26" },
        { ...baseScheduled(), Key: "matching-row" },
      ],
    });

    const rows = await readScheduledDockEventsForVesselSailingDay(ctx, args);

    expect(rows.map((row) => row.Key)).toEqual(["matching-row"]);
  });

  it("strips Convex metadata from returned rows", async () => {
    const ctx = makeScheduledQueryCtx({
      rows: [
        {
          ...baseScheduled(),
          _id: "scheduled1" as Id<"eventsScheduled">,
          _creationTime: 25,
        },
      ],
    });

    const rows = await readScheduledDockEventsForVesselSailingDay(ctx, args);

    expect("_id" in rows[0]).toBe(false);
    expect("_creationTime" in rows[0]).toBe(false);
  });

  it("sorts equal boundary times with arrivals before departures", async () => {
    const boundaryTime = at(8, 0);
    const ctx = makeScheduledQueryCtx({
      rows: [
        {
          ...baseScheduled(),
          Key: "same-time-dep",
          EventType: "dep-dock",
          EventScheduledTime: boundaryTime,
        },
        {
          ...baseScheduled(),
          Key: "later-dep",
          EventScheduledTime: at(9, 0),
          ScheduledDeparture: at(9, 0),
        },
        {
          ...baseScheduled(),
          Key: "same-time-arv",
          EventType: "arv-dock",
          EventScheduledTime: boundaryTime,
        },
      ],
    });

    const rows = await readScheduledDockEventsForVesselSailingDay(ctx, args);

    expect(rows.map((row) => row.Key)).toEqual([
      "same-time-arv",
      "same-time-dep",
      "later-dep",
    ]);
  });
});
