/**
 * Covers index use, metadata stripping, and ordering for the public predicted
 * list query composition (`readPredictedDockEventsForVesselSailingDay`).
 */

import { describe, expect, it } from "bun:test";
import type { Id } from "_generated/dataModel";
import type { QueryCtx } from "_generated/server";
import { readPredictedDockEventsForVesselSailingDay } from "functions/events/eventsPredicted/queries";
import type { ConvexPredictedDockEvent } from "functions/events/eventsPredicted/schemas";

const at = (hours: number, minutes: number) =>
  Date.UTC(2026, 2, 25, hours, minutes);

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

type PredictedCtxOpts = {
  rows: Array<
    ConvexPredictedDockEvent & {
      _id?: Id<"eventsPredicted">;
      _creationTime?: number;
    }
  >;
  onWithIndex?: (indexName: string) => void;
};

/**
 * Builds a minimal `QueryCtx` for `eventsPredicted` index reads.
 *
 * @param opts - Rows to filter and optional index spy
 * @returns Context suitable for `readPredictedDockEventsForVesselSailingDay`
 */
const makePredictedQueryCtx = (opts: PredictedCtxOpts): QueryCtx =>
  ({
    db: {
      query: (tableName: string) => ({
        withIndex: (
          indexName: string,
          buildRange: (q: {
            eq: (fieldName: string, value: string) => unknown;
          }) => unknown
        ) => {
          opts.onWithIndex?.(indexName);
          if (tableName !== "eventsPredicted") {
            return { collect: async () => [] };
          }
          const range = {
            filters: [] as Array<{ fieldName: string; value: string }>,
            eq(fieldName: string, value: string) {
              this.filters.push({ fieldName, value });
              return this;
            },
          };
          buildRange(range);
          const rows = opts.rows.filter((row) =>
            range.filters.every(
              ({ fieldName, value }) =>
                String((row as Record<string, unknown>)[fieldName]) === value
            )
          );
          return { collect: async () => rows };
        },
      }),
    },
  }) as unknown as QueryCtx;

const args = { vesselAbbrev: "WEN", sailingDay: "2026-03-25" };

describe("listPredictedDockEventsForVesselSailingDay (read + query)", () => {
  it("loads via by_vessel_and_sailing_day", async () => {
    let indexName = "";
    const ctx = makePredictedQueryCtx({
      rows: [],
      onWithIndex: (name) => {
        indexName = name;
      },
    });
    await readPredictedDockEventsForVesselSailingDay(ctx, args);
    expect(indexName).toBe("by_vessel_and_sailing_day");
  });

  it("filters only by vessel and sailing day from the index range", async () => {
    const ctx = makePredictedQueryCtx({
      rows: [
        { ...basePredicted(), VesselAbbrev: "OTH", Key: "k-oth" },
        { ...basePredicted(), Key: "k-wen" },
      ],
    });
    const rows = await readPredictedDockEventsForVesselSailingDay(ctx, args);
    expect(rows.map((r) => r.Key)).toEqual(["k-wen"]);
  });

  it("strips _id and _creationTime from each row", async () => {
    const ctx = makePredictedQueryCtx({
      rows: [
        {
          ...basePredicted(),
          _id: "pred1" as Id<"eventsPredicted">,
          _creationTime: 7,
        },
      ],
    });
    const rows = await readPredictedDockEventsForVesselSailingDay(ctx, args);
    expect(rows).toHaveLength(1);
    expect("_id" in rows[0]).toBe(false);
    expect("_creationTime" in rows[0]).toBe(false);
  });

  it("sorts by ScheduledDeparture then Key", async () => {
    const t1 = at(7, 0);
    const t2 = at(9, 0);
    const ctx = makePredictedQueryCtx({
      rows: [
        { ...basePredicted(), Key: "k-b", ScheduledDeparture: t2 },
        { ...basePredicted(), Key: "k-a", ScheduledDeparture: t1 },
        { ...basePredicted(), Key: "k-c", ScheduledDeparture: t2 },
      ],
    });
    const rows = await readPredictedDockEventsForVesselSailingDay(ctx, args);
    expect(rows.map((r) => r.Key)).toEqual(["k-a", "k-b", "k-c"]);
  });
});
