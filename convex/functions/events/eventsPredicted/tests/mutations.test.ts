import { describe, expect, it, mock } from "bun:test";
import type { Id } from "_generated/dataModel";
import { projectPredictedDockWriteBatchesInDb } from "../mutations";

type PredictedDoc = {
  _id: Id<"eventsPredicted">;
  Key: string;
  VesselAbbrev: string;
  SailingDay: string;
  ScheduledDeparture: number;
  TerminalAbbrev: string;
  EventPredictedTime: number;
  PredictionType:
    | "AtDockDepartNext"
    | "AtSeaDepartNext"
    | "AtDockDepartCurr"
    | "AtSeaArriveNext";
  PredictionSource: "ml" | "wsf_eta";
  Actual?: number;
  DeltaTotal?: number;
};

describe("projectPredictedDockWriteBatchesInDb", () => {
  it("preserves depart-next ML rows during target-key clearing", async () => {
    const depKey = "TAC--2026-03-13--05:30--ANA-ORI--dep-dock";
    const arvKey = "TAC--2026-03-13--05:30--ANA-ORI--arv-dock";
    const existingRows: PredictedDoc[] = [
      {
        _id: "pred-1" as Id<"eventsPredicted">,
        Key: depKey,
        VesselAbbrev: "TAC",
        SailingDay: "2026-03-13",
        ScheduledDeparture: 1000,
        TerminalAbbrev: "ANA",
        EventPredictedTime: 1200,
        PredictionType: "AtSeaDepartNext",
        PredictionSource: "ml",
      },
      {
        _id: "pred-2" as Id<"eventsPredicted">,
        Key: depKey,
        VesselAbbrev: "TAC",
        SailingDay: "2026-03-13",
        ScheduledDeparture: 1000,
        TerminalAbbrev: "ANA",
        EventPredictedTime: 1210,
        PredictionType: "AtDockDepartNext",
        PredictionSource: "ml",
      },
    ];
    const deleteMock = mock(async () => {});
    const ctx = createCtx(existingRows, {
      delete: deleteMock,
    });

    await projectPredictedDockWriteBatchesInDb(ctx, [
      {
        VesselAbbrev: "TAC",
        SailingDay: "2026-03-13",
        TargetKeys: [depKey, arvKey],
        Rows: [
          {
            Key: arvKey,
            VesselAbbrev: "TAC",
            SailingDay: "2026-03-13",
            ScheduledDeparture: 1000,
            TerminalAbbrev: "ORI",
            EventPredictedTime: 1600,
            PredictionType: "AtSeaArriveNext",
            PredictionSource: "ml",
          },
        ],
      },
    ]);

    expect(deleteMock).toHaveBeenCalledTimes(0);
  });
});

const createCtx = (
  rows: PredictedDoc[],
  mocks?: {
    delete?: ReturnType<typeof mock>;
    replace?: ReturnType<typeof mock>;
    insert?: ReturnType<typeof mock>;
  }
) =>
  ({
    db: {
      query: (_table: "eventsPredicted") => ({
        withIndex: (
          _index: "by_vessel_and_sailing_day",
          _builder: (q: {
            eq: (field: "VesselAbbrev" | "SailingDay", value: string) => unknown;
          }) => unknown
        ) => ({
          collect: async () => rows,
        }),
      }),
      delete: mocks?.delete ?? mock(async () => {}),
      replace: mocks?.replace ?? mock(async () => {}),
      insert: mocks?.insert ?? mock(async () => "new-id" as Id<"eventsPredicted">),
    },
  }) as never;
