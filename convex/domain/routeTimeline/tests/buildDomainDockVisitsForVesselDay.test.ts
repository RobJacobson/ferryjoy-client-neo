/**
 * Ensures single-vessel domain dock visits match snapshot assembly + domain
 * conversion (Stage 3 client path parity).
 */

import { describe, expect, it } from "bun:test";
import { toDomainRouteTimelineSnapshot } from "../../../functions/routeTimeline";
import type { ConvexActualDockEvent } from "../../events/actual/schemas";
import type { ConvexPredictedDockEvent } from "../../events/predicted/schemas";
import type { ConvexScheduledDockEvent } from "../../events/scheduled/schemas";
import { buildDomainDockVisitsForVesselDay } from "../buildDomainDockVisitsForVesselDay";
import { buildRouteTimelineSnapshot } from "../buildRouteTimelineSnapshot";

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
  it("matches buildRouteTimelineSnapshot domain visits for the same vessel", () => {
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

    const snapshot = buildRouteTimelineSnapshot({
      RouteAbbrev: "R",
      SailingDay: sailingDay,
      scope: { VesselAbbrev: "CAT" },
      scheduledEvents,
      actualEvents,
      predictedEvents,
    });

    const domainFromSnapshot =
      toDomainRouteTimelineSnapshot(snapshot).Vessels[0]?.DockVisits ?? [];

    const direct = buildDomainDockVisitsForVesselDay({
      scheduledEvents,
      actualEvents,
      predictedEvents,
      vesselAbbrev: "CAT",
      sailingDay,
    });

    expect(direct).toEqual(domainFromSnapshot);
  });
});
