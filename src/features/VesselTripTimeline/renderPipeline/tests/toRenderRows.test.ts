import { describe, expect, it } from "bun:test";
import { toActiveRow } from "../toActiveRow";
import { toDerivedRows } from "../toDerivedRows";
import { toRenderRows } from "../toRenderRows";
import { toTimelineEvents } from "../toTimelineEvents";
import { makePipelineInput } from "./fixtures";

describe("toRenderRows", () => {
  it("maps derived rows into renderer-facing rows with local marker state", () => {
    const result = toRenderRows(
      toActiveRow(
        toDerivedRows(
          toTimelineEvents(
            makePipelineInput({
              trip: {
                LeftDock: new Date(Date.UTC(2026, 2, 18, 8, 5)),
              },
              vesselLocation: {
                LeftDock: new Date(Date.UTC(2026, 2, 18, 8, 5)),
                AtDock: false,
              },
            })
          )
        )
      )
    );

    expect(result.renderRows).toHaveLength(3);
    expect(result.renderRows.map((row) => row.markerAppearance)).toEqual([
      "past",
      "past",
      "future",
    ]);
    expect(result.renderRows[0]?.startLabel).toBe("Arv: P52");
    expect(result.renderRows[0]?.terminalHeadline).toBe("Seattle");
    expect(result.renderRows[1]?.startLabel).toBe("To: BBI");
    expect(result.renderRows[1]?.startBoundary.nextTerminalAbbrev).toBe("BBI");
    expect(result.renderRows[2]?.terminalHeadline).toBe("Bainbridge Is.");
    expect(result.renderRows[2]?.isFinalRow).toBeTrue();
  });
});
