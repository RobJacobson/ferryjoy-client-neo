/**
 * Mutation behavior tests for eventsPredicted sparse reconciliation.
 *
 * The tests use a direct MutationCtx mock to verify storage behavior at the
 * table boundary without depending on planner files or future sync modules.
 */

import { describe, expect, it } from "bun:test";
import type { Doc, Id } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import {
  patchDepartNextMlRowsForDepBoundary,
  upsertPredictedDockBatches,
} from "../mutations";
import type {
  ConvexPredictedDockEvent,
  ConvexPredictedDockWriteRow,
} from "../schemas";

type PredictedDoc = Doc<"eventsPredicted">;

type QueryCall = {
  tableName: string;
  indexName: string;
  filters: Array<{ fieldName: string; value: string }>;
};

type MockMutationCtx = {
  ctx: MutationCtx;
  queryCalls: QueryCall[];
  deletes: Id<"eventsPredicted">[];
  inserts: Array<{
    tableName: "eventsPredicted";
    row: ConvexPredictedDockEvent;
  }>;
  replacements: Array<{
    id: Id<"eventsPredicted">;
    row: ConvexPredictedDockEvent;
  }>;
  patches: Array<{
    id: Id<"eventsPredicted">;
    patch: { Actual: number; DeltaTotal: number };
  }>;
};

/**
 * Builds a MutationCtx mock for predicted table reconciliation.
 *
 * @param rows - Existing predicted documents visible to indexed reads
 * @returns Mock context and recorded database operations
 */
const makeMutationCtx = (rows: PredictedDoc[]): MockMutationCtx => {
  const queryCalls: QueryCall[] = [];
  const deletes: MockMutationCtx["deletes"] = [];
  const inserts: MockMutationCtx["inserts"] = [];
  const replacements: MockMutationCtx["replacements"] = [];
  const patches: MockMutationCtx["patches"] = [];

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
          queryCalls.push({
            tableName,
            indexName,
            filters: range.filters,
          });
          const matchingRows =
            tableName === "eventsPredicted"
              ? filterRowsByRange(rows, range.filters)
              : [];

          return {
            collect: async () => matchingRows,
            first: async () => matchingRows[0] ?? null,
          };
        },
      }),
      delete: async (id: Id<"eventsPredicted">) => {
        deletes.push(id);
      },
      insert: async (
        tableName: "eventsPredicted",
        row: ConvexPredictedDockEvent
      ) => {
        inserts.push({ tableName, row });
      },
      replace: async (
        id: Id<"eventsPredicted">,
        row: ConvexPredictedDockEvent
      ) => {
        replacements.push({ id, row });
      },
      patch: async (
        id: Id<"eventsPredicted">,
        patch: { Actual: number; DeltaTotal: number }
      ) => {
        patches.push({ id, patch });
      },
    },
  } as unknown as MutationCtx;

  return { ctx, queryCalls, deletes, inserts, replacements, patches };
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
 * Builds a complete predicted dock write row fixture.
 *
 * @param overrides - Field overrides for the predicted row
 * @returns Validator-shaped predicted write row
 */
const predictedWriteRow = (
  overrides: Partial<ConvexPredictedDockWriteRow> = {}
): ConvexPredictedDockWriteRow => ({
  Key: "key-a",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  ScheduledDeparture: 1000,
  TerminalAbbrev: "P52",
  EventPredictedTime: 1100,
  PredictionType: "AtDockDepartCurr",
  PredictionSource: "ml",
  ...overrides,
});

/**
 * Builds a stored predicted document fixture with Convex metadata.
 *
 * @param overrides - Stored row and optional metadata overrides
 * @returns Stored predicted table document
 */
const predictedDoc = (
  overrides: Partial<ConvexPredictedDockEvent> & {
    _id?: Id<"eventsPredicted">;
    _creationTime?: number;
  } = {}
): PredictedDoc =>
  ({
    _id: overrides._id ?? ("predicted-row" as Id<"eventsPredicted">),
    _creationTime: overrides._creationTime ?? 1,
    ...predictedWriteRow(overrides),
    UpdatedAt: overrides.UpdatedAt ?? 1,
  }) as PredictedDoc;

