/**
 * Unit tests for pure route timeline axis geometry derivation.
 */

import { describe, expect, it } from "bun:test";
import type { RouteTimelineBoundary } from "convex/functions/routeTimeline";
import {
  DEFAULT_ROUTE_TIMELINE_AXIS_GEOMETRY_CONFIG,
  deriveRouteTimelineAxisGeometry,
  getDisplayTime,
  getLayoutTime,
} from "../axisGeometry";
import type { RouteTimelineVisualSpan } from "../visualSpans";

/**
 * Build a route timeline boundary fixture.
 *
 * @param params - Boundary fixture params
 * @returns Route timeline boundary fixture
 */
const makeBoundary = (params: {
  key: string;
  terminalAbbrev: string;
  scheduled?: string;
  predicted?: string;
  actual?: string;
}): RouteTimelineBoundary => ({
  Key: params.key,
  SegmentKey: `${params.key}-segment`,
  TerminalAbbrev: params.terminalAbbrev,
  EventType: params.key.includes("arr") ? "arv-dock" : "dep-dock",
  EventScheduledTime: params.scheduled ? new Date(params.scheduled) : undefined,
  EventPredictedTime: params.predicted ? new Date(params.predicted) : undefined,
  EventOccurred: params.actual ? true : undefined,
  EventActualTime: params.actual ? new Date(params.actual) : undefined,
});

/**
 * Build a visual span fixture.
 *
 * @param params - Visual span fixture params
 * @returns Route timeline visual span fixture
 */
const makeSpan = (params: {
  id: string;
  kind: "at-dock" | "crossing";
  edge?: "normal" | "start-of-day" | "terminal-tail";
  startBoundary?: RouteTimelineBoundary;
  endBoundary?: RouteTimelineBoundary;
}): RouteTimelineVisualSpan => ({
  id: params.id,
  kind: params.kind,
  edge: params.edge ?? "normal",
  fromVisitKey: undefined,
  toVisitKey: undefined,
  startBoundary: params.startBoundary,
  endBoundary: params.endBoundary,
});

