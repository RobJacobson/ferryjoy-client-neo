// @ts-nocheck
import { describe, expect, it } from "bun:test";
import type { VesselTimelineTrip } from "@/data/contexts";
import {
  getAdaptivePixelsPerMinute,
  getVesselTimelineRenderState,
} from "./getVesselTimelineRenderState";

const at = (hours: number, minutes: number) =>
  new Date(Date.UTC(2026, 2, 13, hours, minutes));

describe("getAdaptivePixelsPerMinute", () => {
  it("clamps sparse schedules to the minimum pixels per minute", () => {
    expect(getAdaptivePixelsPerMinute([makeTrip("trip-1")])).toBe(3);
  });

  it("scales denser schedules with the row-count multiplier", () => {
    expect(
      getAdaptivePixelsPerMinute([
        makeTrip("trip-1"),
        makeTrip("trip-2"),
        makeTrip("trip-3"),
        makeTrip("trip-4"),
        makeTrip("trip-5"),
      ])
    ).toBe(3);
    expect(
      getAdaptivePixelsPerMinute([
        makeTrip("trip-1"),
        makeTrip("trip-2"),
        makeTrip("trip-3"),
        makeTrip("trip-4"),
        makeTrip("trip-5"),
        makeTrip("trip-6"),
        makeTrip("trip-7"),
      ])
    ).toBe(3.5);
  });

  it("clamps very dense schedules to the maximum pixels per minute", () => {
    expect(
      getAdaptivePixelsPerMinute(
        Array.from({ length: 20 }, (_, index) => makeTrip(`trip-${index + 1}`))
      )
    ).toBe(6);
  });

  it("passes the adaptive ratio through the render state layout", () => {
    const renderState = getVesselTimelineRenderState(
      [makeTrip("trip-1"), makeTrip("trip-2"), makeTrip("trip-3")],
      undefined,
      at(20, 35)
    );

    expect(renderState.layout.pixelsPerMinute).toBe(3);
  });
});

const makeTrip = (key: string): VesselTimelineTrip => ({
  key,
  vesselAbbrev: "CAT",
  sailingDay: "2026-03-13",
  routeAbbrev: "VAS",
  departingTerminalAbbrev: "VSH",
  arrivingTerminalAbbrev: "SWV",
  scheduledDeparture: at(20, 30),
  scheduledArrival: at(20, 40),
  hasActiveData: false,
  hasCompletedData: false,
});
