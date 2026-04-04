/**
 * Covers active-indicator derivation in the VesselTimeline pipeline.
 */

import { describe, expect, it } from "bun:test";
import { toActiveIndicator } from "../toActiveIndicator";
import {
  at,
  makeLiveState,
  makePipelineWithRenderRows,
  makeRow,
  makeRowEvent,
  makeRows,
} from "./fixtures";

describe("toActiveIndicator", () => {
  it("hides the indicator when no active row is selected", () => {
    const { activeIndicator } = toActiveIndicator(
      makePipelineWithRenderRows({
        activeRow: null,
        liveState: makeLiveState({
          AtDock: true,
          DepartingTerminalAbbrev: "VAI",
        }),
        now: at(9, 0),
      })
    );

    expect(activeIndicator).toBeNull();
  });

  it("uses distance-based progress and subtitle copy for an active sea row", () => {
    const rows = makeRows();
    const { activeIndicator } = toActiveIndicator(
      makePipelineWithRenderRows({
        rows,
        activeRow: {
          row: rows[1],
          rowIndex: 1,
        },
        liveState: makeLiveState({
          AtDock: false,
          InService: true,
          Speed: 12,
          ArrivingDistance: 4.2,
          DepartingDistance: 3.8,
          ArrivingTerminalAbbrev: "VAI",
        }),
        now: at(8, 20),
      })
    );

    expect(activeIndicator?.rowId).toBe("trip-1--at-sea");
    expect(activeIndicator?.subtitle).toBe("12 kn · 4.2 mi to VAI");
    expect(activeIndicator?.animate).toBeTrue();
    expect(activeIndicator?.positionPercent).toBeGreaterThan(0.47);
    expect(activeIndicator?.positionPercent).toBeLessThan(0.48);
  });

  it("falls back to time-based sea progress when arrival distance is missing", () => {
    const rows = makeRows();
    const { activeIndicator } = toActiveIndicator(
      makePipelineWithRenderRows({
        rows,
        activeRow: {
          row: rows[1],
          rowIndex: 1,
        },
        liveState: makeLiveState({
          AtDock: false,
          InService: true,
          Speed: 12,
          ArrivingDistance: undefined,
          DepartingDistance: 0,
        }),
        now: at(8, 20),
      })
    );

    expect(activeIndicator?.label).toBe("15m");
    expect(activeIndicator?.positionPercent).toBeGreaterThan(0.57);
    expect(activeIndicator?.positionPercent).toBeLessThan(0.58);
  });

  it("uses actual arrival and predicted departure for dock progress", () => {
    const dockRow = makeRow({
      rowId: "trip-7--at-dock",
      segmentKey: "trip-7",
      kind: "at-dock",
      rowEdge: "normal",
      startEvent: makeRowEvent({
        Key: "trip-6--arv-dock",
        EventType: "arv-dock",
        TerminalAbbrev: "FAU",
        ScheduledDeparture: at(22, 50),
        EventScheduledTime: at(22, 50),
        EventActualTime: at(22, 58),
      }),
      endEvent: makeRowEvent({
        Key: "trip-7--dep-dock",
        EventType: "dep-dock",
        TerminalAbbrev: "FAU",
        ScheduledDeparture: at(23, 5),
        EventScheduledTime: at(23, 5),
        EventPredictedTime: at(23, 12),
      }),
      durationMinutes: 15,
    });
    const { activeIndicator } = toActiveIndicator(
      makePipelineWithRenderRows({
        rows: [dockRow],
        activeRow: {
          row: dockRow,
          rowIndex: 0,
        },
        liveState: makeLiveState({
          AtDock: true,
          DepartingTerminalAbbrev: "FAU",
        }),
        now: at(23, 5),
      })
    );

    expect(activeIndicator?.rowId).toBe("trip-7--at-dock");
    expect(activeIndicator?.label).toBe("7m");
    expect(activeIndicator?.subtitle).toBe("At dock FAU");
    expect(activeIndicator?.animate).toBeFalse();
    expect(activeIndicator?.positionPercent).toBeGreaterThan(0.49);
    expect(activeIndicator?.positionPercent).toBeLessThan(0.51);
  });

  it("centers dock indicators when the row has no valid start time yet", () => {
    const rows = makeRows();
    const { activeIndicator } = toActiveIndicator(
      makePipelineWithRenderRows({
        rows,
        activeRow: {
          row: rows[0],
          rowIndex: 0,
        },
        liveState: makeLiveState({
          AtDock: true,
          DepartingTerminalAbbrev: "P52",
        }),
        now: at(7, 55),
      })
    );

    expect(activeIndicator?.rowId).toBe("trip-1--at-dock");
    expect(activeIndicator?.positionPercent).toBe(0.5);
  });

  it("renders terminal-tail rows with a terminal stop label", () => {
    const rows = makeRows();
    const { activeIndicator } = toActiveIndicator(
      makePipelineWithRenderRows({
        rows,
        activeRow: {
          row: rows[2],
          rowIndex: 2,
        },
        liveState: makeLiveState({
          AtDock: true,
          DepartingTerminalAbbrev: "VAI",
        }),
        now: at(9, 0),
      })
    );

    expect(activeIndicator?.rowId).toBe("trip-1--at-dock--terminal-tail");
    expect(activeIndicator?.label).toBe("--");
    expect(activeIndicator?.subtitle).toBe("At dock VAI");
    expect(activeIndicator?.positionPercent).toBe(0);
  });

  it("uses eased progress for the compressed overnight first row", () => {
    const overnightRow = makeRow({
      rowId: "trip-1--at-dock",
      segmentKey: "trip-1",
      kind: "at-dock",
      rowEdge: "normal",
      startEvent: makeRowEvent({
        Key: "trip-0--arv-dock",
        EventType: "arv-dock",
        TerminalAbbrev: "P52",
        ScheduledDeparture: new Date("2026-03-17T22:00:00-07:00"),
        EventScheduledTime: new Date("2026-03-17T22:00:00-07:00"),
        EventActualTime: undefined,
        IsArrivalPlaceholder: false,
      }),
      endEvent: makeRowEvent({
        Key: "trip-1--dep-dock",
        EventType: "dep-dock",
        TerminalAbbrev: "P52",
        ScheduledDeparture: new Date("2026-03-18T06:00:00-07:00"),
        EventScheduledTime: new Date("2026-03-18T06:00:00-07:00"),
      }),
      durationMinutes: 480,
    });
    const { activeIndicator } = toActiveIndicator(
      makePipelineWithRenderRows({
        rows: [overnightRow],
        activeRow: {
          row: overnightRow,
          rowIndex: 0,
        },
        liveState: makeLiveState({
          AtDock: true,
          DepartingTerminalAbbrev: "P52",
        }),
        now: new Date("2026-03-18T02:00:00-07:00"),
      })
    );

    expect(
      Math.abs(
        (activeIndicator?.positionPercent ?? 0) - (1 - Math.cos(Math.PI / 4))
      )
    ).toBeLessThan(0.00001);
  });
});
