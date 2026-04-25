/**
 * Unit tests for VesselTimeline pipeline mode resolution.
 */

import { describe, expect, it } from "bun:test";
import {
  resolveVesselTimelinePipelineMode,
  shouldWaitForVesselTimelineRouteScope,
  USE_ROUTE_TIMELINE_MODEL_PIPELINE,
} from "../pipelineMode";

describe("resolveVesselTimelinePipelineMode", () => {
  it("uses route-model mode by default when route scope exists", () => {
    const mode = resolveVesselTimelinePipelineMode({
      routeAbbrev: "sea-bi",
    });

    expect(USE_ROUTE_TIMELINE_MODEL_PIPELINE).toBeTrue();
    expect(mode).toBe("route-model");
  });

  it("falls back to legacy mode when route scope is missing", () => {
    const mode = resolveVesselTimelinePipelineMode({
      routeAbbrev: undefined,
    });

    expect(mode).toBe("legacy-events");
  });

  it("supports explicit legacy override for temporary comparison", () => {
    const mode = resolveVesselTimelinePipelineMode({
      routeAbbrev: "sea-bi",
      preferRouteModel: false,
    });

    expect(mode).toBe("legacy-events");
  });
});

describe("shouldWaitForVesselTimelineRouteScope", () => {
  it("waits for route scope while route-model mode is preferred", () => {
    const shouldWait = shouldWaitForVesselTimelineRouteScope({
      routeAbbrev: undefined,
      isRouteScopeLoading: true,
    });

    expect(shouldWait).toBeTrue();
  });

  it("does not wait once route scope is available", () => {
    const shouldWait = shouldWaitForVesselTimelineRouteScope({
      routeAbbrev: "sea-bi",
      isRouteScopeLoading: true,
    });

    expect(shouldWait).toBeFalse();
  });

  it("does not wait when legacy mode is explicitly preferred", () => {
    const shouldWait = shouldWaitForVesselTimelineRouteScope({
      routeAbbrev: undefined,
      isRouteScopeLoading: true,
      preferRouteModel: false,
    });

    expect(shouldWait).toBeFalse();
  });
});
