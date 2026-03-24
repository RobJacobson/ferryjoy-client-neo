import { describe, expect, it } from "bun:test";
import type {
  VesselTimelineActiveState,
  VesselTimelineLiveState,
} from "convex/functions/vesselTripEvents/activeStateSchemas";
import type { VesselTripEvent } from "convex/functions/vesselTripEvents/schemas";
import { buildTimelineRows } from "../buildTimelineRows";
import { getActiveRowIndex } from "../getActiveRowIndex";
import {
  DEFAULT_VESSEL_TIMELINE_POLICY,
  getVesselTimelineRenderState,
} from "../getVesselTimelineRenderState";

const at = (hours: number, minutes: number) =>
  new Date(Date.UTC(2026, 2, 18, hours, minutes));

describe("buildTimelineRows", () => {
  it("inserts an arrival placeholder dock row before an orphan departure", () => {
    const renderState = getVesselTimelineRenderState(
      [
        makeEvent({
          Key: "arv-0",
          EventType: "arv-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(7, 5),
          ScheduledTime: at(7, 5),
        }),
        makeEvent({
          Key: "dep-0",
          EventType: "dep-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(7, 5),
          ScheduledTime: at(7, 5),
        }),
        makeEvent({
          Key: "arv-0b",
          EventType: "arv-dock",
          TerminalAbbrev: "FAU",
          ScheduledDeparture: at(7, 5),
          ScheduledTime: at(7, 25),
        }),
        makeEvent({
          Key: "dep-1",
          EventType: "dep-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(7, 55),
          ScheduledTime: at(7, 55),
        }),
        makeEvent({
          Key: "arv-1",
          EventType: "arv-dock",
          TerminalAbbrev: "FAU",
          ScheduledDeparture: at(7, 55),
          ScheduledTime: at(8, 15),
        }),
      ],
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

  it("builds sea, dock, sea, and terminal rows from ordered events", () => {
    const rows = buildTimelineRows(
      [
        makeEvent({
          Key: "dep-1",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(8, 0),
          ScheduledTime: at(8, 0),
        }),
        makeEvent({
          Key: "arv-1",
          EventType: "arv-dock",
          TerminalAbbrev: "BBI",
          ScheduledDeparture: at(8, 0),
          ScheduledTime: at(8, 35),
        }),
        makeEvent({
          Key: "dep-2",
          EventType: "dep-dock",
          TerminalAbbrev: "BBI",
          ScheduledDeparture: at(9, 50),
          ScheduledTime: at(9, 50),
        }),
        makeEvent({
          Key: "arv-2",
          EventType: "arv-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(9, 50),
          ScheduledTime: at(10, 25),
        }),
      ],
      DEFAULT_VESSEL_TIMELINE_POLICY
    );

    expect(rows.map((row) => row.kind)).toEqual([
      "dock",
      "sea",
      "dock",
      "sea",
      "dock",
    ]);
    expect(rows.map((row) => row.isTerminal === true)).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(rows[0]?.startEvent.EventType).toBe("arv-dock");
    expect(rows[0]?.startEvent.IsArrivalPlaceholder).toBeTrue();
    expect(rows[1]?.startEvent.EventType).toBe("dep-dock");
    expect(rows[1]?.endEvent.EventType).toBe("arv-dock");
    expect(rows[1]?.actualDurationMinutes).toBe(35);
    expect(rows[2]?.actualDurationMinutes).toBe(75);
  });

  it("marks long dock rows as compressed using visible dock windows", () => {
    const rows = buildTimelineRows(
      [
        makeEvent({
          Key: "arv-1",
          EventType: "arv-dock",
          TerminalAbbrev: "BBI",
          ScheduledDeparture: at(8, 0),
          ScheduledTime: at(8, 35),
        }),
        makeEvent({
          Key: "dep-1",
          EventType: "dep-dock",
          TerminalAbbrev: "BBI",
          ScheduledDeparture: at(10, 0),
          ScheduledTime: at(10, 0),
        }),
      ],
      DEFAULT_VESSEL_TIMELINE_POLICY
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.displayMode).toBe("compressed-dock-break");
    expect(rows[0]?.actualDurationMinutes).toBe(85);
    expect(rows[0]?.displayDurationMinutes).toBe(60);
  });

  it("keeps layout durations anchored to scheduled times when live times differ", () => {
    const rows = buildTimelineRows(
      [
        makeEvent({
          Key: "dep-1",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(8, 0),
          ScheduledTime: at(8, 0),
          ActualTime: at(8, 2),
        }),
        makeEvent({
          Key: "arv-1",
          EventType: "arv-dock",
          TerminalAbbrev: "BBI",
          ScheduledDeparture: at(8, 0),
          ScheduledTime: at(8, 35),
          PredictedTime: at(8, 38),
          ActualTime: at(8, 37),
        }),
      ],
      DEFAULT_VESSEL_TIMELINE_POLICY
    );

    expect(rows).toHaveLength(3);
    expect(rows[1]?.actualDurationMinutes).toBe(35);
    expect(rows[1]?.displayDurationMinutes).toBe(35);
  });

  it("falls back from scheduled to actual to predicted for layout timing", () => {
    const rows = buildTimelineRows(
      [
        makeEvent({
          Key: "dep-1",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledTime: undefined,
          ActualTime: at(8, 1),
          PredictedTime: at(8, 2),
        }),
        makeEvent({
          Key: "arv-1",
          EventType: "arv-dock",
          TerminalAbbrev: "BBI",
          ScheduledTime: undefined,
          ActualTime: undefined,
          PredictedTime: at(8, 40),
        }),
      ],
      DEFAULT_VESSEL_TIMELINE_POLICY
    );

    expect(rows).toHaveLength(3);
    expect(rows[1]?.actualDurationMinutes).toBe(39);
    expect(rows[1]?.displayDurationMinutes).toBe(39);
  });

  it("falls back to a one-minute minimum duration when timestamps are missing", () => {
    const rows = buildTimelineRows(
      [
        makeEvent({
          Key: "dep-1",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledTime: undefined,
          PredictedTime: undefined,
          ActualTime: undefined,
        }),
        makeEvent({
          Key: "arv-1",
          EventType: "arv-dock",
          TerminalAbbrev: "BBI",
          ScheduledTime: undefined,
          PredictedTime: undefined,
          ActualTime: undefined,
        }),
      ],
      DEFAULT_VESSEL_TIMELINE_POLICY
    );

    expect(rows).toHaveLength(3);
    expect(rows[1]?.kind).toBe("sea");
    expect(rows[1]?.actualDurationMinutes).toBe(1);
    expect(rows[1]?.displayDurationMinutes).toBe(1);
    expect(rows[2]?.isTerminal).toBeTrue();
  });
});

describe("getActiveRowIndex", () => {
  it("prefers a live-anchored sea row over clock-only progress", () => {
    const rows = buildTimelineRows(
      makeRoundTripEvents(),
      DEFAULT_VESSEL_TIMELINE_POLICY
    );
    const firstRow = getRowOrThrow(rows, 0);

    rows[0] = {
      ...firstRow,
      startEvent: { ...firstRow.startEvent, ActualTime: at(8, 1) },
      endEvent: { ...firstRow.endEvent, ActualTime: undefined },
    };

    const activeRowIndex = getActiveRowIndex(
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
    const rows = buildTimelineRows(
      makeRoundTripEvents(),
      DEFAULT_VESSEL_TIMELINE_POLICY
    );

    const activeRowIndex = getActiveRowIndex(
      rows,
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
    const rows = buildTimelineRows(
      makeRoundTripEvents(),
      DEFAULT_VESSEL_TIMELINE_POLICY
    );

    expect(getActiveRowIndex(rows, null)).toBe(-1);
  });
});

describe("getVesselTimelineRenderState", () => {
  it("returns renderer-ready rows and a compressed dock row height", () => {
    const renderState = getVesselTimelineRenderState(
      makeRoundTripEvents(),
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
    expect(renderState.rows[2]?.displayHeightPx).toBe(260);
    expect(renderState.activeIndicator?.rowId).toBe("dep-1--arv-1--sea");
    expect(renderState.contentHeightPx).toBeGreaterThan(0);
  });

  it("keeps the indicator visible but disables animation when the vessel is off-service", () => {
    const renderState = getVesselTimelineRenderState(
      makeRoundTripEvents(),
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
      makeRoundTripEvents(),
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
      makeRoundTripEvents(),
      null,
      null,
      at(8, 10)
    );

    expect(renderState.activeIndicator).toBeNull();
  });
});

const makeRoundTripEvents = (): VesselTripEvent[] => [
  makeEvent({
    Key: "dep-1",
    EventType: "dep-dock",
    TerminalAbbrev: "P52",
    ScheduledDeparture: at(8, 0),
    ScheduledTime: at(8, 0),
  }),
  makeEvent({
    Key: "arv-1",
    EventType: "arv-dock",
    TerminalAbbrev: "BBI",
    ScheduledDeparture: at(8, 0),
    ScheduledTime: at(8, 35),
  }),
  makeEvent({
    Key: "dep-2",
    EventType: "dep-dock",
    TerminalAbbrev: "BBI",
    ScheduledDeparture: at(9, 50),
    ScheduledTime: at(9, 50),
  }),
  makeEvent({
    Key: "arv-2",
    EventType: "arv-dock",
    TerminalAbbrev: "P52",
    ScheduledDeparture: at(9, 50),
    ScheduledTime: at(10, 25),
  }),
];

const makeEvent = (overrides: Partial<VesselTripEvent>): VesselTripEvent => ({
  Key: "event",
  VesselAbbrev: "TOK",
  SailingDay: "2026-03-18",
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  EventType: "dep-dock",
  ScheduledTime: at(8, 0),
  PredictedTime: undefined,
  ActualTime: undefined,
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

/**
 * Returns a timeline row fixture by index and throws when it is unexpectedly
 * missing.
 *
 * @param rows - Timeline rows under test
 * @param index - Row index expected to exist
 * @returns Timeline row at the requested index
 */
const getRowOrThrow = (
  rows: ReturnType<typeof buildTimelineRows>,
  index: number
) => {
  const row = rows[index];

  if (!row) {
    throw new Error(`Expected timeline row at index ${index}`);
  }

  return row;
};
