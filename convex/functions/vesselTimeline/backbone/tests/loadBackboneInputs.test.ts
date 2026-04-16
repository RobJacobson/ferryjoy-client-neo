/**
 * Covers same-day row loading inside `loadVesselTimelineBackbone`.
 */

import { describe, expect, it } from "bun:test";
import type { QueryCtx } from "_generated/server";
import { getSegmentKeyFromBoundaryKey } from "domain/timelineRows/scheduledSegmentResolvers";
import type { ConvexActualBoundaryEvent } from "functions/eventsActual/schemas";
import type { ConvexPredictedBoundaryEvent } from "functions/eventsPredicted/schemas";
import type { ConvexScheduledBoundaryEvent } from "functions/eventsScheduled/schemas";
import { loadVesselTimelineBackbone } from "functions/vesselTimeline/queries";
import { buildPhysicalActualEventKey } from "shared/physicalTripIdentity";

const at = (hours: number, minutes: number, day = 25) =>
  Date.UTC(2026, 2, day, hours, minutes);

describe("loadVesselTimelineBackbone", () => {
  it("loads only the requested sailing day's scheduled rows", async () => {
    const backbone = await loadVesselTimelineBackbone(
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
      }),
      {
        VesselAbbrev: "WEN",
        SailingDay: "2026-03-25",
      }
    );

    expect(backbone.events.map((event) => event.Key)).toEqual([
      "trip-1--arv-dock",
      "trip-2--dep-dock",
      "trip-2--arv-dock",
    ]);
  });

  it("does not synthesize backbone rows from same-day overlays without scheduled structure", async () => {
    const backbone = await loadVesselTimelineBackbone(
      makeQueryCtx({
        scheduledEvents: [],
        actualEvents: [
          makeActualEvent({
            Key: "trip-1--dep-dock",
            SailingDay: "2026-03-25",
          }),
          makeActualEvent({
            Key: "trip-2--dep-dock",
            SailingDay: "2026-03-26",
          }),
        ],
        predictedEvents: [
          makePredictedEvent({
            Key: "trip-1--arv-dock",
            SailingDay: "2026-03-25",
          }),
          makePredictedEvent({
            Key: "trip-2--arv-dock",
            SailingDay: "2026-03-26",
          }),
        ],
      }),
      {
        VesselAbbrev: "WEN",
        SailingDay: "2026-03-25",
      }
    );

    expect(backbone.events).toEqual([]);
  });

  it("returns an empty same-day slice when the sailing day has no rows", async () => {
    const backbone = await loadVesselTimelineBackbone(
      makeQueryCtx({
        scheduledEvents: [
          makeScheduledEvent({
            Key: "trip-1--arv-dock",
            SailingDay: "2026-03-24",
          }),
        ],
      }),
      {
        VesselAbbrev: "WEN",
        SailingDay: "2026-03-25",
      }
    );

    expect(backbone.events).toEqual([]);
  });
});

type MockQueryData = {
  scheduledEvents?: ConvexScheduledBoundaryEvent[];
  actualEvents?: ConvexActualBoundaryEvent[];
  predictedEvents?: ConvexPredictedBoundaryEvent[];
};

/**
 * Builds a minimal in-memory QueryCtx for loader tests.
 *
 * @param data - Mock table contents used by the backbone query
 * @returns QueryCtx-compatible object for the tested query
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
    case "eventsScheduled":
      return data.scheduledEvents ?? [];
    case "eventsActual":
      return data.actualEvents ?? [];
    case "eventsPredicted":
      return data.predictedEvents ?? [];
    default:
      return [];
  }
};

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

const makeActualEvent = (
  overrides: Partial<ConvexActualBoundaryEvent> & { Key?: string }
): ConvexActualBoundaryEvent => {
  const legacyBoundary = overrides.Key ?? "trip-1--dep-dock";
  const merged = {
    VesselAbbrev: "WEN" as const,
    SailingDay: "2026-03-25" as const,
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
    merged.ScheduleKey ?? getSegmentKeyFromBoundaryKey(legacyBoundary);
  const tripKey = merged.TripKey ?? `TST 2026-03-25 12:00:00Z ${segment}`;
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
