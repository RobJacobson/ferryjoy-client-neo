/**
 * Ensures single-vessel domain dock visits from merged events stay stable for
 * the vessel timeline client path.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexActualDockEvent } from "../../events/actual/schemas";
import type { ConvexPredictedDockEvent } from "../../events/predicted/schemas";
import type { ConvexScheduledDockEvent } from "../../events/scheduled/schemas";
import { buildDomainDockVisitsForVesselDay } from "../buildDomainDockVisitsForVesselDay";

const at = (hours: number, minutes: number, day = 25) =>
  Date.UTC(2026, 2, day, hours, minutes);

const sailingDay = "2026-03-25";

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

describe("buildDomainDockVisitsForVesselDay", () => {
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

    const direct = buildDomainDockVisitsForVesselDay({
      scheduledEvents,
      actualEvents,
      predictedEvents,
      vesselAbbrev: "CAT",
      sailingDay,
    });

    expect(direct).toEqual([
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
        Departure: undefined,
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
      },
    ]);
  });
});
