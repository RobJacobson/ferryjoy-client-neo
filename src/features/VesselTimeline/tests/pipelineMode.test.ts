/**
 * Unit tests for VesselTimeline route-scope wait behavior.
 */

import { describe, expect, it } from "bun:test";
import { shouldWaitForVesselTimelineRouteScope } from "../pipelineMode";

describe("shouldWaitForVesselTimelineRouteScope", () => {
  it("waits for route scope while route abbrev is unresolved", () => {
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

  it("does not wait when route scope is not loading", () => {
    const shouldWait = shouldWaitForVesselTimelineRouteScope({
      routeAbbrev: undefined,
      isRouteScopeLoading: false,
    });

    expect(shouldWait).toBeFalse();
  });
});
