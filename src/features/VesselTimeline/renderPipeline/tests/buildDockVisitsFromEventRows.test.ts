/**
 * Unit tests for client-owned event-row to dock-visit assembly.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexActualDockEvent } from "convex/functions/events/eventsActual/schemas";
import type { ConvexPredictedDockEvent } from "convex/functions/events/eventsPredicted/schemas";
import type { ConvexScheduledDockEvent } from "convex/functions/events/eventsScheduled/schemas";
import { buildDockVisitsFromEventRows } from "../buildDockVisitsFromEventRows";

const sailingDay = "2026-03-25";

const at = (hours: number, minutes: number, day = 25) =>
  Date.UTC(2026, 2, day, hours, minutes);

/**
 * Builds a scheduled dock event fixture.
 *
 * @param partial - Scheduled event fields to override
 * @returns Scheduled event fixture
 */
const makeScheduledEvent = (
  partial: Partial<ConvexScheduledDockEvent> &
    Pick<ConvexScheduledDockEvent, "Key">
): ConvexScheduledDockEvent => ({
  VesselAbbrev: "CAT",
  SailingDay: sailingDay,
  UpdatedAt: at(0, 0),
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "ORI",
  NextTerminalAbbrev: "SHI",
  EventType: "dep-dock",
  ...partial,
});

describe("buildDockVisitsFromEventRows", () => {
  it("pairs scheduled dep and arv boundaries into two dock visits for the sample day", () => {
    const scheduledEvents: ConvexScheduledDockEvent[] = [
      makeScheduledEvent({
        Key: "c1--dep-dock",
        EventType: "dep-dock",
        TerminalAbbrev: "ORI",
        ScheduledDeparture: at(9, 0),
        EventScheduledTime: at(9, 0),
      }),
      makeScheduledEvent({
        Key: "c1--arv-dock",
        EventType: "arv-dock",
        TerminalAbbrev: "SHI",
        ScheduledDeparture: at(9, 0),
        EventScheduledTime: at(9, 40),
      }),
    ];
    const actualEvents: ConvexActualDockEvent[] = [];
    const predictedEvents: ConvexPredictedDockEvent[] = [];

    const visits = buildDockVisitsFromEventRows({
      scheduledEvents,
      actualEvents,
      predictedEvents,
      vesselAbbrev: "CAT",
      sailingDay,
    });

    expect(visits).toEqual([
      {
        Key: "none::c1--dep-dock",
        VesselAbbrev: "CAT",
        SailingDay: sailingDay,
        TerminalAbbrev: "ORI",
        Arrival: undefined,
        Departure: {
          Key: "c1--dep-dock",
          SegmentKey: "c1",
          TerminalAbbrev: "ORI",
          EventType: "dep-dock",
          EventScheduledTime: new Date(at(9, 0)),
          EventPredictedTime: undefined,
          EventOccurred: undefined,
          EventActualTime: undefined,
        },
      },
      {
        Key: "c1--arv-dock::none",
        VesselAbbrev: "CAT",
        SailingDay: sailingDay,
        TerminalAbbrev: "SHI",
        Arrival: {
          Key: "c1--arv-dock",
          SegmentKey: "c1",
          TerminalAbbrev: "SHI",
          EventType: "arv-dock",
          EventScheduledTime: new Date(at(9, 40)),
          EventPredictedTime: undefined,
          EventOccurred: undefined,
          EventActualTime: undefined,
        },
        Departure: undefined,
      },
    ]);
  });
});
