import { describe, expect, it } from "bun:test";
import { getTimelineRenderState } from "..";
import {
  at,
  makeGetTerminalNameByAbbrev,
  makePrediction,
  makeTimelineItem,
} from "./fixtures";

describe("getTimelineRenderState", () => {
  it("keeps the trip timeline on the first dock row before departure", () => {
    const renderState = getTimelineRenderState(
      makeTimelineItem(),
      makeGetTerminalNameByAbbrev(),
      at(7, 50)
    );

    expect(renderState.rows).toHaveLength(3);
    expect(renderState.rows.map((row) => row.kind)).toEqual([
      "at-dock",
      "at-sea",
      "at-dock",
    ]);
    expect(renderState.rows.map((row) => row.markerAppearance)).toEqual([
      "past",
      "future",
      "future",
    ]);
    expect(renderState.activeIndicator?.rowId).toBe("WEN-row-0-at-dock");
    expect(renderState.activeIndicator?.label).toBe("15m");
    expect(renderState.activeIndicator?.subtitle).toBe("at dock");
  });

  it("switches to the sea row and prefers distance progress in transit", () => {
    const renderState = getTimelineRenderState(
      makeTimelineItem({
        trip: {
          LeftDock: at(8, 5),
        },
        vesselLocation: {
          LeftDock: at(8, 5),
          AtDock: false,
          Speed: 12,
          DepartingDistance: 3.8,
          ArrivingDistance: 4.2,
        },
      }),
      makeGetTerminalNameByAbbrev(),
      at(8, 20)
    );

    expect(renderState.rows.map((row) => row.markerAppearance)).toEqual([
      "past",
      "past",
      "future",
    ]);
    expect(renderState.activeIndicator?.rowId).toBe("WEN-row-1-at-sea");
    expect(renderState.activeIndicator?.subtitle).toBe("12 kn · 4.2 mi");
    expect(renderState.activeIndicator?.positionPercent).toBeGreaterThan(0.47);
    expect(renderState.activeIndicator?.positionPercent).toBeLessThan(0.48);
  });

  it("switches to the final dock row after arrival", () => {
    const renderState = getTimelineRenderState(
      makeTimelineItem({
        trip: {
          ArriveDest: at(8, 36),
        },
      }),
      makeGetTerminalNameByAbbrev(),
      at(8, 50)
    );

    expect(renderState.rows.map((row) => row.markerAppearance)).toEqual([
      "past",
      "past",
      "past",
    ]);
    expect(renderState.activeIndicator?.rowId).toBe("WEN-row-2-at-dock");
    expect(renderState.activeIndicator?.subtitle).toBe("at dock");
  });

  it("pins the final dock row to the end once the next departure actual lands", () => {
    const completedTrip = makeTimelineItem({
      trip: {
        AtDockDepartNext: makePrediction({
          PredTime: at(9, 5),
          Actual: at(9, 3),
        }),
      },
    });
    const renderState = getTimelineRenderState(
      completedTrip,
      makeGetTerminalNameByAbbrev(),
      at(9, 10)
    );

    expect(renderState.activeIndicator?.rowId).toBe("WEN-row-2-at-dock");
    expect(renderState.activeIndicator?.positionPercent).toBe(1);
    expect(renderState.activeIndicator?.label).toBe("0m");
  });
});
