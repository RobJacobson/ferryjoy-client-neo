import { describe, expect, it } from "bun:test";
import type {
  VesselTimelineActiveState,
  VesselTimelineLiveState,
} from "convex/functions/vesselTripEvents/activeStateSchemas";
import type { VesselTripEvent } from "convex/functions/vesselTripEvents/schemas";
import { buildTimelineRows } from "../buildTimelineRows";
import { getActiveRowIndex } from "../getActiveRowIndex";
import { getVesselTimelineRenderState } from "../getVesselTimelineRenderState";

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

  it("builds sea, dock, sea, and terminal rows from ordered events", () => {
    const rows = buildTimelineRows([
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
    ]);

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
    expect(rows[1]?.durationMinutes).toBe(35);
    expect(rows[2]?.durationMinutes).toBe(75);
  });

  it("keeps long dock rows at their full schedule-based duration", () => {
    const rows = buildTimelineRows([
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
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("dock");
    expect(rows[0]?.durationMinutes).toBe(85);
  });

  it("keeps layout durations anchored to scheduled times when live times differ", () => {
    const rows = buildTimelineRows([
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
    ]);

    expect(rows).toHaveLength(3);
    expect(rows[1]?.durationMinutes).toBe(35);
  });

  it("falls back from scheduled to actual to predicted for layout timing", () => {
    const rows = buildTimelineRows([
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
    ]);

    expect(rows).toHaveLength(3);
    expect(rows[1]?.durationMinutes).toBe(39);
  });

  it("falls back to a one-minute minimum duration when timestamps are missing", () => {
    const rows = buildTimelineRows([
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
    ]);

    expect(rows).toHaveLength(3);
    expect(rows[1]?.kind).toBe("sea");
    expect(rows[1]?.durationMinutes).toBe(1);
    expect(rows[2]?.isTerminal).toBeTrue();
  });
});

describe("getActiveRowIndex", () => {
  it("prefers a live-anchored sea row over clock-only progress", () => {
    const rows = buildTimelineRows(makeRoundTripEvents());
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
    const rows = buildTimelineRows(makeRoundTripEvents());

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
    const rows = buildTimelineRows(makeRoundTripEvents());

    expect(getActiveRowIndex(rows, null)).toBe(-1);
  });
});

describe("getVesselTimelineRenderState", () => {
  it("returns renderer-ready rows with full schedule-based dock heights", () => {
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
    expect(renderState.rows[2]?.displayHeightPx).toBe(300);
    expect(renderState.activeIndicator?.rowId).toBe("dep-1--arv-1--sea");
    expect(renderState.contentHeightPx).toBeGreaterThan(0);
  });

  it("uses live distance only for sea indicator progress", () => {
    const renderState = getVesselTimelineRenderState(
      makeRoundTripEvents(),
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
        makeEvent({
          Key: "dep-1",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(8, 0),
          ScheduledTime: at(8, 0),
          ActualTime: at(8, 5),
        }),
        makeEvent({
          Key: "arv-1",
          EventType: "arv-dock",
          TerminalAbbrev: "BBI",
          ScheduledDeparture: at(8, 0),
          ScheduledTime: at(8, 35),
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
        makeEvent({
          Key: "arv-1",
          EventType: "arv-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(11, 30),
          ScheduledTime: at(11, 30),
        }),
        makeEvent({
          Key: "dep-1",
          EventType: "dep-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(12, 35),
          ScheduledTime: at(12, 35),
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
