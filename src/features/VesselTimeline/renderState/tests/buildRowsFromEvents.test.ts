/**
 * Covers frontend row derivation from the event-first VesselTimeline payload.
 */

import { describe, expect, it } from "bun:test";
import type {
  VesselTimelineActiveInterval,
  VesselTimelineEvent,
} from "convex/functions/vesselTimeline/schemas";
import {
  buildRowsFromEvents,
  resolveActiveRowIdFromInterval,
} from "../buildRowsFromEvents";

const at = (hours: number, minutes: number) =>
  new Date(Date.UTC(2026, 2, 25, hours, minutes));

describe("buildRowsFromEvents", () => {
  it("derives dock, sea, and terminal-tail rows from ordered events", () => {
    const rows = buildRowsFromEvents([
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
    ]);

    expect(rows.map((row) => row.rowId)).toEqual([
      "trip-1--at-dock",
      "trip-1--at-sea",
      "trip-1--at-dock--terminal-tail",
    ]);
    expect(rows[0]?.placeholderReason).toBe("start-of-day");
    expect(rows[2]?.rowEdge).toBe("terminal-tail");
  });

  it("derives a normal dock row when an arrival precedes the departure", () => {
    const rows = buildRowsFromEvents([
      makeEvent({
        SegmentKey: "trip-0",
        Key: "trip-0--arv-dock",
        EventType: "arv-dock",
        TerminalAbbrev: "P52",
        ScheduledDeparture: at(7, 15),
        EventScheduledTime: at(7, 45),
      }),
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
        TerminalAbbrev: "BBI",
        ScheduledDeparture: at(8, 0),
        EventScheduledTime: at(8, 35),
      }),
    ]);

    expect(rows[0]?.placeholderReason).toBeUndefined();
    expect(rows[0]?.startEvent.Key).toBe("trip-0--arv-dock");
  });
});

describe("resolveActiveRowIdFromInterval", () => {
  it("maps a sea interval to the derived sea row", () => {
    const rows = buildRowsFromEvents(makeTwoLegEvents());

    expect(
      resolveActiveRowIdFromInterval(rows, {
        kind: "at-sea",
        startEventKey: "trip-1--dep-dock",
        endEventKey: "trip-1--arv-dock",
      })
    ).toBe("trip-1--at-sea");
  });

  it("maps a post-arrival dock interval to the terminal-tail row", () => {
    const rows = buildRowsFromEvents(makeTwoLegEvents());

    expect(
      resolveActiveRowIdFromInterval(rows, {
        kind: "at-dock",
        startEventKey: "trip-2--arv-dock",
        endEventKey: null,
      })
    ).toBe("trip-2--at-dock--terminal-tail");
  });

  it("returns null when the interval cannot be matched to a derived row", () => {
    const rows = buildRowsFromEvents(makeTwoLegEvents());

    expect(
      resolveActiveRowIdFromInterval(rows, {
        kind: "at-dock",
        startEventKey: null,
        endEventKey: "missing--dep-dock",
      })
    ).toBeNull();
  });
});

const makeTwoLegEvents = (): VesselTimelineEvent[] => [
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
  makeEvent({
    SegmentKey: "trip-2",
    Key: "trip-2--dep-dock",
    EventType: "dep-dock",
    TerminalAbbrev: "VAI",
    ScheduledDeparture: at(9, 0),
    EventScheduledTime: at(9, 0),
  }),
  makeEvent({
    SegmentKey: "trip-2",
    Key: "trip-2--arv-dock",
    EventType: "arv-dock",
    TerminalAbbrev: "P52",
    ScheduledDeparture: at(9, 0),
    EventScheduledTime: at(9, 35),
  }),
];

const makeEvent = (
  overrides: Partial<VesselTimelineEvent>
): VesselTimelineEvent => ({
  SegmentKey: "trip-1",
  Key: "trip-1--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  EventType: "dep-dock",
  EventScheduledTime: at(8, 0),
  EventPredictedTime: undefined,
  EventActualTime: undefined,
  ...overrides,
});
