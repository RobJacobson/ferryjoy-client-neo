/**
 * Tests for `loadRouteTimelineSnapshotInputs` with a minimal mocked `QueryCtx`.
 */

import { describe, expect, it } from "bun:test";
import type { QueryCtx } from "_generated/server";
import { buildRouteTimelineSnapshot } from "domain/routeTimeline";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexPredictedDockEvent } from "functions/events/eventsPredicted/schemas";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import type { ConvexScheduledTrip } from "functions/scheduledTrips/schemas";
import { loadRouteTimelineSnapshotInputs } from "../loadRouteTimelineSnapshotInputs";

const at = (hours: number, minutes: number, day = 25) =>
  Date.UTC(2026, 2, day, hours, minutes);

const sailingDay = "2026-03-25";

describe("loadRouteTimelineSnapshotInputs", () => {
  it("loads scheduled rows for two vessels discovered from scheduledTrips", async () => {
    const { scheduledEvents, actualEvents, predictedEvents } =
      await loadRouteTimelineSnapshotInputs(
        makeQueryCtx({
          scheduledTrips: [
            makeTrip({
              VesselAbbrev: "ZEB",
              RouteAbbrev: "SEA-BBI",
              Key: "z1",
            }),
            makeTrip({
              VesselAbbrev: "CAT",
              RouteAbbrev: "SEA-BBI",
              Key: "c1",
            }),
          ],
          scheduledEvents: [
            makeScheduledEvent({
              VesselAbbrev: "ZEB",
              Key: "z1--dep-dock",
              EventType: "dep-dock",
            }),
            makeScheduledEvent({
              VesselAbbrev: "CAT",
              Key: "c1--dep-dock",
              EventType: "dep-dock",
            }),
          ],
        }),
        { RouteAbbrev: "SEA-BBI", SailingDay: sailingDay }
      );

    expect(scheduledEvents.map((e) => e.VesselAbbrev).sort()).toEqual([
      "CAT",
      "ZEB",
    ]);
    expect(actualEvents).toEqual([]);
    expect(predictedEvents).toEqual([]);
  });

  it("narrows to one vessel when VesselAbbrev is set and on route", async () => {
    const { scheduledEvents } = await loadRouteTimelineSnapshotInputs(
      makeQueryCtx({
        scheduledTrips: [
          makeTrip({ VesselAbbrev: "ZEB", Key: "z1" }),
          makeTrip({ VesselAbbrev: "CAT", Key: "c1" }),
        ],
        scheduledEvents: [
          makeScheduledEvent({
            VesselAbbrev: "ZEB",
            Key: "z1--dep-dock",
            EventType: "dep-dock",
          }),
          makeScheduledEvent({
            VesselAbbrev: "CAT",
            Key: "c1--dep-dock",
            EventType: "dep-dock",
          }),
        ],
      }),
      {
        RouteAbbrev: "SEA-BBI",
        SailingDay: sailingDay,
        VesselAbbrev: "CAT",
      }
    );

    expect(scheduledEvents.map((e) => e.VesselAbbrev)).toEqual(["CAT"]);
  });

  it("excludes off-route scheduled events for a vessel discovered on the route", async () => {
    const { scheduledEvents } = await loadRouteTimelineSnapshotInputs(
      makeQueryCtx({
        scheduledTrips: [makeTrip({ VesselAbbrev: "WEN", Key: "route-trip" })],
        scheduledEvents: [
          makeScheduledEvent({
            VesselAbbrev: "WEN",
            Key: "route-trip--dep-dock",
            EventType: "dep-dock",
          }),
          makeScheduledEvent({
            VesselAbbrev: "WEN",
            Key: "off-route-trip--dep-dock",
            EventType: "dep-dock",
          }),
        ],
      }),
      { RouteAbbrev: "SEA-BBI", SailingDay: sailingDay }
    );

    expect(scheduledEvents.map((event) => event.Key)).toEqual([
      "route-trip--dep-dock",
    ]);
  });

  it("returns no events when VesselAbbrev is not on the route that day", async () => {
    const { scheduledEvents } = await loadRouteTimelineSnapshotInputs(
      makeQueryCtx({
        scheduledTrips: [makeTrip({ VesselAbbrev: "ZEB" })],
        scheduledEvents: [
          makeScheduledEvent({ VesselAbbrev: "ZEB", Key: "z1--dep-dock" }),
        ],
      }),
      {
        RouteAbbrev: "SEA-BBI",
        SailingDay: sailingDay,
        VesselAbbrev: "CAT",
      }
    );

    expect(scheduledEvents).toEqual([]);
  });

  it("strips Convex metadata from actual and predicted rows", async () => {
    const { actualEvents, predictedEvents } =
      await loadRouteTimelineSnapshotInputs(
        makeQueryCtx({
          scheduledTrips: [makeTrip({ VesselAbbrev: "WEN" })],
          scheduledEvents: [
            makeScheduledEvent({
              VesselAbbrev: "WEN",
              Key: "t1--dep-dock",
              EventType: "dep-dock",
            }),
          ],
          actualEvents: [
            {
              ...makeActualEvent({ VesselAbbrev: "WEN" }),
              _id: "actual1" as unknown as never,
              _creationTime: 1,
            },
          ],
          predictedEvents: [
            {
              ...makePredictedEvent({ VesselAbbrev: "WEN" }),
              _id: "pred1" as unknown as never,
              _creationTime: 2,
            },
          ],
        }),
        { RouteAbbrev: "SEA-BBI", SailingDay: sailingDay }
      );

    expect(actualEvents[0]).not.toHaveProperty("_id");
    expect(actualEvents[0]).not.toHaveProperty("_creationTime");
    expect(predictedEvents[0]).not.toHaveProperty("_id");
    expect(predictedEvents[0]).not.toHaveProperty("_creationTime");
  });

  it("builds a snapshot with two vessels from loader output", async () => {
    const inputs = await loadRouteTimelineSnapshotInputs(
      makeQueryCtx({
        scheduledTrips: [
          makeTrip({ VesselAbbrev: "ZEB", Key: "z1" }),
          makeTrip({ VesselAbbrev: "CAT", Key: "c1" }),
        ],
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
      }),
      { RouteAbbrev: "SEA-BBI", SailingDay: sailingDay }
    );

    const snapshot = buildRouteTimelineSnapshot({
      RouteAbbrev: "SEA-BBI",
      SailingDay: sailingDay,
      scope: {},
      ...inputs,
    });

    expect(snapshot.Vessels.map((v) => v.VesselAbbrev)).toEqual(["CAT", "ZEB"]);
  });
});

