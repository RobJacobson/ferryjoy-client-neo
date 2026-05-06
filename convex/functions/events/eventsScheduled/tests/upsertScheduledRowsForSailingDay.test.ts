/**
 * Mutation behavior tests for eventsScheduled sailing-day replacement.
 *
 * These tests use a direct MutationCtx mock so the scheduled table can verify
 * index use and write decisions without pulling in sync or planner modules.
 */

import { describe, expect, it } from "bun:test";
import type { Doc, Id } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import { upsertScheduledRowsForSailingDay } from "../mutations";
import type { ConvexScheduledDockEvent } from "../schemas";

type ScheduledDoc = Doc<"eventsScheduled">;

type MockMutationCtx = {
  ctx: MutationCtx;
  queryCalls: Array<{ tableName: string; indexName: string }>;
  deletes: Id<"eventsScheduled">[];
  inserts: Array<{
    tableName: "eventsScheduled";
    row: ConvexScheduledDockEvent;
  }>;
  replacements: Array<{
    id: Id<"eventsScheduled">;
    row: ConvexScheduledDockEvent;
  }>;
};

/**
 * Builds a MutationCtx mock for scheduled table reconciliation.
 *
 * @param rows - Existing scheduled documents visible to the query
 * @returns Mock context and recorded database operations
 */
const makeMutationCtx = (rows: ScheduledDoc[]): MockMutationCtx => {
  const queryCalls: MockMutationCtx["queryCalls"] = [];
  const deletes: MockMutationCtx["deletes"] = [];
  const inserts: MockMutationCtx["inserts"] = [];
  const replacements: MockMutationCtx["replacements"] = [];

  const ctx = {
    db: {
      query: (tableName: string) => ({
        withIndex: (
          indexName: string,
          buildRange: (q: {
            eq: (fieldName: string, value: string) => unknown;
          }) => unknown
        ) => {
          queryCalls.push({ tableName, indexName });
          const range = makeRangeRecorder();
          buildRange(range);
          const matchingRows =
            tableName === "eventsScheduled"
              ? filterRowsByRange(rows, range.filters)
              : [];

          return { collect: async () => matchingRows };
        },
      }),
      delete: async (id: Id<"eventsScheduled">) => {
        deletes.push(id);
      },
      insert: async (
        tableName: "eventsScheduled",
        row: ConvexScheduledDockEvent
      ) => {
        inserts.push({ tableName, row });
      },
      replace: async (
        id: Id<"eventsScheduled">,
        row: ConvexScheduledDockEvent
      ) => {
        replacements.push({ id, row });
      },
    },
  } as unknown as MutationCtx;

  return { ctx, queryCalls, deletes, inserts, replacements };
};

/**
 * Creates a query range recorder compatible with Convex q.eq chaining.
 *
 * @returns Range recorder used by the mutation query mock
 */
const makeRangeRecorder = () => ({
  filters: [] as Array<{ fieldName: string; value: string }>,
  eq(fieldName: string, value: string) {
    this.filters.push({ fieldName, value });
    return this;
  },
});

/**
 * Filters mock documents according to recorded equality filters.
 *
 * @param rows - Candidate documents from the mock table
 * @param filters - Recorded q.eq filters
 * @returns Documents matching every recorded filter
 */
const filterRowsByRange = <Row extends Record<string, unknown>>(
  rows: Row[],
  filters: Array<{ fieldName: string; value: string }>
): Row[] =>
  rows.filter((row) =>
    filters.every(({ fieldName, value }) => row[fieldName] === value)
  );

/**
 * Builds a complete scheduled dock event fixture.
 *
 * @param overrides - Field overrides for the scheduled row
 * @returns Validator-shaped scheduled row
 */
const scheduledRow = (
  overrides: Partial<ConvexScheduledDockEvent> = {}
): ConvexScheduledDockEvent => ({
  Key: "WEN--2026-03-25--08:00--P52-BBI--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  UpdatedAt: 1,
  ScheduledDeparture: 1000,
  TerminalAbbrev: "P52",
  NextTerminalAbbrev: "BBI",
  EventType: "dep-dock",
  EventScheduledTime: 1000,
  ...overrides,
});

/**
 * Builds a stored scheduled document fixture with Convex metadata.
 *
 * @param overrides - Stored row and optional metadata overrides
 * @returns Stored scheduled table document
 */
