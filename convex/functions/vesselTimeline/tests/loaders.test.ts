/**
 * Covers the single-sailing-day VesselTimeline loader orchestration.
 */

import { describe, expect, it } from "bun:test";
import type { QueryCtx } from "_generated/server";
import type { ConvexActualBoundaryEvent } from "../../eventsActual/schemas";
import type { ConvexPredictedBoundaryEvent } from "../../eventsPredicted/schemas";
import type { ConvexScheduledBoundaryEvent } from "../../eventsScheduled/schemas";
import type { ConvexVesselLocation } from "../../vesselLocation/schemas";
import { loadVesselTimelineViewModelInputs } from "../loaders";

const at = (hours: number, minutes: number, day = 25) =>
  Date.UTC(2026, 2, day, hours, minutes);

describe("loadVesselTimelineViewModelInputs", () => {
  it("loads only the requested sailing day's scheduled rows", async () => {
    const viewModelInputs = await loadVesselTimelineViewModelInputs(
      makeQueryCtx({
        scheduledEvents: [
          makeScheduledEvent({
            Key: "trip-1--arv-dock",
            TerminalAbbrev: "CLI",
            EventType: "arv-dock",
            ScheduledDeparture: at(9, 30),
            EventScheduledTime: at(10, 35),
          }),
          makeScheduledEvent({
            Key: "trip-2--dep-dock",
            TerminalAbbrev: "CLI",
            EventType: "dep-dock",
            ScheduledDeparture: at(11, 0),
            EventScheduledTime: at(11, 0),
          }),
          makeScheduledEvent({
            Key: "trip-2--arv-dock",
            TerminalAbbrev: "MUK",
            EventType: "arv-dock",
            ScheduledDeparture: at(11, 0),
            EventScheduledTime: at(11, 35),
          }),
          makeScheduledEvent({
            Key: "trip-3--dep-dock",
            SailingDay: "2026-03-26",
            TerminalAbbrev: "MUK",
            EventType: "dep-dock",
            ScheduledDeparture: at(6, 0, 26),
            EventScheduledTime: at(6, 0, 26),
          }),
        ],
        location: makeLocation({
          VesselAbbrev: "WEN",
          AtDock: true,
          DepartingTerminalAbbrev: "CLI",
          Key: undefined,
          TimeStamp: at(11, 8),
        }),
      }),
      {
        VesselAbbrev: "WEN",
        SailingDay: "2026-03-25",
      }
    );

    expect(viewModelInputs.scheduledEvents.map((event) => event.Key)).toEqual([
      "trip-1--arv-dock",
      "trip-2--dep-dock",
      "trip-2--arv-dock",
    ]);
    expect(viewModelInputs.location?.DepartingTerminalAbbrev).toBe("CLI");
  });

  it("prepends the prior sailing day's arrival that anchors the first departure", async () => {
    const viewModelInputs = await loadVesselTimelineViewModelInputs(
      makeQueryCtx({
        scheduledEvents: [
          makeScheduledEvent({
            Key: "trip-0--arv-dock",
            SailingDay: "2026-03-24",
            TerminalAbbrev: "P52",
            EventType: "arv-dock",
            ScheduledDeparture: at(22, 0, 24),
            EventScheduledTime: at(22, 35, 24),
            IsLastArrivalOfSailingDay: true,
          }),
          makeScheduledEvent({
            Key: "trip-1--dep-dock",
            TerminalAbbrev: "P52",
            EventType: "dep-dock",
            ScheduledDeparture: at(5, 0),
            EventScheduledTime: at(5, 0),
          }),
          makeScheduledEvent({
            Key: "trip-1--arv-dock",
            TerminalAbbrev: "BBI",
            EventType: "arv-dock",
            ScheduledDeparture: at(5, 0),
            EventScheduledTime: at(5, 35),
          }),
        ],
        actualEvents: [
          makeActualEvent({
            Key: "trip-0--arv-dock",
            SailingDay: "2026-03-24",
            ScheduledDeparture: at(22, 0, 24),
            TerminalAbbrev: "P52",
            EventActualTime: at(22, 42, 24),
          }),
        ],
        predictedEvents: [
          makePredictedEvent({
            Key: "trip-0--arv-dock",
            SailingDay: "2026-03-24",
            ScheduledDeparture: at(22, 0, 24),
            TerminalAbbrev: "P52",
            EventPredictedTime: at(22, 40, 24),
          }),
        ],
      }),
      {
        VesselAbbrev: "WEN",
        SailingDay: "2026-03-25",
      }
    );

    expect(viewModelInputs.scheduledEvents.map((event) => event.Key)).toEqual([
      "trip-0--arv-dock",
      "trip-1--dep-dock",
      "trip-1--arv-dock",
    ]);
    expect(viewModelInputs.actualEvents.map((event) => event.Key)).toEqual([
      "trip-0--arv-dock",
    ]);
    expect(viewModelInputs.predictedEvents.map((event) => event.Key)).toEqual([
      "trip-0--arv-dock",
    ]);
  });

  it("keeps attachment inputs scoped to the requested day when continuity would require the next day", async () => {
    const viewModelInputs = await loadVesselTimelineViewModelInputs(
      makeQueryCtx({
        scheduledEvents: [
          makeScheduledEvent({
            Key: "trip-1--dep-dock",
            SailingDay: "2026-03-25",
            TerminalAbbrev: "FAU",
            EventType: "dep-dock",
            ScheduledDeparture: at(19, 0),
            EventScheduledTime: at(19, 0),
          }),
          makeScheduledEvent({
            Key: "trip-1--arv-dock",
            SailingDay: "2026-03-25",
            TerminalAbbrev: "VAI",
            EventType: "arv-dock",
            ScheduledDeparture: at(19, 0),
            EventScheduledTime: at(19, 30),
          }),
          makeScheduledEvent({
            Key: "trip-2--dep-dock",
            SailingDay: "2026-03-26",
            TerminalAbbrev: "VAI",
            EventType: "dep-dock",
            ScheduledDeparture: at(6, 0, 26),
            EventScheduledTime: at(6, 0, 26),
          }),
        ],
        location: makeLocation({
          VesselAbbrev: "WEN",
          AtDock: true,
          DepartingTerminalAbbrev: "VAI",
          Key: undefined,
          TimeStamp: at(19, 58),
        }),
      }),
      {
        VesselAbbrev: "WEN",
        SailingDay: "2026-03-25",
      }
    );

    expect(viewModelInputs.scheduledEvents.map((event) => event.Key)).toEqual([
      "trip-1--dep-dock",
      "trip-1--arv-dock",
    ]);
    expect(viewModelInputs.location?.DepartingTerminalAbbrev).toBe("VAI");
  });

  it("returns an empty scheduled slice when the requested sailing day has no rows", async () => {
    const viewModelInputs = await loadVesselTimelineViewModelInputs(
      makeQueryCtx({
        scheduledEvents: [
          makeScheduledEvent({
            Key: "trip-1--arv-dock",
            SailingDay: "2026-03-25",
            TerminalAbbrev: "VAI",
            EventType: "arv-dock",
            ScheduledDeparture: at(20, 0),
            EventScheduledTime: at(20, 30),
          }),
        ],
        location: makeLocation({
          VesselAbbrev: "WEN",
          AtDock: true,
          DepartingTerminalAbbrev: "VAI",
          Key: undefined,
          TimeStamp: at(0, 10, 26),
        }),
      }),
      {
        VesselAbbrev: "WEN",
        SailingDay: "2026-03-26",
      }
    );

    expect(viewModelInputs.scheduledEvents).toEqual([]);
    expect(viewModelInputs.location?.DepartingTerminalAbbrev).toBe("VAI");
  });

  it("returns null when the live location row is missing", async () => {
    const viewModelInputs = await loadVesselTimelineViewModelInputs(
      makeQueryCtx({
        scheduledEvents: [
          makeScheduledEvent({
            Key: "trip-1--dep-dock",
            TerminalAbbrev: "P52",
            EventType: "dep-dock",
            ScheduledDeparture: at(8, 0),
            EventScheduledTime: at(8, 0),
          }),
        ],
      }),
      {
        VesselAbbrev: "WEN",
        SailingDay: "2026-03-25",
      }
    );

    expect(viewModelInputs.location).toBeNull();
  });
});

