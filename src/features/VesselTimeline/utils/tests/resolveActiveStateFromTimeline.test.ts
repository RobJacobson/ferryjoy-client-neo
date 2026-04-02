import { describe, expect, it } from "bun:test";
import type { MergedTimelineBoundaryEvent, VesselLocation } from "@/types";
import { buildSegmentsFromBoundaryEvents } from "../buildSegmentsFromBoundaryEvents";
import { resolveActiveStateFromTimeline } from "../resolveActiveStateFromTimeline";

const at = (hours: number, minutes: number) =>
  new Date(Date.UTC(2026, 2, 24, hours, minutes));

describe("resolveActiveStateFromTimeline", () => {
  it("prefers the final terminal-tail arrival over an older dock row at the same terminal", () => {
    const resolved = resolveActiveStateFromTimeline({
      segments: buildSegmentsFromBoundaryEvents(
        makeRoundTripEvents(),
        (terminalAbbrev) => terminalAbbrev
      ),
      location: makeLocation({
        AtDock: true,
        DepartingTerminalAbbrev: "P52",
        ScheduledDeparture: undefined,
        TimeStamp: at(10, 30),
      }),
    });

    expect(resolved.ActiveState?.rowMatch).toBeNull();
    expect(resolved.ActiveState?.terminalTailEventKey).toBe("arv-2");
    expect(resolved.ActiveState?.subtitle).toBe("At dock P52");
    expect(resolved.ActiveState?.reason).toBe("location_anchor");
  });

  it("anchors dock fallback to the nearest same-terminal row when schedule context is missing", () => {
    const resolved = resolveActiveStateFromTimeline({
      segments: buildSegmentsFromBoundaryEvents(
        [
          makeEvent({
            Key: "arv-early",
            EventType: "arv-dock",
            TerminalAbbrev: "VAI",
            ScheduledDeparture: at(13, 45),
            EventScheduledTime: at(13, 55),
          }),
          makeEvent({
            Key: "dep-early",
            EventType: "dep-dock",
            TerminalAbbrev: "VAI",
            ScheduledDeparture: at(14, 5),
            EventScheduledTime: at(14, 5),
          }),
          makeEvent({
            Key: "arv-late",
            EventType: "arv-dock",
            TerminalAbbrev: "VAI",
            ScheduledDeparture: at(18, 35),
            EventScheduledTime: at(18, 35),
          }),
          makeEvent({
            Key: "dep-late",
            EventType: "dep-dock",
            TerminalAbbrev: "VAI",
            ScheduledDeparture: at(18, 40),
            EventScheduledTime: at(18, 40),
          }),
        ],
        (terminalAbbrev) => terminalAbbrev
      ),
      location: makeLocation({
        AtDock: true,
        DepartingTerminalAbbrev: "VAI",
        ScheduledDeparture: undefined,
        TimeStamp: at(14, 1),
      }),
    });

    expect(resolved.ActiveState?.rowMatch).toEqual({
      kind: "dock",
      startEventKey: "arv-early",
      endEventKey: "dep-early",
    });
    expect(resolved.ActiveState?.reason).toBe("location_anchor");
  });

  it("matches the start-of-day placeholder dock segment before the first departure", () => {
    const resolved = resolveActiveStateFromTimeline({
      segments: buildSegmentsFromBoundaryEvents(
        [
          makeEvent({
            Key: "dep-1",
            EventType: "dep-dock",
            TerminalAbbrev: "P52",
            ScheduledDeparture: at(8, 0),
            EventScheduledTime: at(8, 0),
          }),
          makeEvent({
            Key: "arv-1",
            EventType: "arv-dock",
            TerminalAbbrev: "BBI",
            ScheduledDeparture: at(8, 0),
            EventScheduledTime: at(8, 35),
          }),
        ],
        (terminalAbbrev) => terminalAbbrev
      ),
      location: makeLocation({
        AtDock: true,
        DepartingTerminalAbbrev: "P52",
        ScheduledDeparture: at(8, 0),
        TimeStamp: at(7, 58),
      }),
    });

    expect(resolved.ActiveState?.rowMatch).toEqual({
      kind: "dock",
      startEventKey: "dep-1--arrival-placeholder",
      endEventKey: "dep-1",
    });
    expect(resolved.ActiveState?.reason).toBe("location_anchor");
  });

  it("matches a broken-seam placeholder dock segment at the current terminal", () => {
    const resolved = resolveActiveStateFromTimeline({
      segments: buildSegmentsFromBoundaryEvents(
        [
          makeEvent({
            Key: "arv-0",
            EventType: "arv-dock",
            TerminalAbbrev: "VAI",
            ScheduledDeparture: at(7, 5),
            EventScheduledTime: at(7, 5),
          }),
          makeEvent({
            Key: "dep-0",
            EventType: "dep-dock",
            TerminalAbbrev: "VAI",
            ScheduledDeparture: at(7, 5),
            EventScheduledTime: at(7, 5),
          }),
          makeEvent({
            Key: "arv-0b",
            EventType: "arv-dock",
            TerminalAbbrev: "FAU",
            ScheduledDeparture: at(7, 5),
            EventScheduledTime: at(7, 25),
          }),
          makeEvent({
            Key: "dep-1",
            EventType: "dep-dock",
            TerminalAbbrev: "VAI",
            ScheduledDeparture: at(7, 55),
            EventScheduledTime: at(7, 55),
          }),
          makeEvent({
            Key: "arv-1",
            EventType: "arv-dock",
            TerminalAbbrev: "FAU",
            ScheduledDeparture: at(7, 55),
            EventScheduledTime: at(8, 15),
          }),
        ],
        (terminalAbbrev) => terminalAbbrev
      ),
      location: makeLocation({
        AtDock: true,
        DepartingTerminalAbbrev: "VAI",
        ScheduledDeparture: at(7, 55),
        TimeStamp: at(7, 54),
      }),
    });

    expect(resolved.ActiveState?.rowMatch).toEqual({
      kind: "dock",
      startEventKey: "dep-1--arrival-placeholder",
      endEventKey: "dep-1",
    });
    expect(resolved.ActiveState?.reason).toBe("location_anchor");
  });

  it("ignores a schedule-matched dock row when its arrival time is still in the future", () => {
    const resolved = resolveActiveStateFromTimeline({
      segments: buildSegmentsFromBoundaryEvents(
        [
          makeEvent({
            Key: "arv-current",
            EventType: "arv-dock",
            TerminalAbbrev: "MUK",
            ScheduledDeparture: at(13, 0),
            EventScheduledTime: at(13, 10),
            EventActualTime: at(13, 12),
          }),
          makeEvent({
            Key: "dep-current",
            EventType: "dep-dock",
            TerminalAbbrev: "MUK",
            ScheduledDeparture: at(13, 30),
            EventScheduledTime: at(13, 30),
          }),
          makeEvent({
            Key: "arv-future",
            EventType: "arv-dock",
            TerminalAbbrev: "MUK",
            ScheduledDeparture: at(14, 35),
            EventScheduledTime: at(14, 55),
          }),
          makeEvent({
            Key: "dep-future",
            EventType: "dep-dock",
            TerminalAbbrev: "MUK",
            ScheduledDeparture: at(15, 4),
            EventScheduledTime: at(15, 4),
          }),
        ],
        (terminalAbbrev) => terminalAbbrev
      ),
      location: makeLocation({
        AtDock: true,
        DepartingTerminalAbbrev: "MUK",
        ScheduledDeparture: at(15, 4),
        TimeStamp: at(14, 22),
      }),
    });

    expect(resolved.ActiveState?.rowMatch).toEqual({
      kind: "dock",
      startEventKey: "arv-current",
      endEventKey: "dep-current",
    });
    expect(resolved.ActiveState?.reason).toBe("location_anchor");
  });
});

