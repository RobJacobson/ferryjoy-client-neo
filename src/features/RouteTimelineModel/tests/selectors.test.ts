/**
 * Unit tests for pure route timeline domain selectors.
 */

import { describe, expect, it } from "bun:test";
import type {
  RouteTimelineBoundary,
  RouteTimelineDockVisit,
  RouteTimelineSnapshot,
  RouteTimelineVessel,
} from "convex/functions/routeTimeline";
import {
  selectJourneyDockVisits,
  selectRouteTimelineVessels,
  selectTripDockVisits,
  selectVesselDockVisits,
} from "../selectors";

/**
 * Build a route timeline boundary fixture.
 *
 * @param key - Stable boundary key
 * @param eventType - Dock event type
 * @param terminalAbbrev - Terminal abbreviation
 * @returns Boundary fixture with minimal required fields
 */
const makeBoundary = (
  key: string,
  eventType: "arv-dock" | "dep-dock",
  terminalAbbrev: string
): RouteTimelineBoundary => ({
  Key: key,
  SegmentKey: `${key}-segment`,
  TerminalAbbrev: terminalAbbrev,
  EventType: eventType,
  EventScheduledTime: undefined,
  EventPredictedTime: undefined,
  EventOccurred: undefined,
  EventActualTime: undefined,
});

/**
 * Build a dock visit fixture.
 *
 * @param params - Fixture fields
 * @param params.key - Visit key
 * @param params.vesselAbbrev - Vessel abbreviation
 * @param params.terminalAbbrev - Terminal abbreviation
 * @param params.arrivalKey - Optional arrival boundary key
 * @param params.departureKey - Optional departure boundary key
 * @returns Dock visit fixture
 */
const makeVisit = ({
  key,
  vesselAbbrev,
  terminalAbbrev,
  arrivalKey,
  departureKey,
}: {
  key: string;
  vesselAbbrev: string;
  terminalAbbrev: string;
  arrivalKey?: string;
  departureKey?: string;
}): RouteTimelineDockVisit => ({
  Key: key,
  VesselAbbrev: vesselAbbrev,
  SailingDay: "2026-04-25",
  TerminalAbbrev: terminalAbbrev,
  Arrival: arrivalKey
    ? makeBoundary(arrivalKey, "arv-dock", terminalAbbrev)
    : undefined,
  Departure: departureKey
    ? makeBoundary(departureKey, "dep-dock", terminalAbbrev)
    : undefined,
});

/**
 * Build a vessel fixture.
 *
 * @param vesselAbbrev - Vessel abbreviation
 * @param dockVisits - Ordered dock visits
 * @returns Vessel fixture
 */
const makeVessel = (
  vesselAbbrev: string,
  dockVisits: Array<RouteTimelineDockVisit>
): RouteTimelineVessel => ({
  VesselAbbrev: vesselAbbrev,
  DockVisits: dockVisits,
});

/**
 * Build a route timeline snapshot fixture.
 *
 * @param vessels - Ordered vessel fixtures
 * @returns Snapshot fixture
 */
const makeSnapshot = (
  vessels: Array<RouteTimelineVessel>
): RouteTimelineSnapshot => ({
  RouteAbbrev: "sea-bi",
  SailingDay: "2026-04-25",
  Scope: {
    VesselAbbrev: undefined,
    WindowStart: undefined,
    WindowEnd: undefined,
    IsPartial: false,
  },
  Vessels: vessels,
});

