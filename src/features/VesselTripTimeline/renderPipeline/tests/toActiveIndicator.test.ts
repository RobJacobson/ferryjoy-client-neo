import { describe, expect, it } from "bun:test";
import { toActiveIndicator } from "../toActiveIndicator";
import { toActiveRow } from "../toActiveRow";
import { toDerivedRows } from "../toDerivedRows";
import { toRenderRows } from "../toRenderRows";
import { toTimelineEvents } from "../toTimelineEvents";
import { at, makePipelineInput, makePrediction } from "./fixtures";

const getIndicator = (overrides?: Parameters<typeof makePipelineInput>[0]) =>
  toActiveIndicator(
    toRenderRows(
      toActiveRow(toDerivedRows(toTimelineEvents(makePipelineInput(overrides))))
    )
  ).activeIndicator;

describe("toActiveIndicator", () => {
  it("applies the minimum offset on the first dock row", () => {
    const indicator = getIndicator({
      now: at(7, 40),
    });

    expect(indicator?.rowId).toBe("WEN-row-0-at-dock");
    expect(indicator?.positionPercent).toBe(0.06);
    expect(indicator?.label).toBe("25m");
    expect(indicator?.subtitle).toBe("at dock");
    expect(indicator?.animate).toBeFalse();
  });

  it("prefers distance progress for the active sea row when telemetry is available", () => {
    const indicator = getIndicator({
      now: at(8, 20),
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
    });

    expect(indicator?.rowId).toBe("WEN-row-1-at-sea");
    expect(indicator?.positionPercent).toBeGreaterThan(0.47);
    expect(indicator?.positionPercent).toBeLessThan(0.48);
    expect(indicator?.label).toBe("15m");
    expect(indicator?.subtitle).toBe("12 kn · 4.2 mi");
    expect(indicator?.animate).toBeTrue();
  });

  it("falls back to time progress for the active sea row without telemetry distances", () => {
    const indicator = getIndicator({
      now: at(8, 20),
      trip: {
        LeftDock: at(8, 5),
      },
      vesselLocation: {
        LeftDock: at(8, 5),
        AtDock: false,
        Speed: 12,
      },
    });

    expect(indicator?.rowId).toBe("WEN-row-1-at-sea");
    expect(indicator?.positionPercent).toBeGreaterThan(0.49);
    expect(indicator?.positionPercent).toBeLessThan(0.51);
    expect(indicator?.subtitle).toBe("12 kn");
  });

  it("pins the completed timeline to the end of the final dock row", () => {
    const indicator = getIndicator({
      now: at(9, 10),
      trip: {
        AtDockDepartNext: makePrediction({
          PredTime: at(9, 5),
          Actual: at(9, 3),
        }),
      },
    });

    expect(indicator?.rowId).toBe("WEN-row-2-at-dock");
    expect(indicator?.positionPercent).toBe(1);
    expect(indicator?.label).toBe("0m");
    expect(indicator?.subtitle).toBe("at dock");
  });
});
