import { describe, expect, it } from "bun:test";
import type { MergedTimelineBoundaryEvent } from "convex/functions/vesselTimeline/schemas";
import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import { resolveActiveStateFromTimeline } from "../resolveActiveStateFromTimeline";

const at = (hours: number, minutes: number) =>
  new Date(Date.UTC(2026, 2, 24, hours, minutes));

const atMs = (hours: number, minutes: number) => at(hours, minutes).getTime();

describe("resolveActiveStateFromTimeline", () => {
  it("prefers the final terminal-tail arrival over an older dock row at the same terminal", () => {
    const resolved = resolveActiveStateFromTimeline({
      events: makeRoundTripEvents(),
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
      events: [
        makeEvent({
          Key: "arv-early",
          EventType: "arv-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(13, 45),
          ScheduledTime: at(13, 55),
        }),
        makeEvent({
          Key: "dep-early",
          EventType: "dep-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(14, 5),
          ScheduledTime: at(14, 5),
        }),
        makeEvent({
          Key: "arv-late",
          EventType: "arv-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(18, 35),
          ScheduledTime: at(18, 35),
        }),
        makeEvent({
          Key: "dep-late",
          EventType: "dep-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(18, 40),
          ScheduledTime: at(18, 40),
        }),
      ],
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
});

const makeRoundTripEvents = (): MergedTimelineBoundaryEvent[] => [
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

const makeEvent = (
  overrides: Partial<MergedTimelineBoundaryEvent>
): MergedTimelineBoundaryEvent => ({
  Key: "event",
  VesselAbbrev: "TOK",
  SailingDay: "2026-03-24",
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  EventType: "dep-dock",
  ScheduledTime: at(8, 0),
  PredictedTime: undefined,
  ActualTime: undefined,
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
  TimeStamp: atMs(10, 30),
  DepartingDistance: undefined,
  ArrivingDistance: undefined,
  ...overrides,
});