describe("upsertPredictedDockBatches", () => {
  it("loads duplicate vessel and sailing-day scopes once with the expected index", async () => {
    const mock = makeMutationCtx([]);

    await upsertPredictedDockBatches(mock.ctx, [
      {
        VesselAbbrev: "WEN",
        SailingDay: "2026-03-25",
        TargetKeys: ["key-a"],
        Rows: [],
      },
      {
        VesselAbbrev: "WEN",
        SailingDay: "2026-03-25",
        TargetKeys: ["key-b"],
        Rows: [],
      },
      {
        VesselAbbrev: "KLA",
        SailingDay: "2026-03-25",
        TargetKeys: [],
        Rows: [],
      },
    ]);

    expect(mock.queryCalls).toEqual([
      {
        tableName: "eventsPredicted",
        indexName: "by_vessel_and_sailing_day",
        filters: [
          { fieldName: "VesselAbbrev", value: "WEN" },
          { fieldName: "SailingDay", value: "2026-03-25" },
        ],
      },
    ]);
  });

  it("unions targets, keeps later duplicates, and reconciles only targeted rows", async () => {
    const stale = predictedDoc({
      _id: "predicted-stale" as Id<"eventsPredicted">,
      Key: "stale-target",
      PredictionType: "AtDockDepartCurr",
      PredictionSource: "ml",
    });
    const unchanged = predictedDoc({
      _id: "predicted-unchanged" as Id<"eventsPredicted">,
      Key: "unchanged-target",
      UpdatedAt: 5,
    });
    const changed = predictedDoc({
      _id: "predicted-changed" as Id<"eventsPredicted">,
      Key: "changed-target",
      EventPredictedTime: 1200,
    });
    const outsideTarget = predictedDoc({
      _id: "predicted-outside" as Id<"eventsPredicted">,
      Key: "outside-targets",
    });
    const otherScope = predictedDoc({
      _id: "predicted-other-scope" as Id<"eventsPredicted">,
      Key: "other-scope",
      VesselAbbrev: "KLA",
    });
    const insertedOlderDuplicate = predictedWriteRow({
      Key: "inserted-target",
      EventPredictedTime: 1300,
    });
    const insertedLaterDuplicate = predictedWriteRow({
      Key: "inserted-target",
      EventPredictedTime: 1310,
    });
    const changedNext = predictedWriteRow({
      Key: "changed-target",
      EventPredictedTime: 1210,
    });
    const outsideIncoming = predictedWriteRow({
      Key: "incoming-outside-targets",
    });
    const mock = makeMutationCtx([
      stale,
      unchanged,
      changed,
      outsideTarget,
      otherScope,
    ]);

    await upsertPredictedDockBatches(mock.ctx, [
      {
        VesselAbbrev: "WEN",
        SailingDay: "2026-03-25",
        TargetKeys: ["stale-target", "unchanged-target"],
        Rows: [predictedWriteRow({ Key: "unchanged-target" }), outsideIncoming],
      },
      {
        VesselAbbrev: "WEN",
        SailingDay: "2026-03-25",
        TargetKeys: ["changed-target", "inserted-target"],
        Rows: [changedNext, insertedOlderDuplicate, insertedLaterDuplicate],
      },
    ]);

    expect(mock.deletes).toEqual(["predicted-stale" as Id<"eventsPredicted">]);
    expect(mock.inserts).toEqual([
      {
        tableName: "eventsPredicted",
        row: {
          ...insertedLaterDuplicate,
          UpdatedAt: expect.any(Number),
        },
      },
    ]);
    expect(mock.replacements).toEqual([
      {
        id: "predicted-changed" as Id<"eventsPredicted">,
        row: {
          ...changedNext,
          UpdatedAt: expect.any(Number),
        },
      },
    ]);
  });

  it("ignores Convex metadata and UpdatedAt when deciding whether to replace", async () => {
    const stored = predictedDoc({
      _id: "predicted-stable" as Id<"eventsPredicted">,
      _creationTime: 123,
      Key: "stable-target",
      UpdatedAt: 1,
    });
    const mock = makeMutationCtx([stored]);

    await upsertPredictedDockBatches(mock.ctx, [
      {
        VesselAbbrev: "WEN",
        SailingDay: "2026-03-25",
        TargetKeys: ["stable-target"],
        Rows: [predictedWriteRow({ Key: "stable-target" })],
      },
    ]);

    expect(mock.deletes).toEqual([]);
    expect(mock.inserts).toEqual([]);
    expect(mock.replacements).toEqual([]);
  });

  it("preserves omitted depart-next ML rows when no same key and source row arrives", async () => {
    const depKey = "depart-next-boundary";
    const preservedAtDock = predictedDoc({
      _id: "predicted-at-dock" as Id<"eventsPredicted">,
      Key: depKey,
      PredictionType: "AtDockDepartNext",
      PredictionSource: "ml",
    });
    const preservedAtSea = predictedDoc({
      _id: "predicted-at-sea" as Id<"eventsPredicted">,
      Key: depKey,
      PredictionType: "AtSeaDepartNext",
      PredictionSource: "ml",
    });
    const mock = makeMutationCtx([preservedAtDock, preservedAtSea]);

    await upsertPredictedDockBatches(mock.ctx, [
      {
        VesselAbbrev: "WEN",
        SailingDay: "2026-03-25",
        TargetKeys: [depKey],
        Rows: [],
      },
    ]);

    expect(mock.deletes).toEqual([]);
  });

  it("deletes stale at-dock depart-next ML rows when an at-sea same source row arrives", async () => {
    const depKey = "depart-next-boundary";
    const staleAtDock = predictedDoc({
      _id: "predicted-at-dock" as Id<"eventsPredicted">,
      Key: depKey,
      PredictionType: "AtDockDepartNext",
      PredictionSource: "ml",
    });
    const atSeaNext = predictedWriteRow({
      Key: depKey,
      PredictionType: "AtSeaDepartNext",
      PredictionSource: "ml",
      EventPredictedTime: 1200,
    });
    const mock = makeMutationCtx([staleAtDock]);

    await upsertPredictedDockBatches(mock.ctx, [
      {
        VesselAbbrev: "WEN",
        SailingDay: "2026-03-25",
        TargetKeys: [depKey],
        Rows: [atSeaNext],
      },
    ]);

    expect(mock.deletes).toEqual([
      "predicted-at-dock" as Id<"eventsPredicted">,
    ]);
    expect(mock.inserts).toEqual([
      {
        tableName: "eventsPredicted",
        row: {
          ...atSeaNext,
          UpdatedAt: expect.any(Number),
        },
      },
    ]);
  });
});