type MockQueryData = {
  scheduledEvents?: ConvexScheduledBoundaryEvent[];
  actualEvents?: ConvexActualBoundaryEvent[];
  predictedEvents?: ConvexPredictedBoundaryEvent[];
  location?: ConvexVesselLocation | null;
};

/**
 * Builds a minimal in-memory QueryCtx for loader tests.
 *
 * @param data - Mock table contents used by the loader
 * @returns QueryCtx-compatible object for the tested queries
 */
const makeQueryCtx = (data: MockQueryData): QueryCtx =>
  ({
    db: {
      query: (tableName: string) => ({
        withIndex: (
          _indexName: string,
          builder: (queryBuilder: {
            eq: (field: string, value: unknown) => unknown;
          }) => unknown
        ) => {
          const filters: Record<string, unknown> = {};
          const queryBuilder = {
            eq: (field: string, value: unknown) => {
              filters[field] = value;
              return queryBuilder;
            },
          };
          builder(queryBuilder);

          const rows = getRowsForTable(tableName, data).filter((row) =>
            Object.entries(filters).every(
              ([field, value]) => row[field] === value
            )
          );

          return {
            collect: async () => rows,
            unique: async () => rows[0] ?? null,
            first: async () => rows[0] ?? null,
          };
        },
      }),
    },
  }) as unknown as QueryCtx;

/**
 * Returns the mock rows for one queried table.
 *
 * @param tableName - Convex table name requested by the loader
 * @param data - Backing mock data
 * @returns Plain row objects for that table
 */
const getRowsForTable = (tableName: string, data: MockQueryData) => {
  switch (tableName) {
    case "eventsScheduled":
      return data.scheduledEvents ?? [];
    case "eventsActual":
      return data.actualEvents ?? [];
    case "eventsPredicted":
      return data.predictedEvents ?? [];
    case "vesselLocations":
      return data.location ? [data.location] : [];
    default:
      return [];
  }
};

/**
 * Builds a scheduled boundary event for loader tests.
 *
 * @param overrides - Field overrides
 * @returns Scheduled boundary event
 */
const makeScheduledEvent = (
  overrides: Partial<ConvexScheduledBoundaryEvent>
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

/**
 * Builds a vessel-location row for loader tests.
 *
 * @param overrides - Field overrides
 * @returns Live vessel-location row
 */
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

/**
 * Builds an actual boundary event for loader tests.
 *
 * @param overrides - Field overrides
 * @returns Actual boundary event
 */
const makeActualEvent = (
  overrides: Partial<ConvexActualBoundaryEvent>
): ConvexActualBoundaryEvent => ({
  Key: "trip-1--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  UpdatedAt: at(6, 0),
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  EventActualTime: at(8, 3),
  ...overrides,
});

/**
 * Builds a predicted boundary event for loader tests.
 *
 * @param overrides - Field overrides
 * @returns Predicted boundary event
 */
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
