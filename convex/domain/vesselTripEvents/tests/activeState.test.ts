import { describe, expect, it } from "bun:test";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTripEvent } from "functions/vesselTripEvents/schemas";
import { resolveVesselTimelineActiveState } from "../activeState";

const at = (hours: number, minutes: number) =>
  Date.UTC(2026, 2, 24, hours, minutes);

describe("resolveVesselTimelineActiveState", () => {
  it("anchors to the dock row when the vessel is docked even if the prior sea row is still open", () => {
    const events = [
      makeEvent({
        Key: "dep-1",
        EventType: "dep-dock",
        TerminalAbbrev: "TAH",
        ScheduledDeparture: at(16, 40),
        ScheduledTime: at(16, 40),
        ActualTime: at(16, 42),
      }),
      makeEvent({
        Key: "arv-1",
        EventType: "arv-dock",
        TerminalAbbrev: "PTD",
        ScheduledDeparture: at(16, 40),
        ScheduledTime: at(16, 55),
        ActualTime: undefined,
      }),
      makeEvent({
        Key: "dep-2",
        EventType: "dep-dock",
        TerminalAbbrev: "PTD",
        ScheduledDeparture: at(17, 5),
        ScheduledTime: at(17, 5),
      }),
      makeEvent({
        Key: "arv-2",
        EventType: "arv-dock",
        TerminalAbbrev: "TAH",
        ScheduledDeparture: at(17, 5),
        ScheduledTime: at(17, 20),
      }),
    ];

    const resolved = resolveVesselTimelineActiveState({
      events,
      location: makeLocation({
        AtDock: true,
        Speed: 0,
        DepartingTerminalAbbrev: "PTD",
        ArrivingTerminalAbbrev: "TAH",
        ScheduledDeparture: at(17, 5),
        TimeStamp: at(16, 56),
      }),
    });

    expect(resolved.ActiveState?.kind).toBe("dock");
    expect(resolved.ActiveState?.rowMatch).toEqual({
      kind: "dock",
      startEventKey: "arv-1",
      endEventKey: "dep-2",
    });
    expect(resolved.ActiveState?.subtitle).toBe("At dock PTD");
    expect(resolved.ActiveState?.reason).toBe("location_anchor");
  });

  it("anchors to the sea row by scheduled departure when underway", () => {
    const resolved = resolveVesselTimelineActiveState({
      events: makeRoundTripEvents(),
      location: makeLocation({
        AtDock: false,
        Speed: 12,
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        ScheduledDeparture: at(8, 0),
        ArrivingDistance: 4.2,
        TimeStamp: at(8, 10),
      }),
    });

    expect(resolved.ActiveState?.kind).toBe("sea");
    expect(resolved.ActiveState?.rowMatch).toEqual({
      kind: "sea",
      startEventKey: "dep-1",
      endEventKey: "arv-1",
    });
    expect(resolved.ActiveState?.subtitle).toBe("12 kn · 4.2 mi to BBI");
    expect(resolved.ActiveState?.animate).toBeTrue();
  });

  it("falls back to the latest open actual row when no location is available", () => {
    const events = makeRoundTripEvents();
    events[0] = { ...events[0], ActualTime: at(8, 1) };
    events[1] = { ...events[1], ActualTime: undefined };

    const resolved = resolveVesselTimelineActiveState({
      events,
      observedAt: at(8, 20),
    });

    expect(resolved.ActiveState?.reason).toBe("open_actual_row");
    expect(resolved.ActiveState?.rowMatch).toEqual({
      kind: "sea",
      startEventKey: "dep-1",
      endEventKey: "arv-1",
    });
  });

  it("falls back to the scheduled window when no location anchor or actual row exists", () => {
    const resolved = resolveVesselTimelineActiveState({
      events: makeRoundTripEvents(),
      observedAt: at(9, 0),
    });

    expect(resolved.ActiveState?.kind).toBe("scheduled-fallback");
    expect(resolved.ActiveState?.reason).toBe("scheduled_window");
    expect(resolved.ActiveState?.rowMatch).toEqual({
      kind: "dock",
      startEventKey: "arv-1",
      endEventKey: "dep-2",
    });
  });

  it("uses terminal-pair fallback when underway without scheduled departure", () => {
    const resolved = resolveVesselTimelineActiveState({
      events: makeRoundTripEvents(),
      location: makeLocation({
        AtDock: false,
        Speed: 11,
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        ScheduledDeparture: undefined,
        ArrivingDistance: 2.5,
        TimeStamp: at(8, 10),
      }),
    });

    expect(resolved.ActiveState?.rowMatch).toEqual({
      kind: "sea",
      startEventKey: "dep-1",
      endEventKey: "arv-1",
    });
    expect(resolved.ActiveState?.terminalTailEventKey).toBeUndefined();
    expect(resolved.ActiveState?.reason).toBe("location_anchor");
  });

  it("returns a terminal-tail event key when the day ends after the final arrival", () => {
    const resolved = resolveVesselTimelineActiveState({
      events: makeRoundTripEvents(),
      observedAt: at(10, 30),
    });

    expect(resolved.ActiveState?.rowMatch).toBeNull();
    expect(resolved.ActiveState?.terminalTailEventKey).toBe("arv-2");
    expect(resolved.ActiveState?.reason).toBe("fallback");
  });

  it("does not emit a terminal-tail event key while the final arrival is still in the future", () => {
    const resolved = resolveVesselTimelineActiveState({
      events: makeRoundTripEvents(),
      observedAt: at(10, 20),
    });

    expect(resolved.ActiveState?.terminalTailEventKey).toBeUndefined();
    expect(resolved.ActiveState?.rowMatch).toEqual({
      kind: "sea",
      startEventKey: "dep-2",
      endEventKey: "arv-2",
    });
  });
});

const makeRoundTripEvents = (): ConvexVesselTripEvent[] => [
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
  overrides: Partial<ConvexVesselTripEvent>
): ConvexVesselTripEvent => ({
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
  overrides: Partial<ConvexVesselLocation>
): ConvexVesselLocation => ({
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
