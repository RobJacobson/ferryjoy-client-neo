import { describe, expect, it } from "bun:test";
import type {
  VesselTimelineActiveState,
  VesselTimelineLiveState,
  VesselTimelineSegment,
} from "@/types";
import {
  getStaticVesselTimelineRenderState,
  getVesselTimelineActiveIndicator,
  resolveActiveSegmentIndex,
} from "..";

const at = (hours: number, minutes: number) =>
  new Date(Date.UTC(2026, 2, 18, hours, minutes));

describe("resolveActiveSegmentIndex", () => {
  it("matches the live-anchored sea segment even when a placeholder dock row comes first", () => {
    const rows = makeRoundTripSegments();
    const firstRow = getRowOrThrow(rows, 0);

    rows[0] = {
      ...firstRow,
      startEvent: { ...firstRow.startEvent, EventActualTime: at(8, 1) },
      endEvent: { ...firstRow.endEvent, EventActualTime: undefined },
    };

    const activeRowIndex = resolveActiveSegmentIndex(
      rows,
      makeActiveState({
        kind: "sea",
        rowMatch: {
          kind: "sea",
          startEventKey: "dep-1",
          endEventKey: "arv-1",
        },
        reason: "location_anchor",
      })
    );
    expect(activeRowIndex).toBe(1);
  });

  it("matches the terminal row from terminalTailEventKey", () => {
    const activeRowIndex = resolveActiveSegmentIndex(
      makeRoundTripSegments(),
      makeActiveState({
        kind: "scheduled-fallback",
        rowMatch: null,
        terminalTailEventKey: "arv-2",
        reason: "fallback",
      })
    );

    expect(activeRowIndex).toBe(4);
  });

  it("returns no active row when the backend provides no row match", () => {
    expect(resolveActiveSegmentIndex(makeRoundTripSegments(), null)).toBe(-1);
  });
});

