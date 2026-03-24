import { describe, expect, it } from "bun:test";
import type { VesselTimelineSegment } from "convex/functions/vesselTimeline/schemas";
import type {
  VesselTimelineActiveState,
  VesselTimelineLiveState,
} from "convex/functions/vesselTripEvents/activeStateSchemas";
import { getVesselTimelineRenderState } from "../getVesselTimelineRenderState";
import { resolveActiveSegmentIndex } from "../resolveActiveSegmentIndex";

const at = (hours: number, minutes: number) =>
  new Date(Date.UTC(2026, 2, 18, hours, minutes));

describe("resolveActiveSegmentIndex", () => {
  it("prefers a live-anchored sea row over clock-only progress", () => {
    const rows = makeRoundTripSegments();
    const firstRow = getRowOrThrow(rows, 0);

    rows[0] = {
      ...firstRow,
      startEvent: { ...firstRow.startEvent, ActualTime: at(8, 1) },
      endEvent: { ...firstRow.endEvent, ActualTime: undefined },
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

    expect(activeRowIndex).toBe(0);
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

describe("getVesselTimelineRenderState", () => {
  it("renders server-owned placeholder and terminal-tail segments", () => {
    const renderState = getVesselTimelineRenderState(
      makePlaceholderSegments(),
      null,
      null,
      at(8, 0)
    );

    expect(renderState.rows).toHaveLength(5);
    expect(renderState.rows[2]?.kind).toBe("at-dock");
    expect(renderState.rows[2]?.startEvent.currTerminalAbbrev).toBe("VAI");
    expect(renderState.rows[2]?.startEvent.currTerminalDisplayName).toBe(
      "Vashon Is."
    );
    expect(renderState.rows[2]?.startEvent.isArrivalPlaceholder).toBeTrue();
    expect(renderState.rows[2]?.startEvent.timePoint.scheduled).toBeUndefined();
    expect(renderState.rows[3]?.kind).toBe("at-sea");
    expect(renderState.rows[3]?.startEvent.nextTerminalAbbrev).toBe("FAU");
    expect(renderState.terminalCards.map((card) => card.position)).toEqual([
      "top",
      "bottom",
      "top",
      "bottom",
      "single",
    ]);
  });

  it("returns renderer-ready rows with full schedule-based dock heights", () => {
    const renderState = getVesselTimelineRenderState(
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
    expect(renderState.rows[2]?.displayHeightPx).toBe(300);
    expect(renderState.activeIndicator?.rowId).toBe("dep-1--arv-1--sea");
    expect(renderState.contentHeightPx).toBeGreaterThan(0);
  });

  it("uses live distance only for sea indicator progress", () => {
    const renderState = getVesselTimelineRenderState(
      makeRoundTripSegments(),
      makeLiveState({
        ScheduledDeparture: at(8, 0),
        AtDock: false,
        Speed: 12,
        DepartingDistance: undefined,
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
    expect(renderState.activeIndicator?.positionPercent).toBe(0);
  });

  it("falls back to eta-over-actual-departure for sea progress when distances are missing", () => {
    const renderState = getVesselTimelineRenderState(
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
            ScheduledTime: at(8, 0),
            ActualTime: at(8, 5),
          }),
          endEvent: makeBoundary({
            Key: "arv-1",
            EventType: "arv-dock",
            TerminalAbbrev: "BBI",
            TerminalDisplayName: "Bainbridge Is.",
            ScheduledDeparture: at(8, 0),
            ScheduledTime: at(8, 35),
          }),
          durationMinutes: 35,
        }),
      ],
      makeLiveState({
        ScheduledDeparture: at(8, 0),
        AtDock: false,
        Speed: 12,
        DepartingDistance: undefined,
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
    expect(renderState.activeIndicator?.positionPercent).toBe(0.5);
  });

  it("uses elapsed time for dock indicator progress on long dock rows", () => {
    const renderState = getVesselTimelineRenderState(
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
            ScheduledTime: at(11, 30),
          }),
          endEvent: makeBoundary({
            Key: "dep-1",
            EventType: "dep-dock",
            TerminalAbbrev: "VAI",
            TerminalDisplayName: "Vashon Is.",
            ScheduledDeparture: at(12, 35),
            ScheduledTime: at(12, 35),
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

  it("keeps the indicator visible but disables animation when the vessel is off-service", () => {
    const renderState = getVesselTimelineRenderState(
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
    const renderState = getVesselTimelineRenderState(
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
  });

  it("hides the active indicator when the backend provides no match", () => {
    const renderState = getVesselTimelineRenderState(
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
      ScheduledTime: at(8, 0),
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
      ScheduledTime: at(8, 0),
    }),
    endEvent: makeBoundary({
      Key: "arv-1",
      EventType: "arv-dock",
      TerminalAbbrev: "BBI",
      TerminalDisplayName: "Bainbridge Is.",
      ScheduledDeparture: at(8, 0),
      ScheduledTime: at(8, 35),
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
      ScheduledTime: at(8, 35),
    }),
    endEvent: makeBoundary({
      Key: "dep-2",
      EventType: "dep-dock",
      TerminalAbbrev: "BBI",
      TerminalDisplayName: "Bainbridge Is.",
      ScheduledDeparture: at(9, 50),
      ScheduledTime: at(9, 50),
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
      ScheduledTime: at(9, 50),
    }),
    endEvent: makeBoundary({
      Key: "arv-2",
      EventType: "arv-dock",
      TerminalAbbrev: "P52",
      TerminalDisplayName: "Seattle",
      ScheduledDeparture: at(9, 50),
      ScheduledTime: at(10, 25),
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
      ScheduledTime: at(10, 25),
    }),
    endEvent: makeBoundary({
      Key: "arv-2",
      EventType: "arv-dock",
      TerminalAbbrev: "P52",
      TerminalDisplayName: "Seattle",
      ScheduledDeparture: at(9, 50),
      ScheduledTime: at(10, 25),
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
      ScheduledTime: at(7, 5),
    }),
    endEvent: makeBoundary({
      Key: "dep-0",
      EventType: "dep-dock",
      TerminalAbbrev: "VAI",
      TerminalDisplayName: "Vashon Is.",
      ScheduledDeparture: at(7, 5),
      ScheduledTime: at(7, 5),
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
      ScheduledTime: at(7, 5),
    }),
    endEvent: makeBoundary({
      Key: "arv-0b",
      EventType: "arv-dock",
      TerminalAbbrev: "FAU",
      TerminalDisplayName: "Fauntleroy",
      ScheduledDeparture: at(7, 5),
      ScheduledTime: at(7, 25),
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
      ScheduledTime: at(7, 55),
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
      ScheduledTime: at(7, 55),
    }),
    endEvent: makeBoundary({
      Key: "arv-1",
      EventType: "arv-dock",
      TerminalAbbrev: "FAU",
      TerminalDisplayName: "Fauntleroy",
      ScheduledDeparture: at(7, 55),
      ScheduledTime: at(8, 15),
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
      ScheduledTime: at(8, 15),
    }),
    endEvent: makeBoundary({
      Key: "arv-1",
      EventType: "arv-dock",
      TerminalAbbrev: "FAU",
      TerminalDisplayName: "Fauntleroy",
      ScheduledDeparture: at(7, 55),
      ScheduledTime: at(8, 15),
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
  ScheduledTime: undefined,
  PredictedTime: undefined,
  ActualTime: undefined,
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
  DepartingDistance: undefined,
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
