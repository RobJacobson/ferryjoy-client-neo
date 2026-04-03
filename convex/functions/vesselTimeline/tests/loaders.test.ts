/**
 * Covers the event-only VesselTimeline loader orchestration.
 */

import { describe, expect, it } from "bun:test";
import type { QueryCtx } from "_generated/server";
import type { ConvexScheduledBoundaryEvent } from "../../eventsScheduled/schemas";
import type { ConvexVesselLocation } from "../../vesselLocation/schemas";
import type { ConvexVesselTrip } from "../../vesselTrips/schemas";
import { loadVesselTimelineViewModelInputs } from "../loaders";

const at = (hours: number, minutes: number, day = 25) =>
  Date.UTC(2026, 2, day, hours, minutes);

describe("loadVesselTimelineViewModelInputs", () => {
  it("derives terminal-tail ownership from the next departure event", async () => {
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
      }),
      {
        VesselAbbrev: "WEN",
        SailingDay: "2026-03-25",
      }
    );

    expect(viewModelInputs.terminalTailTripKey).toBe("trip-2");
  });

  it("falls back to the arriving trip when no later departure exists", async () => {
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
        ],
      }),
      {
        VesselAbbrev: "WEN",
        SailingDay: "2026-03-25",
      }
    );

    expect(viewModelInputs.terminalTailTripKey).toBe("trip-1");
  });

  it("keeps a keyless docked vessel attached to the delayed current dock row", async () => {
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

    expect(viewModelInputs.inferredDockedTripKey).toBe("trip-2");
  });

  it("keeps rollover continuity when the next departure is on the following sailing day", async () => {
    const viewModelInputs = await loadVesselTimelineViewModelInputs(
      makeQueryCtx({
        scheduledEvents: [
          makeScheduledEvent({
            Key: "trip-1--dep-dock",
            SailingDay: "2026-03-25",
            TerminalAbbrev: "FAU",
            EventType: "dep-dock",
            ScheduledDeparture: at(20, 0),
            EventScheduledTime: at(20, 0),
          }),
          makeScheduledEvent({
            Key: "trip-1--arv-dock",
            SailingDay: "2026-03-25",
            TerminalAbbrev: "VAI",
            EventType: "arv-dock",
            ScheduledDeparture: at(20, 0),
            EventScheduledTime: at(20, 30),
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
          TimeStamp: at(5, 50, 26),
        }),
        activeTrip: makeTrip({
          Key: undefined,
          PrevScheduledDeparture: at(20, 0),
        }),
      }),
      {
        VesselAbbrev: "WEN",
        SailingDay: "2026-03-26",
      }
    );

    expect(viewModelInputs.inferredDockedTripKey).toBe("trip-2");
  });
});

type MockQueryData = {
  scheduledEvents?: ConvexScheduledBoundaryEvent[];
  location?: ConvexVesselLocation | null;
  activeTrip?: ConvexVesselTrip | null;
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
    case "eventsPredicted":
      return [];
    case "vesselLocations":
      return data.location ? [data.location] : [];
    case "activeVesselTrips":
      return data.activeTrip ? [data.activeTrip] : [];
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
 * Builds an active-trip row for loader tests.
 *
 * @param overrides - Field overrides
 * @returns Vessel trip row
 */
const makeTrip = (overrides: Partial<ConvexVesselTrip>): ConvexVesselTrip => ({
  VesselAbbrev: "WEN",
  DepartingTerminalAbbrev: "P52",
  ArrivingTerminalAbbrev: "BBI",
  RouteAbbrev: "SEA-BBI",
  Key: "trip-1",
  SailingDay: "2026-03-25",
  PrevTerminalAbbrev: "BBI",
  ArriveDest: undefined,
  TripStart: at(7, 45),
  AtDock: true,
  AtDockDuration: undefined,
  ScheduledDeparture: at(8, 0),
  LeftDock: undefined,
  TripDelay: undefined,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: at(8, 0),
  PrevScheduledDeparture: at(6, 55),
  PrevLeftDock: at(7, 0),
  NextKey: "trip-2",
  NextScheduledDeparture: at(9, 0),
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
  ...overrides,
});