describe("getStaticVesselTimelineRenderState", () => {
  it("renders server-owned placeholder and terminal-tail segments", () => {
    const renderState = getRenderState(
      makePlaceholderSegments(),
      null,
      null,
      at(8, 0)
    );

    expect(renderState.rows).toHaveLength(5);
    expect(renderState.rows[2]?.kind).toBe("at-dock");
    expect(renderState.rows[2]?.startLabel).toBe("Arv: VAI");
    expect(renderState.rows[2]?.terminalHeadline).toBe("Vashon Is.");
    expect(renderState.rows[2]?.showStartTimePlaceholder).toBeTrue();
    expect(renderState.rows[2]?.startEvent.currTerminalAbbrev).toBe("VAI");
    expect(renderState.rows[2]?.startEvent.currTerminalDisplayName).toBe(
      "Vashon Is."
    );
    expect(renderState.rows[2]?.startEvent.isArrivalPlaceholder).toBeTrue();
    expect(renderState.rows[2]?.startEvent.timePoint.scheduled).toBeUndefined();
    expect(renderState.rows[3]?.kind).toBe("at-sea");
    expect(renderState.rows[3]?.startLabel).toBe("To: FAU");
    expect(renderState.rows[3]?.terminalHeadline).toBeUndefined();
    expect(renderState.rows[3]?.showStartTimePlaceholder).toBeFalse();
    expect(renderState.rows[3]?.startEvent.nextTerminalAbbrev).toBe("FAU");
    expect(renderState.terminalCards.map((card) => card.position)).toEqual([
      "top",
      "bottom",
      "top",
      "bottom",
      "single",
    ]);
  });

  it("keeps static layout unchanged across clock ticks while the indicator moves", () => {
    const segments = makeRoundTripSegments();
    const activeState = makeActiveState({
      kind: "sea",
      rowMatch: {
        kind: "sea",
        startEventKey: "dep-1",
        endEventKey: "arv-1",
      },
      reason: "location_anchor",
    });
    const staticState = getStaticVesselTimelineRenderState(
      segments,
      activeState
    );
    const earlyIndicator = getVesselTimelineActiveIndicator({
      segments,
      activeState,
      liveState: makeLiveState({
        ScheduledDeparture: at(8, 0),
        AtDock: false,
        Speed: 12,
        LeftDock: at(8, 5),
        Eta: at(8, 45),
      }),
      now: at(8, 10),
    });
    const lateIndicator = getVesselTimelineActiveIndicator({
      segments,
      activeState,
      liveState: makeLiveState({
        ScheduledDeparture: at(8, 0),
        AtDock: false,
        Speed: 12,
        LeftDock: at(8, 5),
        Eta: at(8, 45),
      }),
      now: at(8, 20),
    });

    expect(getStaticVesselTimelineRenderState(segments, activeState)).toEqual(
      staticState
    );
    expect(earlyIndicator?.positionPercent).not.toBe(
      lateIndicator?.positionPercent
    );
  });

  it("returns renderer-ready rows with full schedule-based dock heights", () => {
    const renderState = getRenderState(
      makeRoundTripSegments(),
      makeLiveState({
        ScheduledDeparture: at(8, 0),
        AtDock: false,
        Speed: 12,
        ArrivingDistance: 4.2,
      }),
      makeActiveState({
        kind: "sea",
        rowMatch: {
          kind: "sea",
          startEventKey: "dep-1",
          endEventKey: "arv-1",
        },
        subtitle: "12 kn · 4.2 mi to BBI",
        animate: true,
        speedKnots: 12,
        reason: "location_anchor",
      }),
      at(8, 10)
    );

    expect(renderState.rows).toHaveLength(5);
    expect(renderState.rows[2]?.kind).toBe("at-dock");
    expect(renderState.rows[2]?.displayHeightPx).toBeGreaterThan(356);
    expect(renderState.rows[2]?.displayHeightPx).toBeLessThan(357);
    expect(renderState.activeIndicator?.rowId).toBe("dep-1--arv-1--sea");
    expect(renderState.contentHeightPx).toBeGreaterThan(0);
  });

  it("falls back to time-based sea progress when arrival distance is missing", () => {
    const renderState = getRenderState(
      makeRoundTripSegments(),
      makeLiveState({
        ScheduledDeparture: at(8, 0),
        AtDock: false,
        Speed: 12,
        DepartingDistance: 0,
        ArrivingDistance: undefined,
      }),
      makeActiveState({
        kind: "sea",
        rowMatch: {
          kind: "sea",
          startEventKey: "dep-1",
          endEventKey: "arv-1",
        },
        reason: "location_anchor",
      }),
      at(8, 20)
    );

    expect(renderState.activeIndicator?.rowId).toBe("dep-1--arv-1--sea");
    expect(renderState.activeIndicator?.positionPercent).toBeGreaterThan(0.57);
    expect(renderState.activeIndicator?.positionPercent).toBeLessThan(0.58);
  });

  it("uses time-based sea progress even when eta is present but arrival distance is missing", () => {
    const renderState = getRenderState(
      [
        makeSegment({
          id: "dep-1--arv-1--sea",
          segmentIndex: 0,
          kind: "sea",
          startEvent: makeBoundary({
            Key: "dep-1",
            EventType: "dep-dock",
            TerminalAbbrev: "P52",
            TerminalDisplayName: "Seattle",
            ScheduledDeparture: at(8, 0),
            EventScheduledTime: at(8, 0),
            EventActualTime: at(8, 5),
          }),
          endEvent: makeBoundary({
            Key: "arv-1",
            EventType: "arv-dock",
            TerminalAbbrev: "BBI",
            TerminalDisplayName: "Bainbridge Is.",
            ScheduledDeparture: at(8, 0),
            EventScheduledTime: at(8, 35),
          }),
          durationMinutes: 35,
        }),
      ],
      makeLiveState({
        ScheduledDeparture: at(8, 0),
        AtDock: false,
        Speed: 12,
        DepartingDistance: 0,
        ArrivingDistance: undefined,
        Eta: at(8, 45),
      }),
      makeActiveState({
        kind: "sea",
        rowMatch: {
          kind: "sea",
          startEventKey: "dep-1",
          endEventKey: "arv-1",
        },
        reason: "location_anchor",
      }),
      at(8, 25)
    );

    expect(renderState.activeIndicator?.rowId).toBe("dep-1--arv-1--sea");
    expect(renderState.activeIndicator?.positionPercent).toBeGreaterThan(0.66);
    expect(renderState.activeIndicator?.positionPercent).toBeLessThan(0.67);
  });

  it("uses elapsed time for dock indicator progress on long dock rows", () => {
    const renderState = getRenderState(
      [
        makeSegment({
          id: "arv-1--dep-1--dock",
          segmentIndex: 0,
          kind: "dock",
          startEvent: makeBoundary({
            Key: "arv-1",
            EventType: "arv-dock",
            TerminalAbbrev: "VAI",
            TerminalDisplayName: "Vashon Is.",
            ScheduledDeparture: at(11, 30),
            EventScheduledTime: at(11, 30),
          }),
          endEvent: makeBoundary({
            Key: "dep-1",
            EventType: "dep-dock",
            TerminalAbbrev: "VAI",
            TerminalDisplayName: "Vashon Is.",
            ScheduledDeparture: at(12, 35),
            EventScheduledTime: at(12, 35),
          }),
          durationMinutes: 65,
        }),
      ],
      null,
      makeActiveState({
        kind: "dock",
        rowMatch: {
          kind: "dock",
          startEventKey: "arv-1",
          endEventKey: "dep-1",
        },
        reason: "scheduled_window",
      }),
      at(12, 2)
    );

    expect(renderState.activeIndicator?.rowId).toBe("arv-1--dep-1--dock");
    expect(renderState.activeIndicator?.positionPercent).toBeGreaterThan(0.48);
    expect(renderState.activeIndicator?.positionPercent).toBeLessThan(0.51);
  });

  it("uses actual arrival and predicted departure for dock indicator progress", () => {
    const renderState = getRenderState(
      [
        makeSegment({
          id: "arv-1--dep-1--dock",
          segmentIndex: 0,
          kind: "dock",
          startEvent: makeBoundary({
            Key: "arv-1",
            EventType: "arv-dock",
            TerminalAbbrev: "FAU",
            TerminalDisplayName: "Fauntleroy",
            ScheduledDeparture: at(22, 50),
            EventScheduledTime: at(22, 50),
            EventActualTime: at(22, 58),
          }),
          endEvent: makeBoundary({
            Key: "dep-1",
            EventType: "dep-dock",
            TerminalAbbrev: "FAU",
            TerminalDisplayName: "Fauntleroy",
            ScheduledDeparture: at(23, 5),
            EventScheduledTime: at(23, 5),
            EventPredictedTime: at(23, 12),
          }),
          durationMinutes: 15,
        }),
      ],
      null,
      makeActiveState({
        kind: "dock",
        rowMatch: {
          kind: "dock",
          startEventKey: "arv-1",
          endEventKey: "dep-1",
        },
        subtitle: "At dock FAU",
        reason: "location_anchor",
      }),
      at(23, 5)
    );

    expect(renderState.activeIndicator?.rowId).toBe("arv-1--dep-1--dock");
    expect(renderState.activeIndicator?.label).toBe("7m");
    expect(renderState.activeIndicator?.positionPercent).toBeGreaterThan(0.49);
    expect(renderState.activeIndicator?.positionPercent).toBeLessThan(0.51);
  });

  it("centers the dock indicator when the selected row starts in the future", () => {
    const renderState = getRenderState(
      [
        makeSegment({
          id: "arv-future--dep-future--dock",
          segmentIndex: 0,
          kind: "dock",
          startEvent: makeBoundary({
            Key: "arv-future",
            EventType: "arv-dock",
            TerminalAbbrev: "MUK",
            TerminalDisplayName: "Mukilteo",
            ScheduledDeparture: at(14, 35),
            EventScheduledTime: at(14, 55),
          }),
          endEvent: makeBoundary({
            Key: "dep-future",
            EventType: "dep-dock",
            TerminalAbbrev: "MUK",
            TerminalDisplayName: "Mukilteo",
            ScheduledDeparture: at(15, 4),
            EventScheduledTime: at(15, 4),
          }),
          durationMinutes: 9,
        }),
      ],
      null,
      makeActiveState({
        kind: "dock",
        rowMatch: {
          kind: "dock",
          startEventKey: "arv-future",
          endEventKey: "dep-future",
        },
        subtitle: "At dock MUK",
        reason: "location_anchor",
      }),
      at(14, 22)
    );

    expect(renderState.activeIndicator?.rowId).toBe("arv-future--dep-future--dock");
    expect(renderState.activeIndicator?.label).toBe("42m");
    expect(renderState.activeIndicator?.positionPercent).toBe(0.5);
  });

  it("keeps the indicator visible but disables animation when the vessel is off-service", () => {
    const renderState = getRenderState(
      makeRoundTripSegments(),
      makeLiveState({
        InService: false,
        ScheduledDeparture: at(8, 0),
        AtDock: false,
        Speed: 12,
      }),
      makeActiveState({
        kind: "sea",
        rowMatch: {
          kind: "sea",
          startEventKey: "dep-1",
          endEventKey: "arv-1",
        },
        subtitle: "12 kn",
        animate: false,
        speedKnots: 12,
        reason: "location_anchor",
      }),
      at(8, 10)
    );

    expect(renderState.activeIndicator).not.toBeNull();
    expect(renderState.activeIndicator?.animate).toBeFalse();
    expect(renderState.activeIndicator?.speedKnots).toBe(12);
  });

  it("uses the terminal row when the backend resolves terminal-tail fallback", () => {
    const renderState = getRenderState(
      makeRoundTripSegments(),
      null,
      makeActiveState({
        kind: "scheduled-fallback",
        rowMatch: null,
        terminalTailEventKey: "arv-2",
        reason: "fallback",
      }),
      at(10, 30)
    );

    expect(renderState.activeIndicator?.rowId).toBe("arv-2--terminal");
    expect(renderState.activeIndicator?.label).toBe("--");
  });

  it("hides the active indicator when the backend provides no match", () => {
    const renderState = getRenderState(
      makeRoundTripSegments(),
      null,
      null,
      at(8, 10)
    );

    expect(renderState.activeIndicator).toBeNull();
  });
});

