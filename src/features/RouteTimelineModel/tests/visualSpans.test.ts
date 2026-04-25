/**
 * Unit tests for pure dock-visit visual span derivation.
 */

import { describe, expect, it } from "bun:test";
import type {
  RouteTimelineBoundary,
  RouteTimelineDockVisit,
} from "convex/functions/routeTimeline";
import { selectDockVisitVisualSpans } from "../visualSpans";

/**
 * Build a route timeline boundary fixture with all time channels aligned.
 *
 * @param key - Stable boundary key
 * @param eventType - Dock event type
 * @param terminalAbbrev - Terminal abbreviation
 * @param isoTime - Optional ISO instant
 * @returns Route timeline boundary fixture
 */
const makeBoundary = (
  key: string,
  eventType: "arv-dock" | "dep-dock",
  terminalAbbrev: string,
  isoTime?: string
): RouteTimelineBoundary => {
  const eventTime = isoTime ? new Date(isoTime) : undefined;

  return {
    Key: key,
    SegmentKey: `${key}-segment`,
    TerminalAbbrev: terminalAbbrev,
    EventType: eventType,
    EventScheduledTime: eventTime,
    EventPredictedTime: eventTime,
    EventOccurred: eventTime ? true : undefined,
    EventActualTime: eventTime,
  };
};

/**
 * Build a dock visit fixture.
 *
 * @param params - Fixture fields
 * @returns Route timeline dock visit fixture
 */
const makeVisit = (params: {
  key: string;
  vesselAbbrev: string;
  terminalAbbrev: string;
  arrival?: RouteTimelineBoundary;
  departure?: RouteTimelineBoundary;
}): RouteTimelineDockVisit => ({
  Key: params.key,
  VesselAbbrev: params.vesselAbbrev,
  SailingDay: "2026-04-25",
  TerminalAbbrev: params.terminalAbbrev,
  Arrival: params.arrival,
  Departure: params.departure,
});

describe("RouteTimelineModel visual spans", () => {
  it("returns empty spans for empty visit input", () => {
    expect(selectDockVisitVisualSpans([])).toEqual([]);
  });

  it("derives dock-crossing-dock ordering for adjacent A to B visits", () => {
    const visitA = makeVisit({
      key: "visit-a",
      vesselAbbrev: "WEN",
      terminalAbbrev: "P52",
      arrival: makeBoundary(
        "wen-p52-arr",
        "arv-dock",
        "P52",
        "2026-04-25T07:40:00.000Z"
      ),
      departure: makeBoundary(
        "wen-p52-dep",
        "dep-dock",
        "P52",
        "2026-04-25T08:00:00.000Z"
      ),
    });
    const visitB = makeVisit({
      key: "visit-b",
      vesselAbbrev: "WEN",
      terminalAbbrev: "BBI",
      arrival: makeBoundary(
        "wen-bbi-arr",
        "arv-dock",
        "BBI",
        "2026-04-25T08:35:00.000Z"
      ),
      departure: makeBoundary(
        "wen-bbi-dep",
        "dep-dock",
        "BBI",
        "2026-04-25T08:55:00.000Z"
      ),
    });

    const spans = selectDockVisitVisualSpans([visitA, visitB]);
    expect(spans.map((span) => span.kind)).toEqual([
      "at-dock",
      "crossing",
      "at-dock",
    ]);
    expect(spans.map((span) => span.edge)).toEqual([
      "normal",
      "normal",
      "normal",
    ]);
  });

  it("marks missing-first-arrival dock span as start-of-day", () => {
    const startVisit = makeVisit({
      key: "visit-start",
      vesselAbbrev: "WEN",
      terminalAbbrev: "P52",
      departure: makeBoundary(
        "wen-p52-dep-start",
        "dep-dock",
        "P52",
        "2026-04-25T06:00:00.000Z"
      ),
    });

    const spans = selectDockVisitVisualSpans([startVisit]);
    expect(spans).toHaveLength(1);
    expect(spans[0]?.kind).toBe("at-dock");
    expect(spans[0]?.edge).toBe("start-of-day");
  });

  it("marks missing-final-departure dock span as terminal-tail", () => {
    const finalVisit = makeVisit({
      key: "visit-tail",
      vesselAbbrev: "WEN",
      terminalAbbrev: "BBI",
      arrival: makeBoundary(
        "wen-bbi-arr-tail",
        "arv-dock",
        "BBI",
        "2026-04-25T23:30:00.000Z"
      ),
    });

    const spans = selectDockVisitVisualSpans([finalVisit]);
    expect(spans).toHaveLength(1);
    expect(spans[0]?.kind).toBe("at-dock");
    expect(spans[0]?.edge).toBe("terminal-tail");
  });

  it("derives crossing only from current departure and next arrival", () => {
    const visitA = makeVisit({
      key: "visit-a",
      vesselAbbrev: "WEN",
      terminalAbbrev: "P52",
      arrival: makeBoundary("arr-a", "arv-dock", "P52"),
      departure: makeBoundary("dep-a", "dep-dock", "P52"),
    });
    const visitBMissingArrival = makeVisit({
      key: "visit-b",
      vesselAbbrev: "WEN",
      terminalAbbrev: "BBI",
      departure: makeBoundary("dep-b", "dep-dock", "BBI"),
    });

    const spans = selectDockVisitVisualSpans([visitA, visitBMissingArrival]);
    expect(spans.filter((span) => span.kind === "crossing")).toHaveLength(0);
  });
});
