/**
 * Mutation behavior tests for eventsActual sparse upserts.
 *
 * The tests use a direct MutationCtx mock to verify EventKey lookup, unique
 * reads, last-row-wins dedupe, and stable skip behavior at the table boundary.
 */

import { describe, expect, it } from "bun:test";
import type { Doc, Id } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import { upsertActualDockRows } from "../mutations";
import type { ConvexActualDockEvent } from "../schemas";

type ActualDoc = Doc<"eventsActual">;

type QueryCall = {
  tableName: string;
  indexName: string;
  filters: Array<{ fieldName: string; value: string }>;
  terminal: "unique";
};

type MockMutationCtx = {
  ctx: MutationCtx;
  queryCalls: QueryCall[];
  inserts: Array<{
    tableName: "eventsActual";
    row: ConvexActualDockEvent;
  }>;
  replacements: Array<{
    id: Id<"eventsActual">;
    row: ConvexActualDockEvent;
  }>;
};

/**
 * Builds a MutationCtx mock for actual table sparse upserts.
 *
 * @param rows - Existing actual documents visible to indexed reads
 * @returns Mock context and recorded database operations
 */
const makeMutationCtx = (rows: ActualDoc[]): MockMutationCtx => {
  const queryCalls: MockMutationCtx["queryCalls"] = [];
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
          const range = makeRangeRecorder();
          buildRange(range);
          const matchingRows =
            tableName === "eventsActual"
              ? filterRowsByRange(rows, range.filters)
              : [];

          return {
            unique: async () => {
              queryCalls.push({
                tableName,
                indexName,
                filters: range.filters,
                terminal: "unique",
              });
              return matchingRows[0] ?? null;
            },
          };
        },
      }),
      insert: async (tableName: "eventsActual", row: ConvexActualDockEvent) => {
        inserts.push({ tableName, row });
      },
      replace: async (id: Id<"eventsActual">, row: ConvexActualDockEvent) => {
        replacements.push({ id, row });
      },
    },
  } as unknown as MutationCtx;

  return { ctx, queryCalls, inserts, replacements };
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
 * Builds a complete actual dock event fixture.
 *
 * @param overrides - Field overrides for the actual row
 * @returns Validator-shaped actual dock row
 */
const actualRow = (
  overrides: Partial<ConvexActualDockEvent> = {}
): ConvexActualDockEvent => ({
  EventKey: "trip-a--dep-dock",
  TripKey: "trip-a",
  EventType: "dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  UpdatedAt: 1,
  ScheduledDeparture: 1000,
  TerminalAbbrev: "P52",
  EventOccurred: true,
  EventActualTime: 1010,
  ...overrides,
});

/**
 * Builds a stored actual document fixture with Convex metadata.
 *
 * @param overrides - Stored row and optional metadata overrides
 * @returns Stored actual table document
 */
const actualDoc = (
  overrides: Partial<ConvexActualDockEvent> & {
    _id?: Id<"eventsActual">;
    _creationTime?: number;
  } = {}
): ActualDoc =>
  ({
    _id: overrides._id ?? ("actual-row" as Id<"eventsActual">),
    _creationTime: overrides._creationTime ?? 1,
    ...actualRow(overrides),
  }) as ActualDoc;

describe("upsertActualDockRows", () => {
  it("loads existing rows with by_event_key using unique", async () => {
    const mock = makeMutationCtx([]);

    await upsertActualDockRows(mock.ctx, [actualRow({ EventKey: "key-a" })]);

    expect(mock.queryCalls).toEqual([
      {
        tableName: "eventsActual",
        indexName: "by_event_key",
        filters: [{ fieldName: "EventKey", value: "key-a" }],
        terminal: "unique",
      },
    ]);
  });

  it("keeps later duplicates, inserts missing rows, replaces changed rows, and skips unchanged rows", async () => {
    const unchanged = actualDoc({
      _id: "actual-unchanged" as Id<"eventsActual">,
      EventKey: "unchanged",
      UpdatedAt: 3,
    });
    const changed = actualDoc({
      _id: "actual-changed" as Id<"eventsActual">,
      EventKey: "changed",
      TerminalAbbrev: "P52",
    });
    const olderDuplicate = actualRow({
      EventKey: "inserted",
      EventActualTime: 1200,
    });
    const laterDuplicate = actualRow({
      EventKey: "inserted",
      EventActualTime: 1210,
    });
    const changedNext = actualRow({
      EventKey: "changed",
      TerminalAbbrev: "BBI",
    });
    const mock = makeMutationCtx([unchanged, changed]);

    await upsertActualDockRows(mock.ctx, [
      olderDuplicate,
      actualRow({ EventKey: "unchanged", UpdatedAt: 99 }),
      changedNext,
      laterDuplicate,
    ]);

    expect(mock.inserts).toEqual([
      { tableName: "eventsActual", row: laterDuplicate },
    ]);
    expect(mock.replacements).toEqual([
      {
        id: "actual-changed" as Id<"eventsActual">,
        row: changedNext,
      },
    ]);
  });

  it("ignores Convex metadata and UpdatedAt when deciding whether to replace", async () => {
    const stored = actualDoc({
      _id: "actual-stable" as Id<"eventsActual">,
      _creationTime: 123,
      EventKey: "stable",
      UpdatedAt: 1,
    });
    const mock = makeMutationCtx([stored]);

    await upsertActualDockRows(mock.ctx, [
      actualRow({ EventKey: "stable", UpdatedAt: 99 }),
    ]);

    expect(mock.inserts).toEqual([]);
    expect(mock.replacements).toEqual([]);
  });

  it("detects EventActualTime changes", async () => {
    const stored = actualDoc({
      _id: "actual-time" as Id<"eventsActual">,
      EventKey: "time-changed",
      EventActualTime: 1010,
    });
    const next = actualRow({
      EventKey: "time-changed",
      EventActualTime: 1020,
    });
    const mock = makeMutationCtx([stored]);

    await upsertActualDockRows(mock.ctx, [next]);

    expect(mock.replacements).toEqual([
      { id: "actual-time" as Id<"eventsActual">, row: next },
    ]);
  });

  it("compares EventOccurred by effective occurrence state", async () => {
    const trueWithTime = actualDoc({
      _id: "actual-true-with-time" as Id<"eventsActual">,
      EventKey: "true-with-time",
      EventOccurred: true,
      EventActualTime: 1010,
    });
    const falseWithoutTime = actualDoc({
      _id: "actual-false-without-time" as Id<"eventsActual">,
      EventKey: "false-without-time",
      EventOccurred: undefined,
      EventActualTime: undefined,
    });
    const changedOccurrence = actualRow({
      EventKey: "false-without-time",
      EventOccurred: true,
      EventActualTime: undefined,
    });
    const mock = makeMutationCtx([trueWithTime, falseWithoutTime]);

    await upsertActualDockRows(mock.ctx, [
      actualRow({
        EventKey: "true-with-time",
        EventOccurred: undefined,
        EventActualTime: 1010,
      }),
      changedOccurrence,
    ]);

    expect(mock.replacements).toEqual([
      {
        id: "actual-false-without-time" as Id<"eventsActual">,
        row: changedOccurrence,
      },
    ]);
  });
});