const makeRoundTripSegments = (): VesselTimelineSegment[] => [
  makeSegment({
    id: "dep-1--arrival-placeholder--dock",
    segmentIndex: 0,
    kind: "dock",
    placeholderReason: "start-of-day",
    startEvent: makeBoundary({
      Key: "dep-1--arrival-placeholder",
      EventType: "arv-dock",
      TerminalAbbrev: "P52",
      TerminalDisplayName: "Seattle",
      ScheduledDeparture: at(8, 0),
      IsArrivalPlaceholder: true,
    }),
    endEvent: makeBoundary({
      Key: "dep-1",
      EventType: "dep-dock",
      TerminalAbbrev: "P52",
      TerminalDisplayName: "Seattle",
      ScheduledDeparture: at(8, 0),
      EventScheduledTime: at(8, 0),
    }),
    durationMinutes: 0,
  }),
  makeSegment({
    id: "dep-1--arv-1--sea",
    segmentIndex: 1,
    kind: "sea",
    startEvent: makeBoundary({
      Key: "dep-1",
      EventType: "dep-dock",
      TerminalAbbrev: "P52",
      TerminalDisplayName: "Seattle",
      ScheduledDeparture: at(8, 0),
      EventScheduledTime: at(8, 0),
    }),
    endEvent: makeBoundary({
      Key: "arv-1",
      EventType: "arv-dock",
      TerminalAbbrev: "BBI",
      TerminalDisplayName: "Bainbridge Is.",
      ScheduledDeparture: at(8, 0),
      EventScheduledTime: at(8, 35),
    }),
    durationMinutes: 35,
  }),
  makeSegment({
    id: "arv-1--dep-2--dock",
    segmentIndex: 2,
    kind: "dock",
    startEvent: makeBoundary({
      Key: "arv-1",
      EventType: "arv-dock",
      TerminalAbbrev: "BBI",
      TerminalDisplayName: "Bainbridge Is.",
      ScheduledDeparture: at(8, 0),
      EventScheduledTime: at(8, 35),
    }),
    endEvent: makeBoundary({
      Key: "dep-2",
      EventType: "dep-dock",
      TerminalAbbrev: "BBI",
      TerminalDisplayName: "Bainbridge Is.",
      ScheduledDeparture: at(9, 50),
      EventScheduledTime: at(9, 50),
    }),
    durationMinutes: 75,
  }),
  makeSegment({
    id: "dep-2--arv-2--sea",
    segmentIndex: 3,
    kind: "sea",
    startEvent: makeBoundary({
      Key: "dep-2",
      EventType: "dep-dock",
      TerminalAbbrev: "BBI",
      TerminalDisplayName: "Bainbridge Is.",
      ScheduledDeparture: at(9, 50),
      EventScheduledTime: at(9, 50),
    }),
    endEvent: makeBoundary({
      Key: "arv-2",
      EventType: "arv-dock",
      TerminalAbbrev: "P52",
      TerminalDisplayName: "Seattle",
      ScheduledDeparture: at(9, 50),
      EventScheduledTime: at(10, 25),
    }),
    durationMinutes: 35,
  }),
  makeSegment({
    id: "arv-2--terminal",
    segmentIndex: 4,
    kind: "dock",
    isTerminal: true,
    startEvent: makeBoundary({
      Key: "arv-2",
      EventType: "arv-dock",
      TerminalAbbrev: "P52",
      TerminalDisplayName: "Seattle",
      ScheduledDeparture: at(9, 50),
      EventScheduledTime: at(10, 25),
    }),
    endEvent: makeBoundary({
      Key: "arv-2",
      EventType: "arv-dock",
      TerminalAbbrev: "P52",
      TerminalDisplayName: "Seattle",
      ScheduledDeparture: at(9, 50),
      EventScheduledTime: at(10, 25),
    }),
    durationMinutes: 0,
  }),
];

