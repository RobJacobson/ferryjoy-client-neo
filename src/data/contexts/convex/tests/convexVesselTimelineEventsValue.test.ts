/**
 * Tests for pure context value construction from parallel query results.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexScheduledDockEvent } from "convex/functions/events/eventsScheduled/schemas";
import { buildConvexVesselTimelineEventsContextValue } from "../convexVesselTimelineEventsValue";

const sampleScheduled = (): ConvexScheduledDockEvent => ({
  Key: "trip--dep-dock",
  VesselAbbrev: "WEN",
  SailingDay: "2026-03-25",
  UpdatedAt: 1,
  ScheduledDeparture: 2,
  TerminalAbbrev: "P52",
  NextTerminalAbbrev: "BBI",
  EventType: "dep-dock",
});

describe("buildConvexVesselTimelineEventsContextValue", () => {
  it("treats all undefined slices as loading with empty arrays", () => {
    const retry = () => {};
    const value = buildConvexVesselTimelineEventsContextValue({
      vesselAbbrev: "CAT",
      sailingDay: "2026-03-24",
      scheduledRaw: undefined,
      actualRaw: undefined,
      predictedRaw: undefined,
      retry,
    });

    expect(value.isLoading).toBe(true);
    expect(value.scheduledEvents).toEqual([]);
    expect(value.actualEvents).toEqual([]);
    expect(value.predictedEvents).toEqual([]);
    expect(value.errorMessage).toBeNull();
    expect(value.retry).toBe(retry);
  });

  it("is not loading when all slices are defined, including empty arrays", () => {
    const retry = () => {};
    const value = buildConvexVesselTimelineEventsContextValue({
      vesselAbbrev: "CAT",
      sailingDay: "2026-03-24",
      scheduledRaw: [],
      actualRaw: [],
      predictedRaw: [],
      retry,
    });

    expect(value.isLoading).toBe(false);
    expect(value.scheduledEvents).toEqual([]);
    expect(value.actualEvents).toEqual([]);
    expect(value.predictedEvents).toEqual([]);
  });

  it("stays loading when any slice is still undefined", () => {
    const value = buildConvexVesselTimelineEventsContextValue({
      vesselAbbrev: "CAT",
      sailingDay: "2026-03-24",
      scheduledRaw: [],
      actualRaw: undefined,
      predictedRaw: [],
      retry: () => {},
    });

    expect(value.isLoading).toBe(true);
    expect(value.scheduledEvents).toEqual([]);
    expect(value.actualEvents).toEqual([]);
    expect(value.predictedEvents).toEqual([]);
  });

  it("passes through loaded row arrays when all slices are defined", () => {
    const scheduled = [sampleScheduled()];
    const value = buildConvexVesselTimelineEventsContextValue({
      vesselAbbrev: "WEN",
      sailingDay: "2026-03-25",
      scheduledRaw: scheduled,
      actualRaw: [],
      predictedRaw: [],
      retry: () => {},
    });

    expect(value.isLoading).toBe(false);
    expect(value.scheduledEvents).toBe(scheduled);
    expect(value.actualEvents).toEqual([]);
    expect(value.predictedEvents).toEqual([]);
  });

  it("passes through retry identity", () => {
    const retry = () => {};
    const value = buildConvexVesselTimelineEventsContextValue({
      vesselAbbrev: "WEN",
      sailingDay: "2026-03-25",
      scheduledRaw: [],
      actualRaw: [],
      predictedRaw: [],
      retry,
    });

    expect(value.retry).toBe(retry);
    expect(value.vesselAbbrev).toBe("WEN");
    expect(value.sailingDay).toBe("2026-03-25");
  });
});
