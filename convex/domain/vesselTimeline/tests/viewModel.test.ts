/**
 * Covers the event-first VesselTimeline backbone helpers.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexActualBoundaryEvent } from "../../../functions/eventsActual/schemas";
import type { ConvexPredictedBoundaryEvent } from "../../../functions/eventsPredicted/schemas";
import type { ConvexScheduledBoundaryEvent } from "../../../functions/eventsScheduled/schemas";
import { resolveActiveTimelineInterval } from "../../../shared/activeTimelineInterval";
import { mergeTimelineEvents } from "../timelineEvents";

const at = (hours: number, minutes: number, day = 25) =>
  Date.UTC(2026, 2, day, hours, minutes);

describe("mergeTimelineEvents", () => {
  it("merges sparse actual and predicted overlays onto ordered events", () => {
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

describe("resolveActiveTimelineInterval", () => {
  it("uses the opening dock interval when no actual events exist", () => {
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

    expect(resolveActiveTimelineInterval(events)).toEqual({
      kind: "at-dock",
      startEventKey: null,
      endEventKey: "trip-2--dep-dock",
    });
  });

  it("returns the sea interval after the latest actual departure", () => {
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
      actualEvents: [
        makeActualEvent({
          Key: "trip-1--dep-dock",
          EventActualTime: at(8, 4),
        }),
      ],
      predictedEvents: [],
    });

    expect(resolveActiveTimelineInterval(events)).toEqual({
      kind: "at-sea",
      startEventKey: "trip-1--dep-dock",
      endEventKey: "trip-1--arv-dock",
    });
  });

  it("advances to the sea interval when departure occurrence is known but time is unknown", () => {
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
      actualEvents: [
        makeActualEvent({
          Key: "trip-1--dep-dock",
          EventOccurred: true,
          EventActualTime: undefined,
        }),
      ],
      predictedEvents: [],
    });

    expect(resolveActiveTimelineInterval(events)).toEqual({
      kind: "at-sea",
      startEventKey: "trip-1--dep-dock",
      endEventKey: "trip-1--arv-dock",
    });
  });

  it("returns the dock interval after the latest actual arrival", () => {
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
        makeScheduledEvent({
          Key: "trip-2--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(20, 15),
          EventScheduledTime: at(20, 15),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "trip-1--arv-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(19, 0),
          EventActualTime: at(19, 41),
        }),
      ],
      predictedEvents: [],
    });

    expect(resolveActiveTimelineInterval(events)).toEqual({
      kind: "at-dock",
      startEventKey: "trip-1--arv-dock",
      endEventKey: "trip-2--dep-dock",
    });
  });

  it("returns the terminal-tail dock interval after the day's last actual arrival", () => {
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
      actualEvents: [
        makeActualEvent({
          Key: "trip-1--arv-dock",
          TerminalAbbrev: "VAI",
          ScheduledDeparture: at(19, 0),
          EventActualTime: at(19, 36),
        }),
      ],
      predictedEvents: [],
    });

    expect(resolveActiveTimelineInterval(events)).toEqual({
      kind: "at-dock",
      startEventKey: "trip-1--arv-dock",
      endEventKey: null,
    });
  });

  it("ignores predicted times when determining ownership", () => {
    const events = mergeTimelineEvents({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "ORI",
          ScheduledDeparture: at(15, 20),
          EventScheduledTime: at(15, 20),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "SHI",
          ScheduledDeparture: at(15, 20),
          EventScheduledTime: at(15, 45),
        }),
      ],
      actualEvents: [],
      predictedEvents: [
        makePredictedEvent({
          Key: "trip-1--dep-dock",
          ScheduledDeparture: at(15, 20),
          TerminalAbbrev: "ORI",
          EventPredictedTime: at(15, 10),
        }),
      ],
    });

    expect(resolveActiveTimelineInterval(events)).toEqual({
      kind: "at-dock",
      startEventKey: null,
      endEventKey: "trip-1--dep-dock",
    });
  });

  it("treats legacy actual-time rows as occurred even without EventOccurred", () => {
    const events = mergeTimelineEvents({
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "ORI",
          ScheduledDeparture: at(15, 20),
          EventScheduledTime: at(15, 20),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "SHI",
          ScheduledDeparture: at(15, 20),
          EventScheduledTime: at(15, 45),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          Key: "trip-1--dep-dock",
          EventOccurred: undefined,
          EventActualTime: at(15, 24),
        }),
      ],
      predictedEvents: [],
    });

    expect(resolveActiveTimelineInterval(events)).toEqual({
      kind: "at-sea",
      startEventKey: "trip-1--dep-dock",
      endEventKey: "trip-1--arv-dock",
    });
  });

  it("returns null when the latest actual boundary has no matching interval", () => {
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
      actualEvents: [
        makeActualEvent({
          Key: "trip-1--dep-dock",
          ScheduledDeparture: at(23, 50),
          EventActualTime: at(23, 55),
        }),
      ],
      predictedEvents: [],
    });

    expect(resolveActiveTimelineInterval(events)).toBeNull();
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
  EventOccurred: true,
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
