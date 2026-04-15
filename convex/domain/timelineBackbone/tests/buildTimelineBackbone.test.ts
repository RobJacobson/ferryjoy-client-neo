import { describe, expect, it } from "bun:test";
import type { ConvexActualBoundaryEvent } from "../../../functions/eventsActual/schemas";
import type { ConvexPredictedBoundaryEvent } from "../../../functions/eventsPredicted/schemas";
import type { ConvexScheduledBoundaryEvent } from "../../../functions/eventsScheduled/schemas";
import { buildTimelineBackbone } from "..";

const at = (hours: number, minutes: number, day = 25) =>
  Date.UTC(2026, 2, day, hours, minutes);

describe("buildTimelineBackbone", () => {
  it("returns vessel/day metadata plus merged ordered events", () => {
    const backbone = buildTimelineBackbone({
      VesselAbbrev: "WEN",
      SailingDay: "2026-03-25",
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          EventScheduledTime: at(8, 0),
        }),
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "BBI",
          EventScheduledTime: at(8, 35),
        }),
      ],
      actualEvents: [
        makeActualEvent({
          EventType: "dep-dock",
          EventActualTime: at(8, 4),
        }),
      ],
      predictedEvents: [
        makePredictedEvent({
          Key: "trip-1--arv-dock",
          TerminalAbbrev: "BBI",
          EventPredictedTime: at(8, 40),
        }),
      ],
    });

    expect(backbone).toMatchObject({
      VesselAbbrev: "WEN",
      SailingDay: "2026-03-25",
      events: [
        {
          Key: "trip-1--dep-dock",
          SegmentKey: "trip-1",
          EventActualTime: at(8, 4),
        },
        {
          Key: "trip-1--arv-dock",
          SegmentKey: "trip-1",
          EventPredictedTime: at(8, 40),
        },
      ],
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
  IsLastArrivalOfSailingDay: false,
  ...overrides,
});

const makeActualEvent = (
  overrides: Partial<ConvexActualBoundaryEvent>
): ConvexActualBoundaryEvent => ({
  EventKey: "WEN trip-1 dep-dock",
  TripKey: "WEN trip-1",
  ScheduleKey: "trip-1",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  UpdatedAt: at(6, 0),
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  EventType: "dep-dock",
  EventOccurred: true,
  EventActualTime: at(8, 4),
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
