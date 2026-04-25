/**
 * Unit tests for VesselTimeline presentation-state builders.
 */

import { describe, expect, it } from "bun:test";
import { BASE_TIMELINE_VISUAL_THEME } from "@/components/timeline/theme";
import { buildRouteModelTimelinePresentationState } from "../presentationStateBuilders";

const FIXED_NOW = new Date("2026-04-25T08:20:00.000Z");

const getTerminalNameByAbbrev = () => null;

describe("buildRouteModelTimelinePresentationState", () => {
  it("returns loading state while route snapshot is pending", () => {
    const state = buildRouteModelTimelinePresentationState({
      vesselAbbrev: "WEN",
      sailingDay: "2026-04-25",
      snapshot: null,
      isLoading: true,
      errorMessage: null,
      retry: () => {},
      getTerminalNameByAbbrev,
      currentVesselLocation: null,
      now: FIXED_NOW,
      theme: BASE_TIMELINE_VISUAL_THEME,
    });

    expect(state.isLoading).toBeTrue();
    expect(state.error).toBeNull();
    expect(state.emptyMessage).toBeNull();
    expect(state.renderState).toBeNull();
  });

  it("returns error state when route snapshot query fails", () => {
    const state = buildRouteModelTimelinePresentationState({
      vesselAbbrev: "WEN",
      sailingDay: "2026-04-25",
      snapshot: null,
      isLoading: false,
      errorMessage: "Route snapshot failed",
      retry: () => {},
      getTerminalNameByAbbrev,
      currentVesselLocation: null,
      now: FIXED_NOW,
      theme: BASE_TIMELINE_VISUAL_THEME,
    });

    expect(state.isLoading).toBeFalse();
    expect(state.error).toBe("Route snapshot failed");
    expect(state.emptyMessage).toBeNull();
    expect(state.renderState).toBeNull();
  });
});
