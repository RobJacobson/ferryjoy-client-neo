import { describe, expect, it } from "bun:test";
import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
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

    expect(rows.map((row) => row.kind)).toEqual(["sea", "dock", "sea", "dock"]);
    expect(rows.map((row) => row.isTerminal === true)).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(rows[0]?.startEvent.EventType).toBe("dep-dock");
    expect(rows[0]?.endEvent.EventType).toBe("arv-dock");
    expect(rows[0]?.actualDurationMinutes).toBe(35);
    expect(rows[1]?.actualDurationMinutes).toBe(75);
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

    expect(rows).toHaveLength(2);
    expect(rows[0]?.actualDurationMinutes).toBe(35);
    expect(rows[0]?.displayDurationMinutes).toBe(35);
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

    expect(rows).toHaveLength(2);
    expect(rows[0]?.actualDurationMinutes).toBe(39);
    expect(rows[0]?.displayDurationMinutes).toBe(39);
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

    expect(rows).toHaveLength(2);
    expect(rows[0]?.kind).toBe("sea");
    expect(rows[0]?.actualDurationMinutes).toBe(1);
    expect(rows[0]?.displayDurationMinutes).toBe(1);
    expect(rows[1]?.isTerminal).toBeTrue();
  });
});

describe("getActiveRowIndex", () => {
  it("prefers a live-anchored sea row over clock-only progress", () => {
    const rows = buildTimelineRows(
      makeRoundTripEvents(),
      DEFAULT_VESSEL_TIMELINE_POLICY
    );

    rows[0] = {
      ...rows[0]!,
      startEvent: { ...rows[0]!.startEvent, ActualTime: at(8, 1) },
      endEvent: { ...rows[0]!.endEvent, ActualTime: undefined },
    };

    const activeRowIndex = getActiveRowIndex(
      rows,
      makeLocation({
        ScheduledDeparture: at(8, 0),
      }),
      at(8, 45)
    );

    expect(activeRowIndex).toBe(0);
  });

  it("falls back to clock-based row selection when there is no live anchor", () => {
    const rows = buildTimelineRows(
      makeRoundTripEvents(),
      DEFAULT_VESSEL_TIMELINE_POLICY
    );

    const activeRowIndex = getActiveRowIndex(rows, undefined, at(8, 50));

    expect(activeRowIndex).toBe(1);
  });

  it("uses the last actual-started and not-yet-actual-ended row", () => {
    const rows = buildTimelineRows(
      makeRoundTripEvents(),
      DEFAULT_VESSEL_TIMELINE_POLICY
    );

    rows[0] = {
      ...rows[0]!,
      startEvent: { ...rows[0]!.startEvent, ActualTime: at(8, 1) },
      endEvent: { ...rows[0]!.endEvent, ActualTime: at(8, 36) },
    };
    rows[1] = {
      ...rows[1]!,
      startEvent: { ...rows[1]!.startEvent, ActualTime: at(8, 36) },
      endEvent: { ...rows[1]!.endEvent, ActualTime: undefined },
    };

    expect(getActiveRowIndex(rows, undefined, at(8, 50))).toBe(1);
  });
});

describe("getVesselTimelineRenderState", () => {
  it("returns renderer-ready rows and a compressed dock row height", () => {
    const renderState = getVesselTimelineRenderState(
      makeRoundTripEvents(),
      makeLocation({
        ScheduledDeparture: at(8, 0),
        AtDock: false,
        Speed: 12,
      }),
      at(8, 10)
    );

    expect(renderState.rows).toHaveLength(4);
    expect(renderState.rows[1]?.kind).toBe("at-dock");
    expect(renderState.rows[1]?.displayHeightPx).toBe(260);
    expect(renderState.activeIndicator?.rowId).toBe("dep-1--arv-1--sea");
    expect(renderState.contentHeightPx).toBeGreaterThan(0);
  });

  it("keeps the indicator visible but disables animation when the vessel is off-service", () => {
    const renderState = getVesselTimelineRenderState(
      makeRoundTripEvents(),
      makeLocation({
        InService: false,
        ScheduledDeparture: at(8, 0),
        AtDock: false,
        Speed: 12,
      }),
      at(8, 10)
    );

    expect(renderState.activeIndicator).not.toBeNull();
    expect(renderState.activeIndicator?.animate).toBeFalse();
    expect(renderState.activeIndicator?.speedKnots).toBe(12);
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

const makeLocation = (
  overrides: Partial<VesselLocation>
): VesselLocation => ({
  VesselID: 1,
  VesselName: "Tokitae",
  VesselAbbrev: "TOK",
  DepartingTerminalID: 1,
  DepartingTerminalName: "Seattle",
  DepartingTerminalAbbrev: "P52",
  ArrivingTerminalID: 2,
  ArrivingTerminalName: "Bainbridge Island",
  ArrivingTerminalAbbrev: "BBI",
  Latitude: 0,
  Longitude: 0,
  Speed: 0,
  Heading: 0,
  InService: true,
  AtDock: true,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: undefined,
  RouteAbbrev: "sea-bi",
  VesselPositionNum: 1,
  TimeStamp: at(8, 0),
  DepartingDistance: undefined,
  ArrivingDistance: undefined,
  ...overrides,
});
