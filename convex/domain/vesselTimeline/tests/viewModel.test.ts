/**
 * Covers the event-first VesselTimeline backend helpers.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexActualBoundaryEvent } from "../../../functions/eventsActual/schemas";
import type { ConvexPredictedBoundaryEvent } from "../../../functions/eventsPredicted/schemas";
import type { ConvexScheduledBoundaryEvent } from "../../../functions/eventsScheduled/schemas";
import type { ConvexVesselLocation } from "../../../functions/vesselLocation/schemas";
import { resolveActiveInterval } from "../activeInterval";
import { mergeTimelineEvents } from "../timelineEvents";

const at = (hours: number, minutes: number, day = 25) =>
  Date.UTC(2026, 2, day, hours, minutes);

describe("mergeTimelineEvents", () => {
  it("merges sparse actual and predicted overlays onto ordered events", () => {
    const events = mergeTimelineEvents({
      scheduledEvents: [
        makeScheduledEvent({
          SegmentKey: undefined,
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 0),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "BBI",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 35),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "trip-1--dep-dock",
          EventActualTime: at(8, 4),
        }),
      ],
      predictedEvents: [
        makePredictedEvent({
          Key: "trip-1--arv-dock",
          EventPredictedTime: at(8, 40),
        }),
      ],
    });

    expect(events.map((event) => event.Key)).toEqual([
      "trip-1--dep-dock",
      "trip-1--arv-dock",
    ]);
    expect(events[0]).toMatchObject({
      SegmentKey: "trip-1",
      EventActualTime: at(8, 4),
    });
    expect(events[1]).toMatchObject({
      SegmentKey: "trip-1",
      EventPredictedTime: at(8, 40),
    });
  });
});

describe("resolveActiveInterval", () => {
  it("returns the active sea interval from the live segment key", () => {
    const events = mergeTimelineEvents({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 0),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "BBI",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 35),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
    });

    expect(
      resolveActiveInterval({
        events,
        location: makeLocation({
          AtDock: false,
          Key: "trip-1",
          TimeStamp: at(8, 10),
        }),
      })
    ).toEqual({
      kind: "at-sea",
      startEventKey: "trip-1--dep-dock",
      endEventKey: "trip-1--arv-dock",
    });
  });

  it("returns a start-of-day dock interval before the first same-day departure", () => {
    const events = mergeTimelineEvents({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-2--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "CLI",
          ScheduledDeparture: at(11, 0),
          EventScheduledTime: at(11, 0),
        }),
        makeScheduledEvent({
          Key: "trip-2--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "MUK",
          ScheduledDeparture: at(11, 0),
          EventScheduledTime: at(11, 35),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
    });

    expect(
      resolveActiveInterval({
        events,
        location: makeLocation({
          AtDock: true,
          Key: undefined,
          DepartingTerminalAbbrev: "CLI",
          TimeStamp: at(10, 55),
        }),
      })
    ).toEqual({
      kind: "at-dock",
      startEventKey: null,
      endEventKey: "trip-2--dep-dock",
    });
  });

  it("anchors the first dock interval to a carry-in arrival from the prior sailing day", () => {
    const events = mergeTimelineEvents({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-0--arv-dock",
          SailingDay: "2026-03-24",
          EventType: "arv-dock",
          TerminalAbbrev: "CLI",
          ScheduledDeparture: at(22, 0, 24),
          EventScheduledTime: at(22, 35, 24),
        }),
        makeScheduledEvent({
          Key: "trip-2--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "CLI",
          ScheduledDeparture: at(11, 0),
          EventScheduledTime: at(11, 0),
        }),
        makeScheduledEvent({
          Key: "trip-2--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "MUK",
          ScheduledDeparture: at(11, 0),
          EventScheduledTime: at(11, 35),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "trip-0--arv-dock",
          SailingDay: "2026-03-24",
          ScheduledDeparture: at(22, 0, 24),
          TerminalAbbrev: "CLI",
          EventActualTime: at(22, 42, 24),
        }),
      ],
      predictedEvents: [],
    });

    expect(
      resolveActiveInterval({
        events,
        location: makeLocation({
          AtDock: true,
          Key: undefined,
          DepartingTerminalAbbrev: "CLI",
          TimeStamp: at(10, 55),
        }),
      })
    ).toEqual({
      kind: "at-dock",
      startEventKey: "trip-0--arv-dock",
      endEventKey: "trip-2--dep-dock",
    });
  });

  it("returns a post-arrival dock interval when the vessel is docked at the arrival terminal", () => {
    const events = mergeTimelineEvents({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "FAU",
          ScheduledDeparture: at(19, 0),
          EventScheduledTime: at(19, 0),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(19, 0),
          EventScheduledTime: at(19, 30),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
    });

    expect(
      resolveActiveInterval({
        events,
        location: makeLocation({
          AtDock: true,
          Key: "trip-1",
          DepartingTerminalAbbrev: "VAI",
          TimeStamp: at(19, 58),
        }),
      })
    ).toEqual({
      kind: "at-dock",
      startEventKey: "trip-1--arv-dock",
      endEventKey: null,
    });
  });

  it("returns a normal dock interval when the vessel is between same-terminal arrival and departure", () => {
    const events = mergeTimelineEvents({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "ORI",
          ScheduledDeparture: at(15, 20),
          EventScheduledTime: at(16, 15),
        }),
        makeScheduledEvent({
          Key: "trip-2--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "ORI",
          ScheduledDeparture: at(16, 35),
          EventScheduledTime: at(16, 35),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
    });

    expect(
      resolveActiveInterval({
        events,
        location: makeLocation({
          AtDock: true,
          Key: undefined,
          DepartingTerminalAbbrev: "ORI",
          TimeStamp: at(16, 20),
        }),
      })
    ).toEqual({
      kind: "at-dock",
      startEventKey: "trip-1--arv-dock",
      endEventKey: "trip-2--dep-dock",
    });
  });

  it("keeps delayed dock ownership structural even when actual arrival lands after the next departure's scheduled time", () => {
    const events = mergeTimelineEvents({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "ORI",
          ScheduledDeparture: at(15, 20),
          EventScheduledTime: at(16, 15),
        }),
        makeScheduledEvent({
          Key: "trip-2--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "ORI",
          ScheduledDeparture: at(16, 35),
          EventScheduledTime: at(16, 35),
        }),
        makeScheduledEvent({
          Key: "trip-2--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "SHI",
          ScheduledDeparture: at(16, 35),
          EventScheduledTime: at(16, 45),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "trip-1--arv-dock",
          ScheduledDeparture: at(15, 20),
          TerminalAbbrev: "ORI",
          EventActualTime: at(16, 40),
        }),
      ],
      predictedEvents: [],
    });

    expect(
      resolveActiveInterval({
        events,
        location: makeLocation({
          AtDock: true,
          Key: undefined,
          DepartingTerminalAbbrev: "ORI",
          TimeStamp: at(16, 41),
        }),
      })
    ).toEqual({
      kind: "at-dock",
      startEventKey: "trip-1--arv-dock",
      endEventKey: "trip-2--dep-dock",
    });
  });

  it("uses the latest arrived boundary to recover the current dock interval when no live key is available", () => {
    const events = mergeTimelineEvents({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "ORI",
          ScheduledDeparture: at(13, 30),
          EventScheduledTime: at(13, 30),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "LOP",
          ScheduledDeparture: at(13, 30),
          EventScheduledTime: at(13, 55),
        }),
        makeScheduledEvent({
          Key: "trip-2--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "ANA",
          ScheduledDeparture: at(15, 20),
          EventScheduledTime: at(15, 20),
        }),
        makeScheduledEvent({
          Key: "trip-2--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "ORI",
          ScheduledDeparture: at(15, 20),
          EventScheduledTime: at(16, 15),
        }),
        makeScheduledEvent({
          Key: "trip-3--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "ORI",
          ScheduledDeparture: at(16, 35),
          EventScheduledTime: at(16, 35),
        }),
        makeScheduledEvent({
          Key: "trip-3--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "SHI",
          ScheduledDeparture: at(16, 35),
          EventScheduledTime: at(16, 45),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
    });

    expect(
      resolveActiveInterval({
        events,
        location: makeLocation({
          AtDock: true,
          Key: undefined,
          DepartingTerminalAbbrev: "ORI",
          TimeStamp: at(16, 20),
        }),
      })
    ).toEqual({
      kind: "at-dock",
      startEventKey: "trip-2--arv-dock",
      endEventKey: "trip-3--dep-dock",
    });
  });

  it("uses the live segment key as a structural tiebreak when one dock interval matches uniquely", () => {
    const events = mergeTimelineEvents({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "ORI",
          ScheduledDeparture: at(13, 30),
          EventScheduledTime: at(13, 30),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "LOP",
          ScheduledDeparture: at(13, 30),
          EventScheduledTime: at(13, 55),
        }),
        makeScheduledEvent({
          Key: "trip-2--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "ANA",
          ScheduledDeparture: at(15, 20),
          EventScheduledTime: at(15, 20),
        }),
        makeScheduledEvent({
          Key: "trip-2--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "ORI",
          ScheduledDeparture: at(15, 20),
          EventScheduledTime: at(16, 15),
        }),
        makeScheduledEvent({
          Key: "trip-3--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "ORI",
          ScheduledDeparture: at(16, 35),
          EventScheduledTime: at(16, 35),
        }),
        makeScheduledEvent({
          Key: "trip-3--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "SHI",
          ScheduledDeparture: at(16, 35),
          EventScheduledTime: at(16, 45),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
    });

    expect(
      resolveActiveInterval({
        events,
        location: makeLocation({
          AtDock: true,
          Key: "trip-2",
          DepartingTerminalAbbrev: "ORI",
          TimeStamp: at(16, 20),
        }),
      })
    ).toEqual({
      kind: "at-dock",
      startEventKey: "trip-2--arv-dock",
      endEventKey: "trip-3--dep-dock",
    });
  });

  it("ignores a future docked live key when the vessel has already arrived into an earlier dock interval", () => {
    const events = mergeTimelineEvents({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(16, 20),
          EventScheduledTime: at(16, 20),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "SOU",
          ScheduledDeparture: at(16, 20),
          EventScheduledTime: at(16, 30),
        }),
        makeScheduledEvent({
          Key: "trip-2--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "SOU",
          ScheduledDeparture: at(16, 50),
          EventScheduledTime: at(16, 50),
        }),
        makeScheduledEvent({
          Key: "trip-2--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(16, 50),
          EventScheduledTime: at(17, 0),
        }),
        makeScheduledEvent({
          Key: "trip-3--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(18, 20),
          EventScheduledTime: at(18, 20),
        }),
        makeScheduledEvent({
          Key: "trip-3--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "SOU",
          ScheduledDeparture: at(18, 20),
          EventScheduledTime: at(18, 30),
        }),
        makeScheduledEvent({
          Key: "trip-4--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "SOU",
          ScheduledDeparture: at(18, 45),
          EventScheduledTime: at(18, 45),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "trip-1--arv-dock",
          ScheduledDeparture: at(16, 20),
          TerminalAbbrev: "SOU",
          EventActualTime: at(16, 53),
        }),
      ],
      predictedEvents: [],
    });

    expect(
      resolveActiveInterval({
        events,
        location: makeLocation({
          AtDock: true,
          Key: "trip-4",
          DepartingTerminalAbbrev: "SOU",
          ArrivingTerminalAbbrev: "VAI",
          ScheduledDeparture: at(18, 45),
          TimeStamp: at(16, 56),
        }),
      })
    ).toEqual({
      kind: "at-dock",
      startEventKey: "trip-1--arv-dock",
      endEventKey: "trip-2--dep-dock",
    });
  });

  it("returns null when the live at-sea segment is missing its same-day arrival", () => {
    const events = mergeTimelineEvents({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(23, 50),
          EventScheduledTime: at(23, 50),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
    });

    expect(
      resolveActiveInterval({
        events,
        location: makeLocation({
          AtDock: false,
          Key: "trip-1",
          TimeStamp: at(23, 55),
        }),
      })
    ).toBeNull();
  });
});

const makeScheduledEvent = (
  overrides: Partial<ConvexScheduledBoundaryEvent> & { SegmentKey?: never }
): ConvexScheduledBoundaryEvent => ({
  Key: "trip-1--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  UpdatedAt: at(6, 0),
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  NextTerminalAbbrev: "BBI",
  EventType: "dep-dock",
  EventScheduledTime: at(8, 0),
  IsLastArrivalOfSailingDay: false,
  ...overrides,
});

const makeActualEvent = (
  overrides: Partial<ConvexActualBoundaryEvent>
): ConvexActualBoundaryEvent => ({
  Key: "trip-1--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  UpdatedAt: at(6, 0),
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  EventActualTime: at(8, 2),
  ...overrides,
});

const makePredictedEvent = (
  overrides: Partial<ConvexPredictedBoundaryEvent>
): ConvexPredictedBoundaryEvent => ({
  Key: "trip-1--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  UpdatedAt: at(6, 0),
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  EventPredictedTime: at(8, 5),
  PredictionType: "AtDockDepartCurr",
  PredictionSource: "ml",
  ...overrides,
});

const makeLocation = (
  overrides: Partial<ConvexVesselLocation>
): ConvexVesselLocation => ({
  VesselID: 1,
  VesselName: "Wenatchee",
  VesselAbbrev: "WEN",
  DepartingTerminalID: 1,
  DepartingTerminalName: "Seattle",
  DepartingTerminalAbbrev: "P52",
  ArrivingTerminalID: 2,
  ArrivingTerminalName: "Bainbridge",
  ArrivingTerminalAbbrev: "BBI",
  Latitude: 47.6,
  Longitude: -122.3,
  Speed: 0,
  Heading: 0,
  InService: true,
  AtDock: true,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: at(8, 0),
  RouteAbbrev: "SEA-BBI",
  VesselPositionNum: 1,
  TimeStamp: at(8, 0),
  Key: "trip-1",
  DepartingDistance: 0,
  ArrivingDistance: undefined,
  ...overrides,
});
