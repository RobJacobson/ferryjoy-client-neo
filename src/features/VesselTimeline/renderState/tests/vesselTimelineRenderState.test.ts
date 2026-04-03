/**
 * Covers the frontend render-state path for backend-owned VesselTimeline rows.
 */

import { describe, expect, it } from "bun:test";
import type {
  VesselTimelineLiveState,
  VesselTimelineRow,
  VesselTimelineRowEvent,
} from "convex/functions/vesselTimeline/schemas";
import {
  getStaticVesselTimelineRenderState,
  getVesselTimelineActiveIndicator,
} from "..";

const at = (hours: number, minutes: number) =>
  new Date(Date.UTC(2026, 2, 18, hours, minutes));

describe("getStaticVesselTimelineRenderState", () => {
  it("renders backend placeholder and terminal-tail rows without client synthesis", () => {
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
    expect(renderState.rows[2]?.id).toBe("trip-2--at-dock");
    expect(renderState.rows[2]?.isFinalRow).toBeTrue();
    expect(renderState.rows[2]?.terminalHeadline).toBe("Vashon Is.");
    expect(renderState.terminalCards.map((card) => card.position)).toEqual([
      "top",
      "bottom",
      "single",
    ]);
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

  it("uses the backend active row id for sea progress and subtitle copy", () => {
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
          tripKey: "trip-7",
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
      activeRowId: "trip-2--at-dock",
      liveState: makeLiveState({
        AtDock: true,
        DepartingTerminalAbbrev: "VAI",
      }),
      now: at(9, 0),
    });

    expect(indicator?.rowId).toBe("trip-2--at-dock");
    expect(indicator?.label).toBe("--");
    expect(indicator?.subtitle).toBe("At dock VAI");
    expect(indicator?.positionPercent).toBe(0);
  });
});

/**
 * Builds a compact backend-row fixture set with a placeholder dock row, a sea
 * row, and a terminal-tail dock row.
 *
 * @returns Backend-owned timeline rows for render-state tests
 */
const makeRows = (): VesselTimelineRow[] => [
  makeRow({
    rowId: "trip-1--at-dock",
    tripKey: "trip-1",
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
    tripKey: "trip-1",
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
    rowId: "trip-2--at-dock",
    tripKey: "trip-2",
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
 * Builds a backend row event fixture.
 *
 * @param overrides - Field overrides for the event fixture
 * @returns Backend row event
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
 * Builds a backend row fixture.
 *
 * @param overrides - Field overrides for the row fixture
 * @returns Backend-owned timeline row
 */
const makeRow = (overrides: Partial<VesselTimelineRow>): VesselTimelineRow => ({
  rowId: "trip-1--at-sea",
  tripKey: "trip-1",
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
 * @param terminalAbbrev - Terminal abbreviation used by backend rows
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
