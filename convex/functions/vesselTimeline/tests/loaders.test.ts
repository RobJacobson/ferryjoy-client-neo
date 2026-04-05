/**
 * Covers the single-sailing-day VesselTimeline backbone loader orchestration.
 */

import { describe, expect, it } from "bun:test";
import type { QueryCtx } from "_generated/server";
import type { ConvexActualBoundaryEvent } from "../../eventsActual/schemas";
import type { ConvexPredictedBoundaryEvent } from "../../eventsPredicted/schemas";
import type { ConvexScheduledBoundaryEvent } from "../../eventsScheduled/schemas";
import { loadVesselTimelineBackboneInputs } from "../loaders";

const at = (hours: number, minutes: number, day = 25) =>
  Date.UTC(2026, 2, day, hours, minutes);

describe("loadVesselTimelineBackboneInputs", () => {
  it("loads only the requested sailing day's scheduled rows", async () => {
    const backboneInputs = await loadVesselTimelineBackboneInputs(
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

    expect(backboneInputs.scheduledEvents.map((event) => event.Key)).toEqual([
      "trip-1--arv-dock",
      "trip-2--dep-dock",
      "trip-2--arv-dock",
    ]);
  });

  it("loads only same-day actual and predicted overlays", async () => {
    const backboneInputs = await loadVesselTimelineBackboneInputs(
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

    expect(backboneInputs.actualEvents.map((event) => event.Key)).toEqual([
      "trip-1--dep-dock",
    ]);
    expect(backboneInputs.predictedEvents.map((event) => event.Key)).toEqual([
      "trip-1--arv-dock",
    ]);
  });

  it("returns an empty same-day slice when the sailing day has no rows", async () => {
    const backboneInputs = await loadVesselTimelineBackboneInputs(
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

    expect(backboneInputs.scheduledEvents).toEqual([]);
    expect(backboneInputs.actualEvents).toEqual([]);
    expect(backboneInputs.predictedEvents).toEqual([]);
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
 * @param data - Mock table contents used by the loader
 * @returns QueryCtx-compatible object for the tested queries
 */
const makeQueryCtx = (data: MockQueryData): QueryCtx =>
  ({
    db: {
      query: (tableName: string) => ({
        withIndex: (
          indexName: string,
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
              ({ fieldName, value }) => String(row[fieldName]) === value
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
  overrides: Partial<ConvexActualBoundaryEvent>
): ConvexActualBoundaryEvent => ({
  Key: "trip-1--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  UpdatedAt: at(6, 0),
  ScheduledDeparture: at(8, 0),
  TerminalAbbrev: "P52",
  EventActualTime: at(8, 2),
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