const makeRoundTripEvents = (): MergedTimelineBoundaryEvent[] => [
  makeEvent({
    Key: "dep-1",
    EventType: "dep-dock",
    TerminalAbbrev: "P52",
    ScheduledDeparture: at(8, 0),
    EventScheduledTime: at(8, 0),
  }),
  makeEvent({
    Key: "arv-1",
    EventType: "arv-dock",
    TerminalAbbrev: "BBI",
    ScheduledDeparture: at(8, 0),
    EventScheduledTime: at(8, 35),
  }),
  makeEvent({
    Key: "dep-2",
    EventType: "dep-dock",
    TerminalAbbrev: "BBI",
    ScheduledDeparture: at(9, 50),
    EventScheduledTime: at(9, 50),
  }),
  makeEvent({
    Key: "arv-2",
    EventType: "arv-dock",
    TerminalAbbrev: "P52",
    ScheduledDeparture: at(9, 50),
    EventScheduledTime: at(10, 25),
  }),
];

const makeEvent = (
  overrides: Partial<MergedTimelineBoundaryEvent>
): MergedTimelineBoundaryEvent => ({
  Key: "event",
  VesselAbbrev: "TOK",
  SailingDay: "2026-03-24",
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  EventType: "dep-dock",
  EventScheduledTime: at(8, 0),
  EventPredictedTime: undefined,
  EventActualTime: undefined,
  ...overrides,
});

const makeLocation = (
  overrides: Partial<VesselLocation> = {}
): VesselLocation => ({
  VesselID: 2,
  VesselName: "Tokitae",
  VesselAbbrev: "TOK",
  DepartingTerminalID: 1,
  DepartingTerminalName: "Seattle",
  DepartingTerminalAbbrev: "P52",
  ArrivingTerminalID: undefined,
  ArrivingTerminalName: undefined,
  ArrivingTerminalAbbrev: undefined,
  Latitude: 47.6,
  Longitude: -122.3,
  Speed: 0,
  Heading: 0,
  InService: true,
  AtDock: true,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: undefined,
  RouteAbbrev: "sea-bi",
  VesselPositionNum: 1,
  TimeStamp: at(10, 30),
  DepartingDistance: 0,
  ArrivingDistance: undefined,
  ...overrides,
});
