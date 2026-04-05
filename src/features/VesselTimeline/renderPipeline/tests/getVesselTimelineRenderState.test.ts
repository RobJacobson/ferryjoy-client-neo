/**
 * Covers the public VesselTimeline render-pipeline entrypoint.
 */

import { describe, expect, it } from "bun:test";
import { getVesselTimelineRenderState } from "..";
import {
  at,
  getTerminalNameByAbbrev,
  makeEventSlice,
  makeVesselLocation,
} from "./fixtures";

describe("getVesselTimelineRenderState", () => {
  it("maps the backend active interval into a derived active sea row", () => {
    const renderState = getVesselTimelineRenderState({
      events: makeEventSlice(),
      activeInterval: {
        kind: "at-sea",
        startEventKey: "trip-1--dep-dock",
        endEventKey: "trip-1--arv-dock",
      },
      vesselLocation: makeVesselLocation({
        AtDock: false,
        InService: true,
        Speed: 12,
        ArrivingDistance: 4.2,
        DepartingDistance: 3.8,
        ArrivingTerminalAbbrev: "VAI",
      }),
      now: at(8, 20),
      getTerminalNameByAbbrev,
    });

    expect(renderState.activeRowIndex).toBe(1);
    expect(renderState.activeIndicator?.rowId).toBe("trip-1--at-sea");
    expect(renderState.activeIndicator?.subtitle).toBe("12 kn · 4.2 mi to VAI");
  });

  it("maps a post-arrival dock interval into the terminal-tail row", () => {
    const renderState = getVesselTimelineRenderState({
      events: makeEventSlice(),
      activeInterval: {
        kind: "at-dock",
        startEventKey: "trip-1--arv-dock",
        endEventKey: null,
      },
      vesselLocation: makeVesselLocation({
        AtDock: true,
        DepartingTerminalAbbrev: "VAI",
      }),
      now: at(9, 0),
      getTerminalNameByAbbrev,
    });

    expect(renderState.activeRowIndex).toBe(2);
    expect(renderState.activeIndicator?.rowId).toBe(
      "trip-1--at-dock--terminal-tail"
    );
    expect(renderState.activeIndicator?.label).toBe("--");
  });
});