const makePlaceholderSegments = (): VesselTimelineSegment[] => [
  makeSegment({
    id: "arv-0--dep-0--dock",
    segmentIndex: 0,
    kind: "dock",
    startEvent: makeBoundary({
      Key: "arv-0",
      EventType: "arv-dock",
      TerminalAbbrev: "VAI",
      TerminalDisplayName: "Vashon Is.",
      ScheduledDeparture: at(7, 5),
      EventScheduledTime: at(7, 5),
    }),
    endEvent: makeBoundary({
      Key: "dep-0",
      EventType: "dep-dock",
      TerminalAbbrev: "VAI",
      TerminalDisplayName: "Vashon Is.",
      ScheduledDeparture: at(7, 5),
      EventScheduledTime: at(7, 5),
    }),
    durationMinutes: 0,
  }),
  makeSegment({
    id: "dep-0--arv-0b--sea",
    segmentIndex: 1,
    kind: "sea",
    startEvent: makeBoundary({
      Key: "dep-0",
      EventType: "dep-dock",
      TerminalAbbrev: "VAI",
      TerminalDisplayName: "Vashon Is.",
      ScheduledDeparture: at(7, 5),
      EventScheduledTime: at(7, 5),
    }),
    endEvent: makeBoundary({
      Key: "arv-0b",
      EventType: "arv-dock",
      TerminalAbbrev: "FAU",
      TerminalDisplayName: "Fauntleroy",
      ScheduledDeparture: at(7, 5),
      EventScheduledTime: at(7, 25),
    }),
    durationMinutes: 20,
  }),
  makeSegment({
    id: "dep-1--arrival-placeholder--dock",
    segmentIndex: 2,
    kind: "dock",
    placeholderReason: "broken-seam",
    startEvent: makeBoundary({
      Key: "dep-1--arrival-placeholder",
      EventType: "arv-dock",
      TerminalAbbrev: "VAI",
      TerminalDisplayName: "Vashon Is.",
      ScheduledDeparture: at(7, 55),
      IsArrivalPlaceholder: true,
    }),
    endEvent: makeBoundary({
      Key: "dep-1",
      EventType: "dep-dock",
      TerminalAbbrev: "VAI",
      TerminalDisplayName: "Vashon Is.",
      ScheduledDeparture: at(7, 55),
      EventScheduledTime: at(7, 55),
    }),
    durationMinutes: 0,
  }),
  makeSegment({
    id: "dep-1--arv-1--sea",
    segmentIndex: 3,
    kind: "sea",
    startEvent: makeBoundary({
      Key: "dep-1",
      EventType: "dep-dock",
      TerminalAbbrev: "VAI",
      TerminalDisplayName: "Vashon Is.",
      ScheduledDeparture: at(7, 55),
      EventScheduledTime: at(7, 55),
    }),
    endEvent: makeBoundary({
      Key: "arv-1",
      EventType: "arv-dock",
      TerminalAbbrev: "FAU",
      TerminalDisplayName: "Fauntleroy",
      ScheduledDeparture: at(7, 55),
      EventScheduledTime: at(8, 15),
    }),
    durationMinutes: 20,
  }),
  makeSegment({
    id: "arv-1--terminal",
    segmentIndex: 4,
    kind: "dock",
    isTerminal: true,
    startEvent: makeBoundary({
      Key: "arv-1",
      EventType: "arv-dock",
      TerminalAbbrev: "FAU",
      TerminalDisplayName: "Fauntleroy",
      ScheduledDeparture: at(7, 55),
      EventScheduledTime: at(8, 15),
    }),
    endEvent: makeBoundary({
      Key: "arv-1",
      EventType: "arv-dock",
      TerminalAbbrev: "FAU",
      TerminalDisplayName: "Fauntleroy",
      ScheduledDeparture: at(7, 55),
      EventScheduledTime: at(8, 15),
    }),
    durationMinutes: 0,
  }),
];