describe("patchDepartNextMlRowsForDepBoundary", () => {
  it("queries both depart-next ML rows and patches rows without Actual", async () => {
    const depKey = "depart-next-boundary";
    const atDock = predictedDoc({
      _id: "predicted-at-dock" as Id<"eventsPredicted">,
      Key: depKey,
      PredictionType: "AtDockDepartNext",
      PredictionSource: "ml",
      EventPredictedTime: 1_000_000,
    });
    const atSea = predictedDoc({
      _id: "predicted-at-sea" as Id<"eventsPredicted">,
      Key: depKey,
      PredictionType: "AtSeaDepartNext",
      PredictionSource: "ml",
      EventPredictedTime: 1_120_000,
    });
    const mock = makeMutationCtx([atDock, atSea]);

    const didPatch = await patchDepartNextMlRowsForDepBoundary(
      mock.ctx,
      depKey,
      1_600_000
    );

    expect(didPatch).toBe(true);
    expect(
      mock.queryCalls.map((call) => ({
        indexName: call.indexName,
        filters: call.filters,
      }))
    ).toEqual([
      {
        indexName: "by_key_type_and_source",
        filters: [
          { fieldName: "Key", value: depKey },
          { fieldName: "PredictionType", value: "AtDockDepartNext" },
          { fieldName: "PredictionSource", value: "ml" },
        ],
      },
      {
        indexName: "by_key_type_and_source",
        filters: [
          { fieldName: "Key", value: depKey },
          { fieldName: "PredictionType", value: "AtSeaDepartNext" },
          { fieldName: "PredictionSource", value: "ml" },
        ],
      },
    ]);
    expect(mock.patches).toEqual([
      {
        id: "predicted-at-dock" as Id<"eventsPredicted">,
        patch: { Actual: 1_600_000, DeltaTotal: 10 },
      },
      {
        id: "predicted-at-sea" as Id<"eventsPredicted">,
        patch: { Actual: 1_600_000, DeltaTotal: 8 },
      },
    ]);
  });

  it("skips missing rows and rows that are already actualized", async () => {
    const depKey = "depart-next-boundary";
    const atDock = predictedDoc({
      _id: "predicted-at-dock" as Id<"eventsPredicted">,
      Key: depKey,
      PredictionType: "AtDockDepartNext",
      PredictionSource: "ml",
      Actual: 1_500_000,
    });
    const mock = makeMutationCtx([atDock]);

    const didPatch = await patchDepartNextMlRowsForDepBoundary(
      mock.ctx,
      depKey,
      1_600_000
    );

    expect(didPatch).toBe(false);
    expect(mock.patches).toEqual([]);
  });
});
