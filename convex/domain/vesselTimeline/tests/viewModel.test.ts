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
        inferredDockedTripKey: null,
      })
    ).toEqual({
      kind: "at-sea",
      startEventKey: "trip-1--dep-dock",
      endEventKey: "trip-1--arv-dock",
    });
  });

  it("returns a start-of-day dock interval for a keyless inferred docked trip", () => {
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
        inferredDockedTripKey: "trip-2",
      })
    ).toEqual({
      kind: "at-dock",
      startEventKey: null,
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
        inferredDockedTripKey: null,
      })
    ).toEqual({
      kind: "at-dock",
      startEventKey: "trip-1--arv-dock",
      endEventKey: null,
    });
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
