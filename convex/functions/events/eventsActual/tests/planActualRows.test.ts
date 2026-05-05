import { describe, expect, it } from "bun:test";
import type { Doc, Id } from "_generated/dataModel";
import {
  dedupeActualRowsByEventKey,
  planActualDockRowUpsert,
  planActualRowsForSailingDayReplacement,
} from "../planActualRows";
import type { ConvexActualDockEvent } from "../schemas";

const baseRow = (
  overrides: Partial<ConvexActualDockEvent> = {}
): ConvexActualDockEvent => ({
  TripKey: "WEN 2026-03-25 trip",
  EventKey: "event-1",
  ScheduleKey: "segment-1",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  UpdatedAt: 1,
  ScheduledDeparture: 1000,
  TerminalAbbrev: "P52",
  EventType: "dep-dock",
  EventActualTime: 1010,
  EventOccurred: true,
  ...overrides,
});

const storedRow = (
  overrides: Partial<ConvexActualDockEvent> & {
    _id?: Id<"eventsActual">;
  } = {}
): Doc<"eventsActual"> =>
  ({
    _id: overrides._id ?? ("actual-1" as Id<"eventsActual">),
    _creationTime: 1,
    ...baseRow(overrides),
  }) as Doc<"eventsActual">;

describe("dedupeActualRowsByEventKey", () => {
  it("keeps the last row for duplicate EventKeys", () => {
    expect(
      dedupeActualRowsByEventKey([
        baseRow({ EventKey: "same", EventActualTime: 1000 }),
        baseRow({ EventKey: "other" }),
        baseRow({ EventKey: "same", EventActualTime: 1100 }),
      ])
    ).toEqual([
      baseRow({ EventKey: "same", EventActualTime: 1100 }),
      baseRow({ EventKey: "other" }),
    ]);
  });
});

describe("planActualDockRowUpsert", () => {
  it("plans insert, skip, and replace outcomes", () => {
    const actualId = "actual-1" as Id<"eventsActual">;
    const row = baseRow();
    const changed = baseRow({ EventActualTime: 1200 });

    expect(planActualDockRowUpsert(undefined, row)).toEqual({
      operation: "insert",
      row,
    });
    expect(planActualDockRowUpsert(storedRow(), row)).toEqual({
      operation: "skip",
    });
    expect(planActualDockRowUpsert(storedRow(), changed)).toEqual({
      operation: "replace",
      existingId: actualId,
      row: changed,
    });
  });
});

describe("planActualRowsForSailingDayReplacement", () => {
  it("deletes stale scheduled rows but preserves ping-only rows", () => {
    const hydrated = baseRow({ EventKey: "hydrated" });
    const staleScheduled = storedRow({
      _id: "actual-stale" as Id<"eventsActual">,
      EventKey: "stale",
      ScheduleKey: "segment-stale",
    });
    const pingOnly = storedRow({
      _id: "actual-ping-only" as Id<"eventsActual">,
      EventKey: "ping-only",
      ScheduleKey: undefined,
    });

    const plan = planActualRowsForSailingDayReplacement(
      [staleScheduled, pingOnly],
      [hydrated, baseRow({ EventKey: "hydrated", EventActualTime: 1200 })]
    );

    expect(plan.deletes).toEqual(["actual-stale" as Id<"eventsActual">]);
    expect(plan.upsertRows).toEqual([
      baseRow({ EventKey: "hydrated", EventActualTime: 1200 }),
    ]);
  });
});
