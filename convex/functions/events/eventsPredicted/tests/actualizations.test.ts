import { describe, expect, it, mock } from "bun:test";
import type { Id } from "_generated/dataModel";
import { patchDepartNextMlRows } from "../actualizations";

type PredictedRow = {
  _id: Id<"eventsPredicted">;
  Key: string;
  PredictionType: "AtDockDepartNext" | "AtSeaDepartNext";
  PredictionSource: "ml" | "wsf_eta";
  EventPredictedTime: number;
  Actual?: number;
};

describe("patchDepartNextMlRows", () => {
  it("updates both depart-next ML rows when present", async () => {
    const patchPayloads: Array<{ Actual: number; DeltaTotal: number }> = [];
    const patchMock = mock(
      async (
        _id: Id<"eventsPredicted">,
        payload: { Actual: number; DeltaTotal: number }
      ) => {
        patchPayloads.push(payload);
      }
    );
    const rows = new Map<string, PredictedRow>([
      [
        rowKey(
          "TAC--2026-03-13--05:30--ANA-ORI--dep-dock",
          "AtDockDepartNext",
          "ml"
        ),
        {
          _id: "pred-1" as Id<"eventsPredicted">,
          Key: "TAC--2026-03-13--05:30--ANA-ORI--dep-dock",
          PredictionType: "AtDockDepartNext",
          PredictionSource: "ml",
          EventPredictedTime: 1_000_000,
        },
      ],
      [
        rowKey(
          "TAC--2026-03-13--05:30--ANA-ORI--dep-dock",
          "AtSeaDepartNext",
          "ml"
        ),
        {
          _id: "pred-2" as Id<"eventsPredicted">,
          Key: "TAC--2026-03-13--05:30--ANA-ORI--dep-dock",
          PredictionType: "AtSeaDepartNext",
          PredictionSource: "ml",
          EventPredictedTime: 1_120_000,
        },
      ],
    ]);
    const ctx = createMutationCtx(rows, patchMock);

    const result = await patchDepartNextMlRows(ctx, {
      vesselAbbrev: "TAC",
      depBoundaryKey: "TAC--2026-03-13--05:30--ANA-ORI--dep-dock",
      actualDepartMs: 1_600_000,
    });

    expect(result).toEqual({ updated: true });
    expect(patchMock).toHaveBeenCalledTimes(2);
    expect(patchPayloads[0]).toEqual({
      Actual: 1_600_000,
      DeltaTotal: 10,
    });
    expect(patchPayloads[1]).toEqual({
      Actual: 1_600_000,
      DeltaTotal: 8,
    });
  });

  it("skips rows that are already actualized", async () => {
    const patchMock = mock(async () => {});
    const rows = new Map<string, PredictedRow>([
      [
        rowKey(
          "TAC--2026-03-13--05:30--ANA-ORI--dep-dock",
          "AtDockDepartNext",
          "ml"
        ),
        {
          _id: "pred-1" as Id<"eventsPredicted">,
          Key: "TAC--2026-03-13--05:30--ANA-ORI--dep-dock",
          PredictionType: "AtDockDepartNext",
          PredictionSource: "ml",
          EventPredictedTime: 1000,
          Actual: 1500,
        },
      ],
      [
        rowKey(
          "TAC--2026-03-13--05:30--ANA-ORI--dep-dock",
          "AtSeaDepartNext",
          "ml"
        ),
        {
          _id: "pred-2" as Id<"eventsPredicted">,
          Key: "TAC--2026-03-13--05:30--ANA-ORI--dep-dock",
          PredictionType: "AtSeaDepartNext",
          PredictionSource: "ml",
          EventPredictedTime: 1120,
          Actual: 1500,
        },
      ],
    ]);
    const ctx = createMutationCtx(rows, patchMock);

    const result = await patchDepartNextMlRows(ctx, {
      vesselAbbrev: "TAC",
      depBoundaryKey: "TAC--2026-03-13--05:30--ANA-ORI--dep-dock",
      actualDepartMs: 1600,
    });

    expect(result).toEqual({
      updated: false,
      reason: "no_predictions_to_update",
    });
    expect(patchMock).toHaveBeenCalledTimes(0);
  });

  it("returns no-op when rows do not exist", async () => {
    const patchMock = mock(async () => {});
    const ctx = createMutationCtx(new Map(), patchMock);

    const result = await patchDepartNextMlRows(ctx, {
      vesselAbbrev: "TAC",
      depBoundaryKey: "TAC--2026-03-13--05:30--ANA-ORI--dep-dock",
      actualDepartMs: 1600,
    });

    expect(result).toEqual({
      updated: false,
      reason: "no_predictions_to_update",
    });
    expect(patchMock).toHaveBeenCalledTimes(0);
  });
});

const createMutationCtx = (
  rows: Map<string, PredictedRow>,
  patchMock: ReturnType<typeof mock>
) =>
  ({
    db: {
      query: (_table: "eventsPredicted") => ({
        withIndex: (
          _index: "by_key_type_and_source",
          builder: (q: {
            eq: (
              field: "Key" | "PredictionType" | "PredictionSource",
              value: string
            ) => unknown;
          }) => unknown
        ) => {
          const filters: Record<string, string> = {};
          const chain = {
            eq: (
              field: "Key" | "PredictionType" | "PredictionSource",
              value: string
            ) => {
              filters[field] = value;
              return chain;
            },
          };
          builder(chain);
          return {
            first: async () =>
              rows.get(
                rowKey(
                  filters.Key ?? "",
                  filters.PredictionType ?? "",
                  filters.PredictionSource ?? ""
                )
              ) ?? null,
          };
        },
      }),
      patch: patchMock,
    },
  }) as never;

const rowKey = (
  key: string,
  predictionType: string,
  predictionSource: string
) => `${key}::${predictionType}::${predictionSource}`;
