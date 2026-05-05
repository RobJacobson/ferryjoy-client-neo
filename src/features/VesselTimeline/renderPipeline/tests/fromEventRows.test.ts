/**
 * Unit tests for the event-row → vessel-timeline render pipeline.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexActualDockEvent } from "convex/functions/events/eventsActual/schemas";
import type { ConvexPredictedDockEvent } from "convex/functions/events/eventsPredicted/schemas";
import type { ConvexScheduledDockEvent } from "convex/functions/events/eventsScheduled/schemas";
import { BASE_TIMELINE_VISUAL_THEME } from "@/components/timeline/theme";
import type { VesselLocation } from "@/types";
import { fromEventRows } from "../fromEventRows";

const sailingDay = "2026-04-25";

/** UTC ms on 2026-04-25 */
const u = (hours: number, minutes: number) =>
  Date.UTC(2026, 3, 25, hours, minutes);

const getTerminalNameByAbbrev = (terminalAbbrev: string) =>
  (
    ({
      P52: "Seattle",
      BBI: "Bainbridge Island",
    }) as const
  )[terminalAbbrev] ?? null;

/**
 * Removes the boundary suffix from a fixture event key.
 *
 * Actual event rows attach to scheduled rows through TripKey, and scheduled
 * fixture keys use the same segment string before the boundary suffix.
 *
 * @param boundaryKey - Fixture boundary key
 * @returns Trip key portion of the boundary key
 */
const boundaryKeyToTripKey = (boundaryKey: string) =>
  boundaryKey.replace(/--(?:dep|arv)-dock$/, "");

const makeScheduledEvent = (
  overrides: Partial<ConvexScheduledDockEvent> &
    Pick<ConvexScheduledDockEvent, "Key">
): ConvexScheduledDockEvent => ({
  VesselAbbrev: "WEN",
  SailingDay: sailingDay,
  UpdatedAt: u(0, 0),
  ScheduledDeparture: u(8, 0),
  TerminalAbbrev: "P52",
  NextTerminalAbbrev: "BBI",
  EventType: "dep-dock",
  EventScheduledTime: u(8, 0),
  ...overrides,
});

const makeActualEvent = (
  overrides: Partial<ConvexActualDockEvent> & { Key: string }
): ConvexActualDockEvent => {
  const { Key, ...rest } = overrides;

  return {
    TripKey: rest.TripKey ?? boundaryKeyToTripKey(Key),
    VesselAbbrev: "WEN",
    SailingDay: sailingDay,
    UpdatedAt: u(0, 0),
    ScheduledDeparture: u(8, 0),
    TerminalAbbrev: "P52",
    EventType: "dep-dock",
    EventOccurred: true,
    EventKey: `actual-${Key}`,
    ...rest,
  };
};

const makePredictedEvent = (
  overrides: Partial<ConvexPredictedDockEvent> & { Key: string }
): ConvexPredictedDockEvent => {
  const { Key, ...rest } = overrides;
  return {
    VesselAbbrev: "WEN",
    SailingDay: sailingDay,
    UpdatedAt: u(0, 0),
    Key,
    TerminalAbbrev: "BBI",
    ScheduledDeparture: u(8, 0),
    EventPredictedTime: u(9, 0),
    PredictionSource: "wsf_eta",
    PredictionType: "AtSeaArriveNext",
    ...rest,
  };
};

const makeVesselLocation = (
  overrides: Partial<VesselLocation> = {}
): VesselLocation => ({
  VesselID: 1,
  VesselName: "Wenatchee",
  VesselAbbrev: "WEN",
  DepartingTerminalID: 10,
  DepartingTerminalName: "Seattle",
  DepartingTerminalAbbrev: "P52",
  ArrivingTerminalID: 20,
  ArrivingTerminalName: "Bainbridge Island",
  ArrivingTerminalAbbrev: "BBI",
  Latitude: 0,
  Longitude: 0,
  Speed: 15,
  Heading: 0,
  InService: true,
  AtDock: false,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: undefined,
  RouteAbbrev: "sea-bi",
  VesselPositionNum: undefined,
  TimeStamp: new Date("2026-04-25T08:20:00.000Z"),
  ScheduleKey: undefined,
  DepartingDistance: undefined,
  ArrivingDistance: undefined,
  ...overrides,
  AtDockObserved: overrides.AtDockObserved ?? false,
});

