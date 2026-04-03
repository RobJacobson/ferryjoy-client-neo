/**
 * Covers renderer-row shaping and layout geometry in the VesselTimeline pipeline.
 */

import { describe, expect, it } from "bun:test";
import { makePipelineInput } from "./fixtures";
import { toActiveRow } from "../toActiveRow";
import { toDerivedRows } from "../toDerivedRows";
import { toRenderRows } from "../toRenderRows";

describe("toRenderRows", () => {
  it("maps derived rows into renderer rows and terminal cards", () => {
    const withRows = toDerivedRows(
      makePipelineInput({
        activeInterval: {
          kind: "at-sea",
          startEventKey: "trip-1--dep-dock",
          endEventKey: "trip-1--arv-dock",
        },
      })
    );
    const withActiveRow = toActiveRow(withRows);
    const renderState = toRenderRows(withActiveRow);

    expect(renderState.activeRowIndex).toBe(1);
    expect(renderState.renderRows).toHaveLength(3);
    expect(renderState.renderRows.map((row) => row.markerAppearance)).toEqual([
      "past",
      "past",
      "future",
    ]);
    expect(renderState.renderRows[0]?.showStartTimePlaceholder).toBeTrue();
    expect(renderState.renderRows[0]?.terminalHeadline).toBe("Seattle");
    expect(renderState.renderRows[1]?.startLabel).toBe("To: VAI");
    expect(renderState.renderRows[2]?.id).toBe(
      "trip-1--at-dock--terminal-tail"
    );
    expect(renderState.renderRows[2]?.isFinalRow).toBeTrue();
    expect(renderState.renderRows[2]?.terminalHeadline).toBe("Vashon Is.");
    expect(renderState.terminalCards.map((card) => card.position)).toEqual([
      "top",
      "bottom",
      "single",
    ]);
    expect(renderState.rowLayouts["trip-1--at-sea"]?.height).toBeGreaterThan(0);
  });
});
