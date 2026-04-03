import { describe, expect, it } from "bun:test";
import { toActiveRow } from "../toActiveRow";
import { toDerivedRows } from "../toDerivedRows";
import { toTimelineEvents } from "../toTimelineEvents";
import { at, makePipelineInput, makePrediction } from "./fixtures";

const getActiveRow = (overrides?: Parameters<typeof makePipelineInput>[0]) =>
  toActiveRow(toDerivedRows(toTimelineEvents(makePipelineInput(overrides))));

describe("toActiveRow", () => {
  it("defaults to the first dock row before departure evidence appears", () => {
    const result = getActiveRow();

    expect(result.activeRow?.rowIndex).toBe(0);
    expect(result.activeRow?.row.kind).toBe("at-dock");
    expect(result.activeRow?.isComplete).toBeFalse();
  });

  it("selects the sea row after departure evidence", () => {
    const result = getActiveRow({
      trip: {
        LeftDock: at(8, 5),
      },
      vesselLocation: {
        LeftDock: at(8, 5),
        AtDock: false,
      },
    });

    expect(result.activeRow?.rowIndex).toBe(1);
    expect(result.activeRow?.row.kind).toBe("at-sea");
    expect(result.activeRow?.isComplete).toBeFalse();
  });

  it("selects the final dock row after arrival or trip end", () => {
    const arrived = getActiveRow({
      trip: {
        ArriveDest: at(8, 36),
      },
    });
    const tripEnded = getActiveRow({
      trip: {
        TripEnd: at(8, 37),
      },
    });

    expect(arrived.activeRow?.rowIndex).toBe(2);
    expect(arrived.activeRow?.row.kind).toBe("at-dock");
    expect(tripEnded.activeRow?.rowIndex).toBe(2);
    expect(tripEnded.activeRow?.row.kind).toBe("at-dock");
  });

  it("pins the final dock row as complete after the next departure actual lands", () => {
    const result = getActiveRow({
      trip: {
        AtDockDepartNext: makePrediction({
          PredTime: at(9, 5),
          Actual: at(9, 3),
        }),
      },
    });

    expect(result.activeRow?.rowIndex).toBe(2);
    expect(result.activeRow?.row.kind).toBe("at-dock");
    expect(result.activeRow?.isComplete).toBeTrue();
  });
});