describe("fromEventRows", () => {
  it("returns empty render state when there are no scheduled events", () => {
    const renderState = fromEventRows({
      scheduledEvents: [],
      actualEvents: [],
      predictedEvents: [],
      vesselAbbrev: "WEN",
      sailingDay,
      getTerminalNameByAbbrev,
      now: new Date("2026-04-25T08:20:00.000Z"),
    });

    expect(renderState.rows).toEqual([]);
    expect(renderState.activeRowIndex).toBe(-1);
    expect(renderState.activeIndicator).toBeNull();
  });

  it("maps dock/crossing/dock and terminal-tail spans into renderer rows", () => {
    const scheduledEvents: ConvexScheduledDockEvent[] = [
      makeScheduledEvent({
        Key: "wen-p52-open--arv-dock",
        EventType: "arv-dock",
        TerminalAbbrev: "P52",
        NextTerminalAbbrev: "P52",
        ScheduledDeparture: u(7, 40),
        EventScheduledTime: u(7, 40),
      }),
      makeScheduledEvent({
        Key: "wen-p52-open--dep-dock",
        EventType: "dep-dock",
        TerminalAbbrev: "P52",
        NextTerminalAbbrev: "BBI",
        ScheduledDeparture: u(7, 40),
        EventScheduledTime: u(8, 0),
      }),
      makeScheduledEvent({
        Key: "wen-bbi--arv-dock",
        EventType: "arv-dock",
        TerminalAbbrev: "BBI",
        NextTerminalAbbrev: "BBI",
        ScheduledDeparture: u(8, 35),
        EventScheduledTime: u(8, 35),
      }),
      makeScheduledEvent({
        Key: "wen-bbi--dep-dock",
        EventType: "dep-dock",
        TerminalAbbrev: "BBI",
        NextTerminalAbbrev: "P52",
        ScheduledDeparture: u(8, 35),
        EventScheduledTime: u(8, 55),
      }),
      makeScheduledEvent({
        Key: "wen-p52-tail--arv-dock",
        EventType: "arv-dock",
        TerminalAbbrev: "P52",
        NextTerminalAbbrev: "P52",
        ScheduledDeparture: u(9, 30),
        EventScheduledTime: u(9, 30),
      }),
    ];

    const actualEvents: ConvexActualDockEvent[] = [
      makeActualEvent({
        Key: "wen-p52-open--dep-dock",
        EventType: "dep-dock",
        TerminalAbbrev: "P52",
        ScheduledDeparture: u(7, 40),
        EventActualTime: u(8, 1),
      }),
    ];

    const predictedEvents: ConvexPredictedDockEvent[] = [
      makePredictedEvent({
        Key: "wen-p52-open--dep-dock",
        EventPredictedTime: u(8, 2),
        PredictionSource: "ml",
        PredictionType: "AtDockArriveNext",
      }),
      makePredictedEvent({
        Key: "wen-bbi--arv-dock",
        EventPredictedTime: u(8, 33),
      }),
    ];

    const renderState = fromEventRows({
      scheduledEvents,
      actualEvents,
      predictedEvents,
      vesselAbbrev: "WEN",
      sailingDay,
      getTerminalNameByAbbrev,
      now: new Date("2026-04-25T08:30:00.000Z"),
      vesselLocation: makeVesselLocation({
        DepartingDistance: 4,
        ArrivingDistance: 6,
        Speed: 16,
      }),
    });

    expect(renderState.rows.map((row) => row.kind)).toEqual([
      "at-dock",
      "at-sea",
      "at-dock",
      "at-sea",
      "at-dock",
    ]);
    expect(renderState.rows[1]?.startLabel).toBe("To: BBI");
    expect(renderState.rows[2]?.terminalHeadline).toBe("Bainbridge Is.");
    expect(renderState.rows[4]?.isFinalRow).toBeTrue();
    expect(renderState.activeRowIndex).toBe(1);
    expect(renderState.rows.map((row) => row.markerAppearance)).toEqual([
      "past",
      "past",
      "future",
      "future",
      "future",
    ]);
    expect(renderState.activeIndicator?.label).toBe("3m");
    expect(
      Math.abs((renderState.activeIndicator?.positionPercent ?? 0) - 0.4)
    ).toBeLessThan(1e-5);
    expect(renderState.activeIndicator?.subtitle).toBe("16 kn · 6.0 mi to BBI");
  });

  it("keeps stable row structure when only prediction times change", () => {
    const scheduledEvents: ConvexScheduledDockEvent[] = [
      makeScheduledEvent({
        Key: "trip-1--dep-dock",
        EventType: "dep-dock",
        TerminalAbbrev: "P52",
        ScheduledDeparture: u(8, 0),
        EventScheduledTime: u(8, 0),
      }),
      makeScheduledEvent({
        Key: "trip-1--arv-dock",
        EventType: "arv-dock",
        TerminalAbbrev: "BBI",
        ScheduledDeparture: u(8, 0),
        EventScheduledTime: u(8, 35),
      }),
    ];

    const predictedA: ConvexPredictedDockEvent[] = [
      makePredictedEvent({
        Key: "trip-1--arv-dock",
        EventPredictedTime: u(8, 40),
      }),
    ];

    const predictedB: ConvexPredictedDockEvent[] = [
      makePredictedEvent({
        Key: "trip-1--arv-dock",
        EventPredictedTime: u(8, 50),
      }),
    ];

    const a = fromEventRows({
      scheduledEvents,
      actualEvents: [],
      predictedEvents: predictedA,
      vesselAbbrev: "WEN",
      sailingDay,
      getTerminalNameByAbbrev,
      now: new Date("2026-04-25T08:20:00.000Z"),
    });

    const b = fromEventRows({
      scheduledEvents,
      actualEvents: [],
      predictedEvents: predictedB,
      vesselAbbrev: "WEN",
      sailingDay,
      getTerminalNameByAbbrev,
      now: new Date("2026-04-25T08:20:00.000Z"),
    });

    expect(a.rows.map((r) => r.id)).toEqual(b.rows.map((r) => r.id));
    expect(a.rows.map((r) => r.kind)).toEqual(b.rows.map((r) => r.kind));
    const bbiArrivalRow = b.rows.find(
      (row) =>
        row.kind === "at-dock" &&
        row.startEvent.currTerminalAbbrev === "BBI" &&
        row.startEvent.eventType === "arrive"
    );
    expect(bbiArrivalRow?.startEvent.timePoint.estimated?.getTime()).toBe(
      u(8, 50)
    );
  });

  it("prefers WSF ETA over ML predictions for the same arrival boundary", () => {
    const scheduledEvents: ConvexScheduledDockEvent[] = [
      makeScheduledEvent({
        Key: "trip-1--dep-dock",
        EventType: "dep-dock",
        TerminalAbbrev: "P52",
        ScheduledDeparture: u(8, 0),
        EventScheduledTime: u(8, 0),
      }),
      makeScheduledEvent({
        Key: "trip-1--arv-dock",
        EventType: "arv-dock",
        TerminalAbbrev: "BBI",
        ScheduledDeparture: u(8, 0),
        EventScheduledTime: u(8, 35),
      }),
    ];

    const renderState = fromEventRows({
      scheduledEvents,
      actualEvents: [],
      predictedEvents: [
        makePredictedEvent({
          Key: "trip-1--arv-dock",
          EventPredictedTime: u(8, 50),
          PredictionSource: "ml",
          PredictionType: "AtSeaArriveNext",
        }),
        makePredictedEvent({
          Key: "trip-1--arv-dock",
          EventPredictedTime: u(8, 42),
          PredictionSource: "wsf_eta",
          PredictionType: "AtSeaArriveNext",
        }),
      ],
      vesselAbbrev: "WEN",
      sailingDay,
      getTerminalNameByAbbrev,
      now: new Date("2026-04-25T08:20:00.000Z"),
    });

    const bbiArrivalRow = renderState.rows.find(
      (row) =>
        row.kind === "at-dock" &&
        row.startEvent.currTerminalAbbrev === "BBI" &&
        row.startEvent.eventType === "arrive"
    );
    expect(bbiArrivalRow?.startEvent.timePoint.estimated?.getTime()).toBe(
      u(8, 42)
    );
  });

  it("prefers AtSeaArriveNext ML over AtDockArriveNext when WSF ETA is absent", () => {
    const scheduledEvents: ConvexScheduledDockEvent[] = [
      makeScheduledEvent({
        Key: "trip-1--dep-dock",
        EventType: "dep-dock",
        TerminalAbbrev: "P52",
        ScheduledDeparture: u(8, 0),
        EventScheduledTime: u(8, 0),
      }),
      makeScheduledEvent({
        Key: "trip-1--arv-dock",
        EventType: "arv-dock",
        TerminalAbbrev: "BBI",
        ScheduledDeparture: u(8, 0),
        EventScheduledTime: u(8, 35),
      }),
    ];

    const renderState = fromEventRows({
      scheduledEvents,
      actualEvents: [],
      predictedEvents: [
        makePredictedEvent({
          Key: "trip-1--arv-dock",
          EventPredictedTime: u(8, 55),
          PredictionSource: "ml",
          PredictionType: "AtDockArriveNext",
        }),
        makePredictedEvent({
          Key: "trip-1--arv-dock",
          EventPredictedTime: u(8, 45),
          PredictionSource: "ml",
          PredictionType: "AtSeaArriveNext",
        }),
      ],
      vesselAbbrev: "WEN",
      sailingDay,
      getTerminalNameByAbbrev,
      now: new Date("2026-04-25T08:20:00.000Z"),
    });

    const bbiArrivalRow = renderState.rows.find(
      (row) =>
        row.kind === "at-dock" &&
        row.startEvent.currTerminalAbbrev === "BBI" &&
        row.startEvent.eventType === "arrive"
    );
    expect(bbiArrivalRow?.startEvent.timePoint.estimated?.getTime()).toBe(
      u(8, 45)
    );
  });

  it("uses actual arrival to activate destination dock row", () => {
    const scheduledEvents: ConvexScheduledDockEvent[] = [
      makeScheduledEvent({
        Key: "seg-a--dep-dock",
        EventType: "dep-dock",
        TerminalAbbrev: "P52",
        ScheduledDeparture: u(8, 0),
        EventScheduledTime: u(8, 0),
      }),
      makeScheduledEvent({
        Key: "seg-b--arv-dock",
        EventType: "arv-dock",
        TerminalAbbrev: "BBI",
        ScheduledDeparture: u(8, 0),
        EventScheduledTime: u(8, 35),
      }),
      makeScheduledEvent({
        Key: "seg-b--dep-dock",
        EventType: "dep-dock",
        TerminalAbbrev: "BBI",
        NextTerminalAbbrev: "P52",
        ScheduledDeparture: u(8, 35),
        EventScheduledTime: u(8, 55),
      }),
    ];

    const actualEvents: ConvexActualDockEvent[] = [
      makeActualEvent({
        Key: "seg-a--dep-dock",
        EventActualTime: u(8, 0),
      }),
      makeActualEvent({
        Key: "seg-b--arv-dock",
        EventType: "arv-dock",
        TerminalAbbrev: "BBI",
        ScheduledDeparture: u(8, 0),
        EventActualTime: u(8, 34),
      }),
    ];

    const renderState = fromEventRows({
      scheduledEvents,
      actualEvents,
      predictedEvents: [],
      vesselAbbrev: "WEN",
      sailingDay,
      getTerminalNameByAbbrev,
      theme: BASE_TIMELINE_VISUAL_THEME,
      now: new Date("2026-04-25T08:40:00.000Z"),
      vesselLocation: makeVesselLocation({
        AtDock: true,
        Speed: 0,
        DepartingTerminalAbbrev: "BBI",
      }),
    });

    expect(renderState.activeRowIndex).toBe(2);
    expect(
      Math.abs((renderState.activeIndicator?.positionPercent ?? 0) - 0.285714)
    ).toBeLessThan(1e-5);
    expect(renderState.activeIndicator?.subtitle).toBe("At dock BBI");
    expect(renderState.activeIndicator?.animate).toBeFalse();
  });
});
