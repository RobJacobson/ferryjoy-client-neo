/**
 * Covers index use, metadata stripping, and ordering for the public actual list
 * query composition (`readActualDockEventsForVesselSailingDay`).
 */

import { describe, expect, it } from "bun:test";
import type { Id } from "_generated/dataModel";
import type { QueryCtx } from "_generated/server";
import { readActualDockEventsForVesselSailingDay } from "functions/events/eventsActual/queries";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";

const at = (hours: number, minutes: number) =>
  Date.UTC(2026, 2, 25, hours, minutes);

const baseActual = (): ConvexActualDockEvent => ({
  TripKey: "TST 2026-03-25 12:00:00Z seg",
  EventKey: "ek-dep",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  UpdatedAt: at(6, 0),
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  EventType: "dep-dock",
  EventActualTime: at(8, 5),
  EventOccurred: true,
});

type ActualCtxOpts = {
  rows: Array<
    ConvexActualDockEvent & { _id?: Id<"eventsActual">; _creationTime?: number }
  >;
  onWithIndex?: (indexName: string) => void;
};

/**
 * Builds a minimal `QueryCtx` for `eventsActual` index reads.
 *
 * @param opts - Rows to filter and optional index spy
 * @returns Context suitable for `readActualDockEventsForVesselSailingDay`
 */
const makeActualQueryCtx = (opts: ActualCtxOpts): QueryCtx =>
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
          if (tableName !== "eventsActual") {
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

describe("listActualDockEventsForVesselSailingDay (read + query)", () => {
  it("loads via by_vessel_and_sailing_day", async () => {
    let indexName = "";
    const ctx = makeActualQueryCtx({
      rows: [],
      onWithIndex: (name) => {
        indexName = name;
      },
    });
    await readActualDockEventsForVesselSailingDay(ctx, args);
    expect(indexName).toBe("by_vessel_and_sailing_day");
  });

  it("filters only by vessel and sailing day from the index range", async () => {
    const ctx = makeActualQueryCtx({
      rows: [
        { ...baseActual(), VesselAbbrev: "OTH", EventKey: "ek-oth" },
        { ...baseActual(), EventKey: "ek-wen" },
      ],
    });
    const rows = await readActualDockEventsForVesselSailingDay(ctx, args);
    expect(rows.map((r) => r.EventKey)).toEqual(["ek-wen"]);
  });

  it("strips _id and _creationTime from each row", async () => {
    const ctx = makeActualQueryCtx({
      rows: [
        {
          ...baseActual(),
          _id: "act1" as Id<"eventsActual">,
          _creationTime: 42,
        },
      ],
    });
    const rows = await readActualDockEventsForVesselSailingDay(ctx, args);
    expect(rows).toHaveLength(1);
    expect("_id" in rows[0]).toBe(false);
    expect("_creationTime" in rows[0]).toBe(false);
  });

  it("sorts by ScheduledDeparture then EventKey", async () => {
    const t1 = at(7, 0);
    const t2 = at(9, 0);
    const ctx = makeActualQueryCtx({
      rows: [
        {
          ...baseActual(),
          EventKey: "ek-b",
          ScheduledDeparture: t2,
        },
        {
          ...baseActual(),
          EventKey: "ek-a",
          ScheduledDeparture: t1,
        },
        {
          ...baseActual(),
          EventKey: "ek-c",
          ScheduledDeparture: t2,
        },
      ],
    });
    const rows = await readActualDockEventsForVesselSailingDay(ctx, args);
    expect(rows.map((r) => r.EventKey)).toEqual(["ek-a", "ek-b", "ek-c"]);
  });
});
