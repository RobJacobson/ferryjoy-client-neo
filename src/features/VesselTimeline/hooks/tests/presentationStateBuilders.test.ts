/**
 * Unit tests for `presentationStateBuilders` (event-row presentation state).
 */

import { describe, expect, it } from "bun:test";
import { BASE_TIMELINE_VISUAL_THEME } from "@/components/timeline/theme";
import { buildEventRowTimelinePresentationState } from "../presentationStateBuilders";

const FIXED_NOW = new Date("2026-04-25T08:20:00.000Z");

const getTerminalNameByAbbrev = () => null;

const baseEvents = {
  vesselAbbrev: "WEN",
  sailingDay: "2026-04-25",
  scheduledEvents: [] as const,
  actualEvents: [] as const,
  predictedEvents: [] as const,
  retry: () => {},
};

describe("buildEventRowTimelinePresentationState", () => {
  it("returns loading state while event rows are pending", () => {
    const state = buildEventRowTimelinePresentationState({
      events: {
        ...baseEvents,
        scheduledEvents: [],
        actualEvents: [],
        predictedEvents: [],
        isLoading: true,
        errorMessage: null,
      },
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

  it("returns error state when event context reports an error", () => {
    const state = buildEventRowTimelinePresentationState({
      events: {
        ...baseEvents,
        scheduledEvents: [],
        actualEvents: [],
        predictedEvents: [],
        isLoading: false,
        errorMessage: "Events query failed",
      },
      getTerminalNameByAbbrev,
      currentVesselLocation: null,
      now: FIXED_NOW,
      theme: BASE_TIMELINE_VISUAL_THEME,
    });

    expect(state.isLoading).toBeFalse();
    expect(state.error).toBe("Events query failed");
    expect(state.emptyMessage).toBeNull();
    expect(state.renderState).toBeNull();
  });

  it("returns empty message when loaded day has no timeline rows", () => {
    const state = buildEventRowTimelinePresentationState({
      events: {
        ...baseEvents,
        scheduledEvents: [],
        actualEvents: [],
        predictedEvents: [],
        isLoading: false,
        errorMessage: null,
      },
      getTerminalNameByAbbrev,
      currentVesselLocation: null,
      now: FIXED_NOW,
      theme: BASE_TIMELINE_VISUAL_THEME,
    });

    expect(state.isLoading).toBeFalse();
    expect(state.error).toBeNull();
    expect(state.emptyMessage).toBe(
      "No vessel timeline events were found for WEN on 2026-04-25."
    );
    expect(state.renderState).toBeNull();
  });
});
