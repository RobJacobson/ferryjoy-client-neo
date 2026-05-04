/**
 * Covers index use, metadata stripping, and ordering for the public scheduled
 * list query composition (`readScheduledDockEventsForVesselSailingDay`).
 */

import { describe, expect, it } from "bun:test";
import type { Id } from "_generated/dataModel";
import type { QueryCtx } from "_generated/server";
import { readScheduledDockEventsForVesselSailingDay } from "functions/events/eventsScheduled/queries";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";

const at = (hours: number, minutes: number) =>
  Date.UTC(2026, 2, 25, hours, minutes);

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
  IsLastArrivalOfSailingDay: false,
});

type ScheduledCtxOpts = {
  rows: Array<
    ConvexScheduledDockEvent & {
      _id?: Id<"eventsScheduled">;
      _creationTime?: number;
    }
  >;
  onWithIndex?: (indexName: string) => void;
};

/**
 * Builds a minimal `QueryCtx` that emulates `by_vessel_and_sailing_day` range
 * queries on `eventsScheduled`.
 *
 * @param opts - Rows to filter and optional index spy
 * @returns Context suitable for `readScheduledDockEventsForVesselSailingDay`
 */
const makeScheduledQueryCtx = (opts: ScheduledCtxOpts): QueryCtx =>
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
          if (tableName !== "eventsScheduled") {
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

describe("listScheduledDockEventsForVesselSailingDay (read + query)", () => {
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

  it("filters only by vessel and sailing day from the index range", async () => {
    const ctx = makeScheduledQueryCtx({
      rows: [
        {
          ...baseScheduled(),
          Key: "other--dep-dock",
          VesselAbbrev: "OTH",
        },
        { ...baseScheduled(), Key: "wen--dep-dock" },
      ],
    });
    const rows = await readScheduledDockEventsForVesselSailingDay(ctx, args);
    expect(rows.map((r) => r.Key)).toEqual(["wen--dep-dock"]);
  });

  it("strips _id and _creationTime from each row", async () => {
    const ctx = makeScheduledQueryCtx({
      rows: [
        {
          ...baseScheduled(),
          _id: "sched1" as Id<"eventsScheduled">,
          _creationTime: 99,
        },
      ],
    });
    const rows = await readScheduledDockEventsForVesselSailingDay(ctx, args);
    expect(rows).toHaveLength(1);
    expect("_id" in rows[0]).toBe(false);
    expect("_creationTime" in rows[0]).toBe(false);
  });

  it("sorts with sortScheduledDockEvents (arv-dock before dep-dock at same boundary)", async () => {
    const t = at(8, 0);
    const ctx = makeScheduledQueryCtx({
      rows: [
        {
          ...baseScheduled(),
          Key: "seg--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "Z",
          ScheduledDeparture: t,
          EventScheduledTime: t,
        },
        {
          ...baseScheduled(),
          Key: "seg--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "A",
          ScheduledDeparture: t,
          EventScheduledTime: t,
        },
      ],
    });
    const rows = await readScheduledDockEventsForVesselSailingDay(ctx, args);
    expect(rows.map((r) => r.Key)).toEqual(["seg--arv-dock", "seg--dep-dock"]);
  });
});
