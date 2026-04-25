/**
 * Tests for pure route timeline snapshot assembly from merged timeline rows.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexActualDockEvent } from "../../../domain/events/actual/schemas";
import type { ConvexPredictedDockEvent } from "../../../domain/events/predicted/schemas";
import type { ConvexScheduledDockEvent } from "../../../domain/events/scheduled/schemas";
import { getSegmentKeyFromBoundaryKey } from "../../../domain/timelineRows/scheduledSegmentResolvers";
import { buildPhysicalActualEventKey } from "../../../shared/physicalTripIdentity";
import { buildRouteTimelineSnapshot } from "../buildRouteTimelineSnapshot";

const at = (hours: number, minutes: number, day = 25) =>
  Date.UTC(2026, 2, day, hours, minutes);

const sailingDay = "2026-03-25";

describe("buildRouteTimelineSnapshot", () => {
  it("returns two vessels sorted by VesselAbbrev with plausible dock visits", () => {
    const snapshot = buildRouteTimelineSnapshot({
      RouteAbbrev: "SEA-BBI",
      SailingDay: sailingDay,
      scope: {},
      scheduledEvents: [
        makeScheduledEvent({
          VesselAbbrev: "ZEB",
          Key: "z1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 0),
        }),
        makeScheduledEvent({
          VesselAbbrev: "ZEB",
          Key: "z1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "BBI",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 35),
        }),
        makeScheduledEvent({
          VesselAbbrev: "CAT",
          Key: "c1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "ORI",
          ScheduledDeparture: at(9, 0),
          EventScheduledTime: at(9, 0),
        }),
        makeScheduledEvent({
          VesselAbbrev: "CAT",
          Key: "c1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "SHI",
          ScheduledDeparture: at(9, 0),
          EventScheduledTime: at(9, 40),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
    });

    expect(snapshot.Vessels.map((v) => v.VesselAbbrev)).toEqual(["CAT", "ZEB"]);
    expect(snapshot.Scope.IsPartial).toBe(false);
    expect(snapshot.RouteAbbrev).toBe("SEA-BBI");
    expect(snapshot.SailingDay).toBe(sailingDay);

    const cat = snapshot.Vessels.find((v) => v.VesselAbbrev === "CAT");
    const zeb = snapshot.Vessels.find((v) => v.VesselAbbrev === "ZEB");
    expect(cat?.DockVisits).toEqual([
      expect.objectContaining({
        TerminalAbbrev: "ORI",
        Arrival: undefined,
        Departure: expect.objectContaining({ Key: "c1--dep-dock" }),
      }),
      expect.objectContaining({
        TerminalAbbrev: "SHI",
        Arrival: expect.objectContaining({ Key: "c1--arv-dock" }),
        Departure: undefined,
      }),
    ]);
    expect(zeb?.DockVisits).toEqual([
      expect.objectContaining({
        TerminalAbbrev: "P52",
        Arrival: undefined,
        Departure: expect.objectContaining({ Key: "z1--dep-dock" }),
      }),
      expect.objectContaining({
        TerminalAbbrev: "BBI",
        Arrival: expect.objectContaining({ Key: "z1--arv-dock" }),
        Departure: undefined,
      }),
    ]);
  });

  it("narrows to one vessel when scope.VesselAbbrev is set and marks partial", () => {
    const snapshot = buildRouteTimelineSnapshot({
      RouteAbbrev: "R",
      SailingDay: sailingDay,
      scope: { VesselAbbrev: "WEN" },
      scheduledEvents: [
        makeScheduledEvent({
          VesselAbbrev: "WEN",
          Key: "w--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "A",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 0),
        }),
        makeScheduledEvent({
          VesselAbbrev: "KLA",
          Key: "k--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "B",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 0),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
    });

    expect(snapshot.Vessels).toHaveLength(1);
    expect(snapshot.Vessels[0]?.VesselAbbrev).toBe("WEN");
    expect(snapshot.Scope).toMatchObject({
      VesselAbbrev: "WEN",
      IsPartial: true,
    });
  });

  it("emits start-of-day departure-only visit when first boundary is dep-dock", () => {
    const snapshot = buildRouteTimelineSnapshot({
      RouteAbbrev: "R",
      SailingDay: sailingDay,
      scope: {},
      scheduledEvents: [
        makeScheduledEvent({
          Key: "t1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 0),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
    });

    expect(snapshot.Vessels[0]?.DockVisits).toEqual([
      expect.objectContaining({
        TerminalAbbrev: "P52",
        Arrival: undefined,
        Departure: expect.objectContaining({
          EventType: "dep-dock",
          Key: "t1--dep-dock",
        }),
      }),
    ]);
  });

  it("emits terminal-tail arrival-only visit when last boundary is arv-dock", () => {
    const snapshot = buildRouteTimelineSnapshot({
      RouteAbbrev: "R",
      SailingDay: sailingDay,
      scope: {},
      scheduledEvents: [
        makeScheduledEvent({
          Key: "t1--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 0),
        }),
        makeScheduledEvent({
          Key: "t1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "BBI",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 35),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
    });

    const visits = snapshot.Vessels[0]?.DockVisits ?? [];
    expect(visits[visits.length - 1]).toEqual(
      expect.objectContaining({
        TerminalAbbrev: "BBI",
        Arrival: expect.objectContaining({ Key: "t1--arv-dock" }),
        Departure: undefined,
      })
    );
  });

  it("pairs arrival and departure at the same terminal when merge order allows", () => {
    const snapshot = buildRouteTimelineSnapshot({
      RouteAbbrev: "R",
      SailingDay: sailingDay,
      scope: {},
      scheduledEvents: [
        makeScheduledEvent({
          Key: "stay--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "PIE",
          ScheduledDeparture: at(10, 0),
          EventScheduledTime: at(10, 0),
        }),
        makeScheduledEvent({
          Key: "stay--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "PIE",
          ScheduledDeparture: at(10, 0),
          EventScheduledTime: at(10, 45),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
    });

    expect(snapshot.Vessels[0]?.DockVisits).toEqual([
      expect.objectContaining({
        TerminalAbbrev: "PIE",
        Arrival: expect.objectContaining({ Key: "stay--arv-dock" }),
        Departure: expect.objectContaining({ Key: "stay--dep-dock" }),
      }),
    ]);
  });

  it("does not coalesce duplicate arrivals at one terminal; first stays open", () => {
    const snapshot = buildRouteTimelineSnapshot({
      RouteAbbrev: "R",
      SailingDay: sailingDay,
      scope: {},
      scheduledEvents: [
        makeScheduledEvent({
          Key: "first--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "T1",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 0),
        }),
        makeScheduledEvent({
          Key: "second--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "T1",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 5),
        }),
        makeScheduledEvent({
          Key: "only--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "T1",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 30),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
    });

    const visits = snapshot.Vessels[0]?.DockVisits ?? [];
    expect(visits).toHaveLength(2);
    expect(visits[0]).toEqual(
      expect.objectContaining({
        TerminalAbbrev: "T1",
        Arrival: expect.objectContaining({ Key: "first--arv-dock" }),
        Departure: undefined,
      })
    );
    expect(visits[1]).toEqual(
      expect.objectContaining({
        TerminalAbbrev: "T1",
        Arrival: expect.objectContaining({ Key: "second--arv-dock" }),
        Departure: expect.objectContaining({ Key: "only--dep-dock" }),
      })
    );
  });

  it("does not repair invalid seams across terminals (arv A then dep B)", () => {
    const snapshot = buildRouteTimelineSnapshot({
      RouteAbbrev: "R",
      SailingDay: sailingDay,
      scope: {},
      scheduledEvents: [
        makeScheduledEvent({
          Key: "x--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "AAA",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 0),
        }),
        makeScheduledEvent({
          Key: "y--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "BBB",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 5),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
    });

    expect(snapshot.Vessels[0]?.DockVisits).toEqual([
      expect.objectContaining({
        TerminalAbbrev: "AAA",
        Arrival: expect.objectContaining({ Key: "x--arv-dock" }),
        Departure: undefined,
      }),
      expect.objectContaining({
        TerminalAbbrev: "BBB",
        Arrival: undefined,
        Departure: expect.objectContaining({ Key: "y--dep-dock" }),
      }),
    ]);
  });

  it("does not pair same-terminal boundaries across an intervening invalid seam", () => {
    const snapshot = buildRouteTimelineSnapshot({
      RouteAbbrev: "R",
      SailingDay: sailingDay,
      scope: {},
      scheduledEvents: [
        makeScheduledEvent({
          Key: "x--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "AAA",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 0),
        }),
        makeScheduledEvent({
          Key: "y--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "BBB",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 5),
        }),
        makeScheduledEvent({
          Key: "z--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "AAA",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 10),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
    });

    expect(snapshot.Vessels[0]?.DockVisits).toEqual([
      expect.objectContaining({
        TerminalAbbrev: "AAA",
        Arrival: expect.objectContaining({ Key: "x--arv-dock" }),
        Departure: undefined,
      }),
      expect.objectContaining({
        TerminalAbbrev: "BBB",
        Arrival: undefined,
        Departure: expect.objectContaining({ Key: "y--dep-dock" }),
      }),
      expect.objectContaining({
        TerminalAbbrev: "AAA",
        Arrival: undefined,
        Departure: expect.objectContaining({ Key: "z--dep-dock" }),
      }),
    ]);
  });

  it("preserves actual overlay EventOccurred and EventActualTime on boundaries", () => {
    const snapshot = buildRouteTimelineSnapshot({
      RouteAbbrev: "R",
      SailingDay: sailingDay,
      scope: {},
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

    const depVisit = snapshot.Vessels[0]?.DockVisits[0];
    expect(depVisit?.Departure).toMatchObject({
      Key: "trip-1--dep-dock",
      EventActualTime: at(8, 4),
      EventOccurred: true,
    });
  });

  it("applies mergeTimelineRows prediction precedence (wsf over ml) on boundaries", () => {
    const snapshot = buildRouteTimelineSnapshot({
      RouteAbbrev: "R",
      SailingDay: sailingDay,
      scope: {},
      scheduledEvents: [
        makeScheduledEvent({
          Key: "trip-1--arv-dock",
          EventType: "arv-dock",
          TerminalAbbrev: "BBI",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 35),
        }),
      ],
      actualEvents: [],
      predictedEvents: [
        makePredictedEvent({
          Key: "trip-1--arv-dock",
          EventPredictedTime: at(8, 50),
          PredictionSource: "ml",
          PredictionType: "AtSeaArriveNext",
        }),
        makePredictedEvent({
          Key: "trip-1--arv-dock",
          EventPredictedTime: at(8, 42),
          PredictionSource: "wsf_eta",
          PredictionType: "AtDockArriveNext",
        }),
      ],
    });

    const arv = snapshot.Vessels[0]?.DockVisits[0]?.Arrival;
    expect(arv?.EventPredictedTime).toBe(at(8, 42));
  });

  it("is deterministic for identical inputs", () => {
    const args = {
      RouteAbbrev: "R",
      SailingDay: sailingDay,
      scope: {},
      scheduledEvents: [
        makeScheduledEvent({
          VesselAbbrev: "B",
          Key: "b--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "T",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 0),
        }),
        makeScheduledEvent({
          VesselAbbrev: "A",
          Key: "a--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "T",
          ScheduledDeparture: at(9, 0),
          EventScheduledTime: at(9, 0),
        }),
      ],
      actualEvents: [] as ConvexActualDockEvent[],
      predictedEvents: [] as ConvexPredictedDockEvent[],
    };
    const first = buildRouteTimelineSnapshot(args);
    const second = buildRouteTimelineSnapshot(args);
    expect(first).toEqual(second);
  });

  it("marks partial when window bounds are present without clipping visits", () => {
    const snapshot = buildRouteTimelineSnapshot({
      RouteAbbrev: "R",
      SailingDay: sailingDay,
      scope: { WindowStart: at(8, 0), WindowEnd: at(12, 0) },
      scheduledEvents: [
        makeScheduledEvent({
          Key: "t--dep-dock",
          EventType: "dep-dock",
          TerminalAbbrev: "P52",
          ScheduledDeparture: at(8, 0),
          EventScheduledTime: at(8, 0),
        }),
      ],
      actualEvents: [],
      predictedEvents: [],
    });

    expect(snapshot.Scope.IsPartial).toBe(true);
    expect(snapshot.Scope.WindowStart).toBe(at(8, 0));
    expect(snapshot.Vessels[0]?.DockVisits).toHaveLength(1);
  });
});

const makeScheduledEvent = (
  overrides: Partial<ConvexScheduledDockEvent> & { SegmentKey?: never }
): ConvexScheduledDockEvent => ({
  Key: "trip-1--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: sailingDay,
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
  overrides: Partial<ConvexActualDockEvent> & { Key?: string }
): ConvexActualDockEvent => {
  const legacyBoundary = overrides.Key ?? "trip-1--dep-dock";
  const merged = {
    VesselAbbrev: "WEN" as const,
    SailingDay: sailingDay,
    UpdatedAt: at(6, 0),
    ScheduledDeparture: at(8, 0),
    TerminalAbbrev: "P52",
    EventOccurred: true as const,
    EventActualTime: at(8, 2) as number | undefined,
    ...overrides,
  };
  const eventType =
    merged.EventType ??
    (legacyBoundary.includes("arv-dock") ? "arv-dock" : "dep-dock");
  const segment =
    "ScheduleKey" in overrides
      ? overrides.ScheduleKey
      : getSegmentKeyFromBoundaryKey(legacyBoundary);
  const tripKey =
    merged.TripKey ?? `TST ${sailingDay} 12:00:00Z ${segment ?? "trip-1"}`;
  const EventKey =
    merged.EventKey ?? buildPhysicalActualEventKey(tripKey, eventType);

  return {
    ...merged,
    EventKey,
    TripKey: tripKey,
    ScheduleKey: segment,
    EventType: eventType,
  };
};

const makePredictedEvent = (
  overrides: Partial<ConvexPredictedDockEvent>
): ConvexPredictedDockEvent => ({
  Key: "trip-1--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: sailingDay,
  UpdatedAt: at(6, 0),
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  EventPredictedTime: at(8, 5),
  PredictionType: "AtDockDepartCurr",
  PredictionSource: "ml",
  ...overrides,
});