type MockQueryData = {
  scheduledTrips?: ConvexScheduledTrip[];
  scheduledEvents?: ConvexScheduledDockEvent[];
  actualEvents?: Array<
    ConvexActualDockEvent & { _id?: string; _creationTime?: number }
  >;
  predictedEvents?: Array<
    ConvexPredictedDockEvent & { _id?: string; _creationTime?: number }
  >;
};

/**
 * Builds a minimal in-memory `QueryCtx` supporting `scheduledTrips` and event
 * tables with index equality filters.
 *
 * @param data - Mock rows per table
 * @returns Context for loader tests
 */
const makeQueryCtx = (data: MockQueryData): QueryCtx =>
  ({
    db: {
      query: (tableName: string) => ({
        withIndex: (
          _indexName: string,
          buildRange: (q: {
            eq: (fieldName: string, value: string) => unknown;
          }) => unknown
        ) => {
          const range = {
            filters: [] as Array<{ fieldName: string; value: string }>,
            eq(fieldName: string, value: string) {
              this.filters.push({ fieldName, value });
              return this;
            },
          };
          buildRange(range);

          const rows = getRowsForTable(data, tableName).filter((row) =>
            range.filters.every(
              ({ fieldName, value }) =>
                String((row as Record<string, unknown>)[fieldName]) === value
            )
          );

          return {
            collect: async () => rows,
          };
        },
      }),
    },
  }) as unknown as QueryCtx;

const getRowsForTable = (data: MockQueryData, tableName: string) => {
  switch (tableName) {
    case "scheduledTrips":
      return data.scheduledTrips ?? [];
    case "eventsScheduled":
      return data.scheduledEvents ?? [];
    case "eventsActual":
      return data.actualEvents ?? [];
    case "eventsPredicted":
      return data.predictedEvents ?? [];
    case "vesselLocations":
      throw new Error(
        "loadRouteTimelineSnapshotInputs must not read locations"
      );
    default:
      throw new Error(`unexpected table in test mock: ${tableName}`);
  }
};

const makeTrip = (
  overrides: Partial<ConvexScheduledTrip> &
    Pick<ConvexScheduledTrip, "VesselAbbrev">
): ConvexScheduledTrip => {
  const { VesselAbbrev, RouteAbbrev, ...rest } = overrides;
  return {
    DepartingTerminalAbbrev: "P52",
    ArrivingTerminalAbbrev: "BBI",
    DepartingTime: at(8, 0),
    ArrivingTime: at(8, 35),
    SailingNotes: "",
    Annotations: [],
    RouteID: 1,
    RouteAbbrev: RouteAbbrev ?? "SEA-BBI",
    Key: `${VesselAbbrev}-trip`,
    SailingDay: sailingDay,
    TripType: "direct",
    VesselAbbrev,
    ...rest,
  };
};

const makeScheduledEvent = (
  overrides: Partial<ConvexScheduledDockEvent>
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
  overrides: Partial<ConvexActualDockEvent>
): ConvexActualDockEvent => ({
  EventKey: "ak",
  TripKey: "tk",
  ScheduleKey: "seg",
  VesselAbbrev: "WEN",
  SailingDay: sailingDay,
  UpdatedAt: at(6, 0),
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  EventType: "dep-dock",
  EventOccurred: true,
  EventActualTime: at(8, 1),
  ...overrides,
});

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