describe("RouteTimelineModel selectors", () => {
  const vesselAVisits: Array<RouteTimelineDockVisit> = [
    makeVisit({
      key: "visit-a-1",
      vesselAbbrev: "WEN",
      terminalAbbrev: "P52",
      arrivalKey: "wen-p52-arr-1",
      departureKey: "wen-p52-dep-1",
    }),
    makeVisit({
      key: "visit-a-2",
      vesselAbbrev: "WEN",
      terminalAbbrev: "BBI",
      arrivalKey: "wen-bbi-arr-1",
      departureKey: "wen-bbi-dep-1",
    }),
    makeVisit({
      key: "visit-a-3",
      vesselAbbrev: "WEN",
      terminalAbbrev: "P52",
      arrivalKey: "wen-p52-arr-2",
      departureKey: "wen-p52-dep-2",
    }),
  ];

  const vesselBVisits: Array<RouteTimelineDockVisit> = [
    makeVisit({
      key: "visit-b-1",
      vesselAbbrev: "SUQ",
      terminalAbbrev: "FAU",
      arrivalKey: "suq-fau-arr-1",
      departureKey: "suq-fau-dep-1",
    }),
  ];

  const snapshot = makeSnapshot([
    makeVessel("WEN", vesselAVisits),
    makeVessel("SUQ", vesselBVisits),
  ]);

  it("returns empty arrays for null snapshot inputs", () => {
    expect(selectRouteTimelineVessels(null)).toEqual([]);
    expect(selectVesselDockVisits(null, "WEN")).toEqual([]);
    expect(
      selectTripDockVisits(null, {
        vesselAbbrev: "WEN",
        fromDepartureBoundaryKey: "wen-p52-dep-1",
        toArrivalBoundaryKey: "wen-bbi-arr-1",
      })
    ).toEqual([]);
    expect(
      selectJourneyDockVisits(null, {
        vesselAbbrev: "WEN",
        startVisitKey: "visit-a-1",
        endVisitKey: "visit-a-2",
      })
    ).toEqual([]);
  });

  it("preserves snapshot vessel order", () => {
    expect(
      selectRouteTimelineVessels(snapshot).map((vessel) => vessel.VesselAbbrev)
    ).toEqual(["WEN", "SUQ"]);
  });

  it("returns one vessel's dock visits in source order", () => {
    expect(
      selectVesselDockVisits(snapshot, "WEN").map((visit) => visit.Key)
    ).toEqual(["visit-a-1", "visit-a-2", "visit-a-3"]);
  });

  it("returns empty array when the vessel is missing", () => {
    expect(selectVesselDockVisits(snapshot, "TAC")).toEqual([]);
  });

  it("returns adjacent A to B visits for a keyed departure-arrival pair", () => {
    const tripVisits = selectTripDockVisits(snapshot, {
      vesselAbbrev: "WEN",
      fromDepartureBoundaryKey: "wen-p52-dep-1",
      toArrivalBoundaryKey: "wen-bbi-arr-1",
    });

    expect(tripVisits.map((visit) => visit.Key)).toEqual([
      "visit-a-1",
      "visit-a-2",
    ]);
  });

  it("rejects mismatched or non-adjacent keyed trip matches", () => {
    expect(
      selectTripDockVisits(snapshot, {
        vesselAbbrev: "WEN",
        fromDepartureBoundaryKey: "wen-p52-dep-1",
        toArrivalBoundaryKey: "wen-p52-arr-2",
      })
    ).toEqual([]);
  });

  it("returns a contiguous inclusive journey slice", () => {
    const journeyVisits = selectJourneyDockVisits(snapshot, {
      vesselAbbrev: "WEN",
      startVisitKey: "visit-a-1",
      endVisitKey: "visit-a-3",
    });

    expect(journeyVisits.map((visit) => visit.Key)).toEqual([
      "visit-a-1",
      "visit-a-2",
      "visit-a-3",
    ]);
  });

  it("returns empty journey slices for invalid ranges or missing keys", () => {
    expect(
      selectJourneyDockVisits(snapshot, {
        vesselAbbrev: "WEN",
        startVisitKey: "visit-a-3",
        endVisitKey: "visit-a-1",
      })
    ).toEqual([]);
    expect(
      selectJourneyDockVisits(snapshot, {
        vesselAbbrev: "WEN",
        startVisitKey: "visit-a-1",
        endVisitKey: "missing-visit",
      })
    ).toEqual([]);
  });

  it("avoids terminal-only ambiguity by matching unique keys", () => {
    const secondP52Trip = selectTripDockVisits(snapshot, {
      vesselAbbrev: "WEN",
      fromDepartureBoundaryKey: "wen-bbi-dep-1",
      toArrivalBoundaryKey: "wen-p52-arr-2",
    });

    expect(secondP52Trip.map((visit) => visit.Key)).toEqual([
      "visit-a-2",
      "visit-a-3",
    ]);
  });
});