describe("RouteTimelineModel axis geometry", () => {
  it("computes content height as the sum of span heights", () => {
    const spanA = makeSpan({
      id: "dock-a",
      kind: "at-dock",
      startBoundary: makeBoundary({
        key: "arr-a",
        terminalAbbrev: "P52",
        scheduled: "2026-04-25T08:00:00.000Z",
      }),
      endBoundary: makeBoundary({
        key: "dep-a",
        terminalAbbrev: "P52",
        scheduled: "2026-04-25T08:20:00.000Z",
      }),
    });
    const spanB = makeSpan({
      id: "sea-a-b",
      kind: "crossing",
      startBoundary: makeBoundary({
        key: "dep-a",
        terminalAbbrev: "P52",
        scheduled: "2026-04-25T08:20:00.000Z",
      }),
      endBoundary: makeBoundary({
        key: "arr-b",
        terminalAbbrev: "BBI",
        scheduled: "2026-04-25T08:50:00.000Z",
      }),
    });

    const geometry = deriveRouteTimelineAxisGeometry([spanA, spanB]);
    const sumHeights = geometry.spans.reduce(
      (sum, span) => sum + span.heightPx,
      0
    );
    expect(Math.abs(geometry.contentHeightPx - sumHeights)).toBeLessThan(1e-8);
  });

  it("applies minimum height for zero/invalid durations", () => {
    const zeroDurationSpan = makeSpan({
      id: "invalid",
      kind: "crossing",
      startBoundary: makeBoundary({
        key: "dep-a",
        terminalAbbrev: "P52",
        scheduled: "2026-04-25T09:00:00.000Z",
      }),
      endBoundary: makeBoundary({
        key: "arr-b",
        terminalAbbrev: "BBI",
        scheduled: "2026-04-25T08:00:00.000Z",
      }),
    });

    const geometry = deriveRouteTimelineAxisGeometry([zeroDurationSpan]);
    expect(geometry.spans[0]?.heightPx).toBe(
      DEFAULT_ROUTE_TIMELINE_AXIS_GEOMETRY_CONFIG.minSpanHeightPx
    );
    expect(geometry.spans[0]?.layoutDurationMinutes).toBe(0);
  });

  it("applies exponent-based compression for nontrivial durations", () => {
    const span = makeSpan({
      id: "long",
      kind: "crossing",
      startBoundary: makeBoundary({
        key: "dep-a",
        terminalAbbrev: "P52",
        scheduled: "2026-04-25T08:00:00.000Z",
      }),
      endBoundary: makeBoundary({
        key: "arr-b",
        terminalAbbrev: "BBI",
        scheduled: "2026-04-25T09:00:00.000Z",
      }),
    });

    const geometry = deriveRouteTimelineAxisGeometry([span]);
    const computed = geometry.spans[0];
    const expectedHeight =
      DEFAULT_ROUTE_TIMELINE_AXIS_GEOMETRY_CONFIG.rowHeightScalePx *
      60 ** DEFAULT_ROUTE_TIMELINE_AXIS_GEOMETRY_CONFIG.rowHeightExponent;

    expect(Math.abs((computed?.heightPx ?? 0) - expectedHeight)).toBeLessThan(
      1e-8
    );
    expect(computed?.heightPx).toBeLessThan(
      DEFAULT_ROUTE_TIMELINE_AXIS_GEOMETRY_CONFIG.rowHeightScalePx * 60
    );
  });

  it("caps start-of-day at-dock visual duration before compression", () => {
    const span = makeSpan({
      id: "start-cap",
      kind: "at-dock",
      edge: "start-of-day",
      startBoundary: makeBoundary({
        key: "arr-start",
        terminalAbbrev: "P52",
        scheduled: "2026-04-25T00:00:00.000Z",
      }),
      endBoundary: makeBoundary({
        key: "dep-start",
        terminalAbbrev: "P52",
        scheduled: "2026-04-25T03:00:00.000Z",
      }),
    });

    const geometry = deriveRouteTimelineAxisGeometry([span]);
    expect(geometry.spans[0]?.layoutDurationMinutes).toBe(180);
    expect(geometry.spans[0]?.visualDurationMinutes).toBe(
      DEFAULT_ROUTE_TIMELINE_AXIS_GEOMETRY_CONFIG.startOfDayDockVisualCapMinutes
    );
  });

  it("uses schedule-first precedence for layout duration calculations", () => {
    const span = makeSpan({
      id: "precedence-layout",
      kind: "crossing",
      startBoundary: makeBoundary({
        key: "dep-a",
        terminalAbbrev: "P52",
        scheduled: "2026-04-25T10:00:00.000Z",
        actual: "2026-04-25T10:10:00.000Z",
      }),
      endBoundary: makeBoundary({
        key: "arr-b",
        terminalAbbrev: "BBI",
        scheduled: "2026-04-25T10:30:00.000Z",
        actual: "2026-04-25T10:40:00.000Z",
      }),
    });

    const geometry = deriveRouteTimelineAxisGeometry([span]);
    expect(geometry.spans[0]?.layoutDurationMinutes).toBe(30);
  });

  it("uses actual then predicted then scheduled precedence for display time", () => {
    const boundaryWithActual = makeBoundary({
      key: "dep-a",
      terminalAbbrev: "P52",
      scheduled: "2026-04-25T10:00:00.000Z",
      predicted: "2026-04-25T10:03:00.000Z",
      actual: "2026-04-25T10:05:00.000Z",
    });
    const boundaryWithPredictedOnly = makeBoundary({
      key: "dep-b",
      terminalAbbrev: "P52",
      scheduled: "2026-04-25T11:00:00.000Z",
      predicted: "2026-04-25T11:02:00.000Z",
    });

    expect(getDisplayTime(boundaryWithActual)?.toISOString()).toBe(
      "2026-04-25T10:05:00.000Z"
    );
    expect(getDisplayTime(boundaryWithPredictedOnly)?.toISOString()).toBe(
      "2026-04-25T11:02:00.000Z"
    );
    expect(getLayoutTime(boundaryWithActual)?.toISOString()).toBe(
      "2026-04-25T10:00:00.000Z"
    );
  });

  it("degrades missing boundary times to zero-duration and minimum height", () => {
    const span = makeSpan({
      id: "missing-times",
      kind: "at-dock",
      startBoundary: makeBoundary({
        key: "arr-a",
        terminalAbbrev: "P52",
      }),
      endBoundary: makeBoundary({
        key: "dep-a",
        terminalAbbrev: "P52",
      }),
    });

    const geometry = deriveRouteTimelineAxisGeometry([span]);
    expect(geometry.spans[0]?.layoutDurationMinutes).toBe(0);
    expect(geometry.spans[0]?.displayDurationMinutes).toBe(0);
    expect(geometry.spans[0]?.heightPx).toBe(
      DEFAULT_ROUTE_TIMELINE_AXIS_GEOMETRY_CONFIG.minSpanHeightPx
    );
  });
});
