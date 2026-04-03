/**
 * Covers the frontend render-state path from event-first inputs through
 * feature-derived rows.
 */

import { describe, expect, it } from "bun:test";
import type {
  VesselTimelineEvent,
  VesselTimelineLiveState,
} from "convex/functions/vesselTimeline/schemas";
import type { VesselTimelineRow, VesselTimelineRowEvent } from "../../types";
import {
  getStaticVesselTimelineRenderState,
  getVesselTimelineActiveIndicator,
  getVesselTimelineRenderState,
} from "..";

const at = (hours: number, minutes: number) =>
  new Date(Date.UTC(2026, 2, 18, hours, minutes));

describe("getStaticVesselTimelineRenderState", () => {
  it("renders derived placeholder and terminal-tail rows without extra synthesis", () => {
    const renderState = getStaticVesselTimelineRenderState(
      makeRows(),
      "trip-1--at-sea",
      getTerminalNameByAbbrev
    );

    expect(renderState.rows).toHaveLength(3);
    expect(renderState.activeRowIndex).toBe(1);
    expect(renderState.rows.map((row) => row.markerAppearance)).toEqual([
      "past",
      "past",
      "future",
    ]);
    expect(renderState.rows[0]?.showStartTimePlaceholder).toBeTrue();
    expect(renderState.rows[0]?.terminalHeadline).toBe("Seattle");
    expect(renderState.rows[1]?.startLabel).toBe("To: VAI");
    expect(renderState.rows[2]?.id).toBe("trip-1--at-dock--terminal-tail");
    expect(renderState.rows[2]?.isFinalRow).toBeTrue();
    expect(renderState.rows[2]?.terminalHeadline).toBe("Vashon Is.");
    expect(renderState.terminalCards.map((card) => card.position)).toEqual([
      "top",
      "bottom",
      "single",
    ]);
  });
});