const makeBoundary = (
  overrides: Partial<VesselTimelineSegment["startEvent"]>
): VesselTimelineSegment["startEvent"] => ({
  Key: "event",
  ScheduledDeparture: undefined,
  TerminalAbbrev: "P52",
  EventType: "dep-dock",
  TerminalDisplayName: "Seattle",
  IsArrivalPlaceholder: undefined,
  EventScheduledTime: undefined,
  EventPredictedTime: undefined,
  EventActualTime: undefined,
  ...overrides,
});

const makeSegment = (
  overrides: Partial<VesselTimelineSegment>
): VesselTimelineSegment => ({
  id: "segment",
  segmentIndex: 0,
  kind: "sea",
  isTerminal: undefined,
  placeholderReason: undefined,
  startEvent: makeBoundary({ Key: "start" }),
  endEvent: makeBoundary({ Key: "end", EventType: "arv-dock" }),
  durationMinutes: 1,
  ...overrides,
});

const makeLiveState = (
  overrides: Partial<VesselTimelineLiveState>
): VesselTimelineLiveState => ({
  VesselName: "Tokitae",
  DepartingTerminalAbbrev: "P52",
  ArrivingTerminalAbbrev: "BBI",
  Speed: 0,
  InService: true,
  AtDock: true,
  ScheduledDeparture: undefined,
  LeftDock: undefined,
  Eta: undefined,
  TimeStamp: at(8, 0),
  DepartingDistance: 0,
  ArrivingDistance: undefined,
  ...overrides,
});

const makeActiveState = (
  overrides: Partial<VesselTimelineActiveState>
): VesselTimelineActiveState => ({
  kind: "unknown",
  rowMatch: null,
  terminalTailEventKey: undefined,
  subtitle: undefined,
  animate: false,
  speedKnots: 0,
  reason: "unknown",
  ...overrides,
});

const getRowOrThrow = (rows: VesselTimelineSegment[], index: number) => {
  const row = rows[index];

  if (!row) {
    throw new Error(`Expected timeline row at index ${index}`);
  }

  return row;
};

const getRenderState = (
  segments: VesselTimelineSegment[],
  liveState: VesselTimelineLiveState | null,
  activeState: VesselTimelineActiveState | null,
  now: Date
) => {
  const staticState = getStaticVesselTimelineRenderState(segments, activeState);

  return {
    ...staticState,
    activeIndicator: getVesselTimelineActiveIndicator({
      segments,
      activeState,
      liveState,
      now,
    }),
  };
};
