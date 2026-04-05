/**
 * Covers renderer-row shaping and layout geometry in the VesselTimeline pipeline.
 */

import { describe, expect, it } from "bun:test";
import { toActiveRow } from "../toActiveRow";
import { toDerivedRows } from "../toDerivedRows";
import { toRenderRows } from "../toRenderRows";
import { makePipelineInput } from "./fixtures";

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

  it("caps the first real dock row and falls back to the terminal abbreviation", () => {
    const withRows = toDerivedRows(
      makePipelineInput({
        events: [
          {
            SegmentKey: "trip-0",
            Key: "trip-0--arv-dock",
            VesselAbbrev: "WEN",
            SailingDay: "2026-03-17",
            ScheduledDeparture: new Date("2026-03-17T22:00:00-07:00"),
            TerminalAbbrev: "BBI",
            EventType: "arv-dock",
            EventScheduledTime: new Date("2026-03-17T22:35:00-07:00"),
            EventPredictedTime: undefined,
            EventActualTime: undefined,
          },
          {
            SegmentKey: "trip-1",
            Key: "trip-1--dep-dock",
            VesselAbbrev: "WEN",
            SailingDay: "2026-03-18",
            ScheduledDeparture: new Date("2026-03-18T05:00:00-07:00"),
            TerminalAbbrev: "BBI",
            EventType: "dep-dock",
            EventScheduledTime: new Date("2026-03-18T05:00:00-07:00"),
            EventPredictedTime: undefined,
            EventActualTime: undefined,
          },
        ],
        getTerminalNameByAbbrev: () => null,
        layout: {
          rowHeightBasePx: 0,
          rowHeightScalePx: 1,
          rowHeightExponent: 1,
          minRowHeightPx: 0,
          terminalCardTopHeightPx: 16,
          terminalCardBottomHeightPx: 16,
          initialAutoScroll: "center-active-indicator",
          initialScrollAnchorPercent: 0.4,
        },
      })
    );
    const renderState = toRenderRows(toActiveRow(withRows));

    expect(renderState.rowLayouts["trip-1--at-dock"]?.height).toBe(60);
    expect(renderState.renderRows[0]?.terminalHeadline).toBe("BBI");
  });
});