describe("getVesselTimelineRenderState", () => {
  it("maps the backend active interval into a derived active sea row", () => {
    const renderState = getVesselTimelineRenderState({
      events: makeEventSlice(),
      activeInterval: {
        kind: "at-sea",
        startEventKey: "trip-1--dep-dock",
        endEventKey: "trip-1--arv-dock",
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
      getTerminalNameByAbbrev,
    });

    expect(renderState.activeRowIndex).toBe(1);
    expect(renderState.activeIndicator?.rowId).toBe("trip-1--at-sea");
    expect(renderState.activeIndicator?.subtitle).toBe("12 kn · 4.2 mi to VAI");
  });

  it("maps a post-arrival dock interval into the terminal-tail row", () => {
    const renderState = getVesselTimelineRenderState({
      events: makeEventSlice(),
      activeInterval: {
        kind: "at-dock",
        startEventKey: "trip-1--arv-dock",
        endEventKey: null,
      },
      liveState: makeLiveState({
        AtDock: true,
        DepartingTerminalAbbrev: "VAI",
      }),
      now: at(9, 0),
      getTerminalNameByAbbrev,
    });

    expect(renderState.activeRowIndex).toBe(2);
    expect(renderState.activeIndicator?.rowId).toBe(
      "trip-1--at-dock--terminal-tail"
    );
    expect(renderState.activeIndicator?.label).toBe("--");
  });
});

describe("getVesselTimelineActiveIndicator", () => {
  it("hides the active indicator when the backend provides no active row", () => {
    expect(
      getVesselTimelineActiveIndicator({
        rows: makeRows(),
        activeRowId: null,
        liveState: makeLiveState({
          AtDock: true,
          DepartingTerminalAbbrev: "VAI",
        }),
        now: at(9, 0),
      })
    ).toBeNull();
  });

  it("uses the selected render row for sea progress and subtitle copy", () => {
    const indicator = getVesselTimelineActiveIndicator({
      rows: makeRows(),
      activeRowId: "trip-1--at-sea",
      liveState: makeLiveState({
        AtDock: false,
        InService: true,
        Speed: 12,
        ArrivingDistance: 4.2,
        DepartingDistance: 3.8,
        ArrivingTerminalAbbrev: "VAI",
      }),
      now: at(8, 20),
    });

    expect(indicator?.rowId).toBe("trip-1--at-sea");
    expect(indicator?.subtitle).toBe("12 kn · 4.2 mi to VAI");
    expect(indicator?.animate).toBeTrue();
    expect(indicator?.positionPercent).toBeGreaterThan(0.47);
    expect(indicator?.positionPercent).toBeLessThan(0.48);
  });

  it("falls back to time-based sea progress when arrival distance is missing", () => {
    const indicator = getVesselTimelineActiveIndicator({
      rows: makeRows(),
      activeRowId: "trip-1--at-sea",
      liveState: makeLiveState({
        AtDock: false,
        InService: true,
        Speed: 12,
        ArrivingDistance: undefined,
        DepartingDistance: 0,
      }),
      now: at(8, 20),
    });

    expect(indicator?.label).toBe("15m");
    expect(indicator?.positionPercent).toBeGreaterThan(0.57);
    expect(indicator?.positionPercent).toBeLessThan(0.58);
  });

  it("uses actual arrival and predicted departure for dock progress", () => {
    const indicator = getVesselTimelineActiveIndicator({
      rows: [
        makeRow({
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
        }),
      ],
      activeRowId: "trip-7--at-dock",
      liveState: makeLiveState({
        AtDock: true,
        DepartingTerminalAbbrev: "FAU",
      }),
      now: at(23, 5),
    });

    expect(indicator?.rowId).toBe("trip-7--at-dock");
    expect(indicator?.label).toBe("7m");
    expect(indicator?.subtitle).toBe("At dock FAU");
    expect(indicator?.animate).toBeFalse();
    expect(indicator?.positionPercent).toBeGreaterThan(0.49);
    expect(indicator?.positionPercent).toBeLessThan(0.51);
  });

  it("renders terminal-tail rows with a terminal stop label", () => {
    const indicator = getVesselTimelineActiveIndicator({
      rows: makeRows(),
      activeRowId: "trip-1--at-dock--terminal-tail",
      liveState: makeLiveState({
        AtDock: true,
        DepartingTerminalAbbrev: "VAI",
      }),
      now: at(9, 0),
    });

    expect(indicator?.rowId).toBe("trip-1--at-dock--terminal-tail");
    expect(indicator?.label).toBe("--");
    expect(indicator?.subtitle).toBe("At dock VAI");
    expect(indicator?.positionPercent).toBe(0);
  });
});

/**
 * Builds a compact derived-row fixture set with a placeholder dock row, a sea
 * row, and a terminal-tail dock row.
 *
 * @returns Feature-derived timeline rows for render-state tests
 */
const makeRows = (): VesselTimelineRow[] => [
  makeRow({
    rowId: "trip-1--at-dock",
    segmentKey: "trip-1",
    kind: "at-dock",
    rowEdge: "normal",
    placeholderReason: "start-of-day",
    startEvent: makeRowEvent({
      Key: "trip-1--arrival-placeholder",
      EventType: "arv-dock",
      TerminalAbbrev: "P52",
      ScheduledDeparture: at(8, 0),
      IsArrivalPlaceholder: true,
    }),
    endEvent: makeRowEvent({
      Key: "trip-1--dep-dock",
      EventType: "dep-dock",
      TerminalAbbrev: "P52",
      ScheduledDeparture: at(8, 0),
      EventScheduledTime: at(8, 0),
    }),
    durationMinutes: 0,
  }),
  makeRow({
    rowId: "trip-1--at-sea",
    segmentKey: "trip-1",
    kind: "at-sea",
    rowEdge: "normal",
    startEvent: makeRowEvent({
      Key: "trip-1--dep-dock",
      EventType: "dep-dock",
      TerminalAbbrev: "P52",
      ScheduledDeparture: at(8, 0),
      EventScheduledTime: at(8, 0),
    }),
    endEvent: makeRowEvent({
      Key: "trip-1--arv-dock",
      EventType: "arv-dock",
      TerminalAbbrev: "VAI",
      ScheduledDeparture: at(8, 0),
      EventScheduledTime: at(8, 35),
    }),
    durationMinutes: 35,
  }),
  makeRow({
    rowId: "trip-1--at-dock--terminal-tail",
    segmentKey: "trip-1",
    kind: "at-dock",
    rowEdge: "terminal-tail",
    startEvent: makeRowEvent({
      Key: "trip-1--arv-dock",
      EventType: "arv-dock",
      TerminalAbbrev: "VAI",
      ScheduledDeparture: at(8, 0),
      EventScheduledTime: at(8, 35),
    }),
    endEvent: makeRowEvent({
      Key: "trip-1--arv-dock",
      EventType: "arv-dock",
      TerminalAbbrev: "VAI",
      ScheduledDeparture: at(8, 0),
      EventScheduledTime: at(8, 35),
    }),
    durationMinutes: 0,
  }),
];

/**
 * Builds an event-first fixture slice used to exercise the full render-state
 * pipeline.
 *
 * @returns Ordered backend timeline events
 */
const makeEventSlice = (): VesselTimelineEvent[] => [
  makeEvent({
    SegmentKey: "trip-1",
    Key: "trip-1--dep-dock",
    EventType: "dep-dock",
    TerminalAbbrev: "P52",
    ScheduledDeparture: at(8, 0),
    EventScheduledTime: at(8, 0),
  }),
  makeEvent({
    SegmentKey: "trip-1",
    Key: "trip-1--arv-dock",
    EventType: "arv-dock",
    TerminalAbbrev: "VAI",
    ScheduledDeparture: at(8, 0),
    EventScheduledTime: at(8, 35),
  }),
];

/**
 * Builds a derived row event fixture.
 *
 * @param overrides - Field overrides for the event fixture
 * @returns Derived row event
 */
const makeRowEvent = (
  overrides: Partial<VesselTimelineRowEvent>
): VesselTimelineRowEvent => ({
  Key: "trip-1--dep-dock",
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  EventType: "dep-dock",
  IsArrivalPlaceholder: false,
  EventScheduledTime: at(8, 0),
  EventPredictedTime: undefined,
  EventActualTime: undefined,
  ...overrides,
});

/**
 * Builds a derived row fixture.
 *
 * @param overrides - Field overrides for the row fixture
 * @returns Feature-derived timeline row
 */
const makeRow = (overrides: Partial<VesselTimelineRow>): VesselTimelineRow => ({
  rowId: "trip-1--at-sea",
  segmentKey: "trip-1",
  kind: "at-sea",
  rowEdge: "normal",
  placeholderReason: undefined,
  startEvent: makeRowEvent({}),
  endEvent: makeRowEvent({
    Key: "trip-1--arv-dock",
    EventType: "arv-dock",
    TerminalAbbrev: "VAI",
    EventScheduledTime: at(8, 35),
  }),
  durationMinutes: 35,
  ...overrides,
});

/**
 * Builds a backend timeline event fixture.
 *
 * @param overrides - Field overrides for the backend event fixture
 * @returns Event-first timeline payload item
 */
const makeEvent = (
  overrides: Partial<VesselTimelineEvent>
): VesselTimelineEvent => ({
  SegmentKey: "trip-1",
  Key: "trip-1--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-18",
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  EventType: "dep-dock",
  EventScheduledTime: at(8, 0),
  EventPredictedTime: undefined,
  EventActualTime: undefined,
  ...overrides,
});

/**
 * Builds a live-state fixture for active-indicator tests.
 *
 * @param overrides - Field overrides for the live-state fixture
 * @returns Raw live-state payload
 */
const makeLiveState = (
  overrides: Partial<VesselTimelineLiveState>
): VesselTimelineLiveState => ({
  VesselName: "Wenatchee",
  AtDock: false,
  InService: true,
  Speed: 0,
  DepartingTerminalAbbrev: "P52",
  ArrivingTerminalAbbrev: "VAI",
  DepartingDistance: 0,
  ArrivingDistance: undefined,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: at(8, 0),
  TimeStamp: at(8, 10),
  ...overrides,
});

/**
 * Resolves full terminal names for render-state tests.
 *
 * @param terminalAbbrev - Terminal abbreviation used by derived rows
 * @returns Full terminal name, or `null`
 */
const getTerminalNameByAbbrev = (terminalAbbrev: string) =>
  (
    ({
      P52: "Seattle",
      VAI: "Vashon Island",
      FAU: "Fauntleroy",
    }) as const
  )[terminalAbbrev] ?? null;