const scheduledDoc = (
  overrides: Partial<ConvexScheduledDockEvent> & {
    _id?: Id<"eventsScheduled">;
    _creationTime?: number;
  } = {}
): ScheduledDoc =>
  ({
    _id: overrides._id ?? ("scheduled-row" as Id<"eventsScheduled">),
    _creationTime: overrides._creationTime ?? 1,
    ...scheduledRow(overrides),
  }) as ScheduledDoc;

describe("upsertScheduledRowsForSailingDay", () => {
  it("loads existing rows with by_sailing_day", async () => {
    const mock = makeMutationCtx([]);

    await upsertScheduledRowsForSailingDay(mock.ctx, "2026-03-25", []);

    expect(mock.queryCalls).toEqual([
      { tableName: "eventsScheduled", indexName: "by_sailing_day" },
    ]);
  });

  it("deletes stale rows, inserts missing rows, replaces changed rows, and skips unchanged rows", async () => {
    const stale = scheduledDoc({
      _id: "scheduled-stale" as Id<"eventsScheduled">,
      Key: "stale",
    });
    const unchanged = scheduledDoc({
      _id: "scheduled-unchanged" as Id<"eventsScheduled">,
      Key: "unchanged",
    });
    const changed = scheduledDoc({
      _id: "scheduled-changed" as Id<"eventsScheduled">,
      Key: "changed",
      EventScheduledTime: 1000,
    });
    const otherDay = scheduledDoc({
      _id: "scheduled-other-day" as Id<"eventsScheduled">,
      Key: "other-day",
      SailingDay: "2026-03-26",
    });
    const inserted = scheduledRow({ Key: "inserted" });
    const changedNext = scheduledRow({
      Key: "changed",
      EventScheduledTime: 1100,
    });
    const mock = makeMutationCtx([stale, unchanged, changed, otherDay]);

    await upsertScheduledRowsForSailingDay(mock.ctx, "2026-03-25", [
      scheduledRow({ Key: "unchanged" }),
      changedNext,
      inserted,
    ]);

    expect(mock.deletes).toEqual(["scheduled-stale" as Id<"eventsScheduled">]);
    expect(mock.inserts).toEqual([
      { tableName: "eventsScheduled", row: inserted },
    ]);
    expect(mock.replacements).toEqual([
      {
        id: "scheduled-changed" as Id<"eventsScheduled">,
        row: changedNext,
      },
    ]);
  });

  it("ignores Convex metadata when deciding whether to replace", async () => {
    const stored = scheduledDoc({
      _id: "scheduled-stable" as Id<"eventsScheduled">,
      _creationTime: 123,
      Key: "stable",
    });
    const mock = makeMutationCtx([stored]);

    await upsertScheduledRowsForSailingDay(mock.ctx, "2026-03-25", [
      scheduledRow({ Key: "stable" }),
    ]);

    expect(mock.deletes).toEqual([]);
    expect(mock.inserts).toEqual([]);
    expect(mock.replacements).toEqual([]);
  });

  it("compares optional EventScheduledTime and IsLastArrivalOfSailingDay fields", async () => {
    const eventTimeChanged = scheduledDoc({
      _id: "scheduled-time" as Id<"eventsScheduled">,
      Key: "event-time-changed",
      EventScheduledTime: undefined,
    });
    const lastArrivalChanged = scheduledDoc({
      _id: "scheduled-last-arrival" as Id<"eventsScheduled">,
      Key: "last-arrival-changed",
      EventType: "arv-dock",
      IsLastArrivalOfSailingDay: undefined,
    });
    const mock = makeMutationCtx([eventTimeChanged, lastArrivalChanged]);
    const nextEventTime = scheduledRow({
      Key: "event-time-changed",
      EventScheduledTime: 1000,
    });
    const nextLastArrival = scheduledRow({
      Key: "last-arrival-changed",
      EventType: "arv-dock",
      IsLastArrivalOfSailingDay: false,
    });

    await upsertScheduledRowsForSailingDay(mock.ctx, "2026-03-25", [
      nextEventTime,
      nextLastArrival,
    ]);

    expect(mock.replacements).toEqual([
      {
        id: "scheduled-time" as Id<"eventsScheduled">,
        row: nextEventTime,
      },
      {
        id: "scheduled-last-arrival" as Id<"eventsScheduled">,
        row: nextLastArrival,
      },
    ]);
  });
});
