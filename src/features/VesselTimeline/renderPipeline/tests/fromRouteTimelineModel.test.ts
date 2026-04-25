/**
 * Unit tests for the route-model to vessel-timeline adapter.
 */

import { describe, expect, it } from "bun:test";
import type {
  RouteTimelineBoundary,
  RouteTimelineDockVisit,
  RouteTimelineSnapshot,
  RouteTimelineVessel,
} from "convex/functions/routeTimeline";
import {
  deriveRouteTimelineAxisGeometry,
  selectDockVisitVisualSpans,
} from "@/features/RouteTimelineModel";
import type { VesselLocation } from "@/types";
import {
  DEFAULT_VESSEL_TIMELINE_LAYOUT,
  START_OF_DAY_DOCK_VISUAL_CAP_MINUTES,
} from "../../config";
import { fromRouteTimelineModel } from "../fromRouteTimelineModel";

const FIXED_NOW = new Date("2026-04-25T08:20:00.000Z");

/**
 * Build a route timeline boundary fixture.
 *
 * @param params - Boundary fixture params
 * @returns Route timeline boundary fixture
 */
const makeBoundary = (params: {
  key: string;
  segmentKey: string;
  terminalAbbrev: string;
  eventType: "arv-dock" | "dep-dock";
  scheduled?: string;
  predicted?: string;
  actual?: string;
}): RouteTimelineBoundary => ({
  Key: params.key,
  SegmentKey: params.segmentKey,
  TerminalAbbrev: params.terminalAbbrev,
  EventType: params.eventType,
  EventScheduledTime: params.scheduled ? new Date(params.scheduled) : undefined,
  EventPredictedTime: params.predicted ? new Date(params.predicted) : undefined,
  EventOccurred: params.actual ? true : undefined,
  EventActualTime: params.actual ? new Date(params.actual) : undefined,
});

/**
 * Build a route timeline dock visit fixture.
 *
 * @param params - Visit fixture params
 * @returns Route timeline dock visit fixture
 */
const makeVisit = (params: {
  key: string;
  terminalAbbrev: string;
  arrival?: RouteTimelineBoundary;
  departure?: RouteTimelineBoundary;
}): RouteTimelineDockVisit => ({
  Key: params.key,
  VesselAbbrev: "WEN",
  SailingDay: "2026-04-25",
  TerminalAbbrev: params.terminalAbbrev,
  Arrival: params.arrival,
  Departure: params.departure,
});

/**
 * Build a route timeline vessel fixture.
 *
 * @param dockVisits - Ordered vessel dock visits
 * @returns Route timeline vessel fixture
 */
const makeVessel = (
  dockVisits: Array<RouteTimelineDockVisit>
): RouteTimelineVessel => ({
  VesselAbbrev: "WEN",
  DockVisits: dockVisits,
});

/**
 * Build a route timeline snapshot fixture.
 *
 * @param vessels - Ordered vessels
 * @returns Route timeline snapshot fixture
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

/**
 * Resolve full terminal names for adapter tests.
 *
 * @param terminalAbbrev - Terminal abbreviation
 * @returns Display terminal name, or null
 */
const getTerminalNameByAbbrev = (terminalAbbrev: string) =>
  (
    ({
      P52: "Seattle",
      BBI: "Bainbridge Island",
    }) as const
  )[terminalAbbrev] ?? null;

/**
 * Build a vessel-location fixture with optional overrides.
 *
 * @param overrides - Partial vessel-location fields
 * @returns Fully-typed vessel-location fixture
 */
const makeVesselLocation = (
  overrides: Partial<VesselLocation> = {}
): VesselLocation => ({
  VesselID: 1,
  VesselName: "Wenatchee",
  VesselAbbrev: "WEN",
  DepartingTerminalID: 10,
  DepartingTerminalName: "Seattle",
  DepartingTerminalAbbrev: "P52",
  ArrivingTerminalID: 20,
  ArrivingTerminalName: "Bainbridge Island",
  ArrivingTerminalAbbrev: "BBI",
  Latitude: 0,
  Longitude: 0,
  Speed: 15,
  Heading: 0,
  InService: true,
  AtDock: false,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: undefined,
  RouteAbbrev: "sea-bi",
  VesselPositionNum: undefined,
  TimeStamp: FIXED_NOW,
  ScheduleKey: undefined,
  DepartingDistance: undefined,
  ArrivingDistance: undefined,
  ...overrides,
});

describe("fromRouteTimelineModel", () => {
  it("returns empty static render state when snapshot is null", () => {
    const renderState = fromRouteTimelineModel({
      snapshot: null,
      vesselAbbrev: "WEN",
      getTerminalNameByAbbrev,
      now: FIXED_NOW,
    });

    expect(renderState.rows).toEqual([]);
    expect(renderState.rowLayouts).toEqual({});
    expect(renderState.terminalCards).toEqual([]);
    expect(renderState.contentHeightPx).toBe(0);
    expect(renderState.activeRowIndex).toBe(-1);
    expect(renderState.activeIndicator).toBeNull();
  });

  it("returns empty static render state when vessel is missing", () => {
    const snapshot = makeSnapshot([
      {
        VesselAbbrev: "SUQ",
        DockVisits: [],
      },
    ]);
    const renderState = fromRouteTimelineModel({
      snapshot,
      vesselAbbrev: "WEN",
      getTerminalNameByAbbrev,
      now: FIXED_NOW,
    });

    expect(renderState.rows).toEqual([]);
    expect(renderState.rowLayouts).toEqual({});
    expect(renderState.terminalCards).toEqual([]);
    expect(renderState.contentHeightPx).toBe(0);
    expect(renderState.activeRowIndex).toBe(-1);
    expect(renderState.activeIndicator).toBeNull();
  });

  it("maps dock/crossing/dock and terminal-tail spans into renderer rows", () => {
    const visitA = makeVisit({
      key: "visit-a",
      terminalAbbrev: "P52",
      arrival: makeBoundary({
        key: "wen-p52-arr",
        segmentKey: "seg-a",
        terminalAbbrev: "P52",
        eventType: "arv-dock",
        scheduled: "2026-04-25T07:40:00.000Z",
      }),
      departure: makeBoundary({
        key: "wen-p52-dep",
        segmentKey: "seg-a",
        terminalAbbrev: "P52",
        eventType: "dep-dock",
        scheduled: "2026-04-25T08:00:00.000Z",
        predicted: "2026-04-25T08:02:00.000Z",
        actual: "2026-04-25T08:01:00.000Z",
      }),
    });
    const visitB = makeVisit({
      key: "visit-b",
      terminalAbbrev: "BBI",
      arrival: makeBoundary({
        key: "wen-bbi-arr",
        segmentKey: "seg-b",
        terminalAbbrev: "BBI",
        eventType: "arv-dock",
        scheduled: "2026-04-25T08:35:00.000Z",
        predicted: "2026-04-25T08:33:00.000Z",
      }),
      departure: makeBoundary({
        key: "wen-bbi-dep",
        segmentKey: "seg-b",
        terminalAbbrev: "BBI",
        eventType: "dep-dock",
        scheduled: "2026-04-25T08:55:00.000Z",
      }),
    });
    const visitTail = makeVisit({
      key: "visit-tail",
      terminalAbbrev: "P52",
      arrival: makeBoundary({
        key: "wen-p52-arr-tail",
        segmentKey: "seg-tail",
        terminalAbbrev: "P52",
        eventType: "arv-dock",
        scheduled: "2026-04-25T09:30:00.000Z",
      }),
    });
    const snapshot = makeSnapshot([makeVessel([visitA, visitB, visitTail])]);

    const renderState = fromRouteTimelineModel({
      snapshot,
      vesselAbbrev: "WEN",
      getTerminalNameByAbbrev,
      now: new Date("2026-04-25T08:30:00.000Z"),
      vesselLocation: makeVesselLocation({
        DepartingDistance: 4,
        ArrivingDistance: 6,
        Speed: 16,
      }),
    });

    expect(renderState.rows.map((row) => row.kind)).toEqual([
      "at-dock",
      "at-sea",
      "at-dock",
      "at-sea",
      "at-dock",
    ]);
    expect(renderState.rows[1]?.startLabel).toBe("To: BBI");
    expect(renderState.rows[2]?.terminalHeadline).toBe("Bainbridge Is.");
    expect(renderState.rows[4]?.isFinalRow).toBeTrue();
    expect(renderState.activeRowIndex).toBe(1);
    expect(renderState.rows.map((row) => row.markerAppearance)).toEqual([
      "past",
      "past",
      "future",
      "future",
      "future",
    ]);
    expect(renderState.activeIndicator?.label).toBe("3m");
    expect(
      Math.abs((renderState.activeIndicator?.positionPercent ?? 0) - 0.4)
    ).toBeLessThan(1e-5);
    expect(renderState.activeIndicator?.subtitle).toBe("16 kn · 6.0 mi to BBI");
  });

  it("reuses axis geometry heights and y positions for row layout", () => {
    const visits = [
      makeVisit({
        key: "visit-start",
        terminalAbbrev: "P52",
        departure: makeBoundary({
          key: "wen-p52-dep-start",
          segmentKey: "seg-start",
          terminalAbbrev: "P52",
          eventType: "dep-dock",
          scheduled: "2026-04-25T06:00:00.000Z",
        }),
      }),
      makeVisit({
        key: "visit-next",
        terminalAbbrev: "BBI",
        arrival: makeBoundary({
          key: "wen-bbi-arr",
          segmentKey: "seg-next",
          terminalAbbrev: "BBI",
          eventType: "arv-dock",
          scheduled: "2026-04-25T06:40:00.000Z",
        }),
        departure: makeBoundary({
          key: "wen-bbi-dep",
          segmentKey: "seg-next",
          terminalAbbrev: "BBI",
          eventType: "dep-dock",
          scheduled: "2026-04-25T07:00:00.000Z",
        }),
      }),
    ];
    const snapshot = makeSnapshot([makeVessel(visits)]);
    const spans = selectDockVisitVisualSpans(visits);
    const axis = deriveRouteTimelineAxisGeometry(spans, {
      rowHeightBasePx: DEFAULT_VESSEL_TIMELINE_LAYOUT.rowHeightBasePx,
      rowHeightScalePx: DEFAULT_VESSEL_TIMELINE_LAYOUT.rowHeightScalePx,
      rowHeightExponent: DEFAULT_VESSEL_TIMELINE_LAYOUT.rowHeightExponent,
      minSpanHeightPx: DEFAULT_VESSEL_TIMELINE_LAYOUT.minRowHeightPx,
      startOfDayDockVisualCapMinutes: START_OF_DAY_DOCK_VISUAL_CAP_MINUTES,
    });

    const renderState = fromRouteTimelineModel({
      snapshot,
      vesselAbbrev: "WEN",
      getTerminalNameByAbbrev,
      now: FIXED_NOW,
    });

    expect(renderState.rows).toHaveLength(axis.spans.length);
    expect(renderState.contentHeightPx).toBe(axis.contentHeightPx);
    axis.spans.forEach((span, index) => {
      const row = renderState.rows[index];
      if (!row) {
        return;
      }

      expect(row.displayHeightPx).toBe(span.heightPx);
      expect(renderState.rowLayouts[row.id]).toEqual({
        y: span.startY,
        height: span.heightPx,
      });
    });
  });

  it("preserves route-model visual gaps in row layouts", () => {
    const visits = [
      makeVisit({
        key: "visit-arrival-only",
        terminalAbbrev: "FAU",
        arrival: makeBoundary({
          key: "wen-fau-arr",
          segmentKey: "seg-a",
          terminalAbbrev: "FAU",
          eventType: "arv-dock",
          scheduled: "2026-04-25T10:40:00.000Z",
        }),
      }),
      makeVisit({
        key: "visit-departure-only",
        terminalAbbrev: "VAI",
        departure: makeBoundary({
          key: "wen-vai-dep",
          segmentKey: "seg-b",
          terminalAbbrev: "VAI",
          eventType: "dep-dock",
          scheduled: "2026-04-25T11:45:00.000Z",
        }),
      }),
    ];
    const snapshot = makeSnapshot([makeVessel(visits)]);
    const spans = selectDockVisitVisualSpans(visits);
    const axis = deriveRouteTimelineAxisGeometry(spans, {
      rowHeightBasePx: DEFAULT_VESSEL_TIMELINE_LAYOUT.rowHeightBasePx,
      rowHeightScalePx: DEFAULT_VESSEL_TIMELINE_LAYOUT.rowHeightScalePx,
      rowHeightExponent: DEFAULT_VESSEL_TIMELINE_LAYOUT.rowHeightExponent,
      minSpanHeightPx: DEFAULT_VESSEL_TIMELINE_LAYOUT.minRowHeightPx,
      startOfDayDockVisualCapMinutes: START_OF_DAY_DOCK_VISUAL_CAP_MINUTES,
    });

    const renderState = fromRouteTimelineModel({
      snapshot,
      vesselAbbrev: "WEN",
      getTerminalNameByAbbrev,
      now: FIXED_NOW,
    });
    const firstRow = renderState.rows[0];
    const secondRow = renderState.rows[1];

    expect(firstRow).toBeDefined();
    expect(secondRow).toBeDefined();
    expect(axis.spans[1]?.precedingGapDurationMinutes).toBe(65);
    expect(renderState.rowLayouts[secondRow?.id ?? ""]?.y).toBe(
      axis.spans[1]?.startY
    );
    expect(renderState.rowLayouts[secondRow?.id ?? ""]?.y).toBeGreaterThan(
      (renderState.rowLayouts[firstRow?.id ?? ""]?.y ?? 0) +
        (firstRow?.displayHeightPx ?? 0)
    );
  });

  it("preserves scheduled, predicted, and actual event fields", () => {
    const visitA = makeVisit({
      key: "visit-a",
      terminalAbbrev: "P52",
      arrival: makeBoundary({
        key: "wen-p52-arr",
        segmentKey: "seg-a",
        terminalAbbrev: "P52",
        eventType: "arv-dock",
        scheduled: "2026-04-25T07:40:00.000Z",
      }),
      departure: makeBoundary({
        key: "wen-p52-dep",
        segmentKey: "seg-a",
        terminalAbbrev: "P52",
        eventType: "dep-dock",
        scheduled: "2026-04-25T08:00:00.000Z",
        predicted: "2026-04-25T08:02:00.000Z",
        actual: "2026-04-25T08:01:00.000Z",
      }),
    });
    const visitB = makeVisit({
      key: "visit-b",
      terminalAbbrev: "BBI",
      arrival: makeBoundary({
        key: "wen-bbi-arr",
        segmentKey: "seg-b",
        terminalAbbrev: "BBI",
        eventType: "arv-dock",
        scheduled: "2026-04-25T08:35:00.000Z",
        predicted: "2026-04-25T08:33:00.000Z",
      }),
    });
    const snapshot = makeSnapshot([makeVessel([visitA, visitB])]);
    const renderState = fromRouteTimelineModel({
      snapshot,
      vesselAbbrev: "WEN",
      getTerminalNameByAbbrev,
      now: FIXED_NOW,
    });
    const seaRow = renderState.rows[1];

    expect(seaRow?.kind).toBe("at-sea");
    expect(seaRow?.startEvent.timePoint.scheduled?.toISOString()).toBe(
      "2026-04-25T08:00:00.000Z"
    );
    expect(seaRow?.startEvent.timePoint.actual?.toISOString()).toBe(
      "2026-04-25T08:01:00.000Z"
    );
    expect(seaRow?.startEvent.timePoint.estimated?.toISOString()).toBe(
      "2026-04-25T08:02:00.000Z"
    );
    expect(seaRow?.endEvent?.timePoint.estimated?.toISOString()).toBe(
      "2026-04-25T08:33:00.000Z"
    );
  });

  it("produces terminal card geometry compatible with dock and dock+sea pairing", () => {
    const visitA = makeVisit({
      key: "visit-a",
      terminalAbbrev: "P52",
      arrival: makeBoundary({
        key: "wen-p52-arr",
        segmentKey: "seg-a",
        terminalAbbrev: "P52",
        eventType: "arv-dock",
        scheduled: "2026-04-25T07:40:00.000Z",
      }),
      departure: makeBoundary({
        key: "wen-p52-dep",
        segmentKey: "seg-a",
        terminalAbbrev: "P52",
        eventType: "dep-dock",
        scheduled: "2026-04-25T08:00:00.000Z",
      }),
    });
    const visitB = makeVisit({
      key: "visit-b",
      terminalAbbrev: "BBI",
      arrival: makeBoundary({
        key: "wen-bbi-arr",
        segmentKey: "seg-b",
        terminalAbbrev: "BBI",
        eventType: "arv-dock",
        scheduled: "2026-04-25T08:35:00.000Z",
      }),
    });
    const snapshot = makeSnapshot([makeVessel([visitA, visitB])]);
    const renderState = fromRouteTimelineModel({
      snapshot,
      vesselAbbrev: "WEN",
      getTerminalNameByAbbrev,
      now: FIXED_NOW,
    });

    expect(renderState.terminalCards).toHaveLength(2);
    expect(renderState.terminalCards[0]?.id).toBe(renderState.rows[0]?.id);
    expect(renderState.terminalCards[1]?.id).toBe(renderState.rows[2]?.id);
    expect(renderState.terminalCards.map((card) => card.position)).toEqual([
      "single",
      "single",
    ]);
  });

  it("uses opening dock as active row when no occurred boundaries exist", () => {
    const visitA = makeVisit({
      key: "visit-a",
      terminalAbbrev: "P52",
      departure: makeBoundary({
        key: "wen-p52-dep",
        segmentKey: "seg-a",
        terminalAbbrev: "P52",
        eventType: "dep-dock",
        scheduled: "2026-04-25T08:00:00.000Z",
      }),
    });
    const visitB = makeVisit({
      key: "visit-b",
      terminalAbbrev: "BBI",
      arrival: makeBoundary({
        key: "wen-bbi-arr",
        segmentKey: "seg-b",
        terminalAbbrev: "BBI",
        eventType: "arv-dock",
        scheduled: "2026-04-25T08:35:00.000Z",
      }),
    });
    const snapshot = makeSnapshot([makeVessel([visitA, visitB])]);

    const renderState = fromRouteTimelineModel({
      snapshot,
      vesselAbbrev: "WEN",
      getTerminalNameByAbbrev,
      now: new Date("2026-04-25T07:55:00.000Z"),
    });

    expect(renderState.activeRowIndex).toBe(0);
    expect(renderState.rows.map((row) => row.markerAppearance)).toEqual([
      "past",
      "future",
      "future",
    ]);
  });

  it("uses actual arrival to activate destination dock row", () => {
    const visitA = makeVisit({
      key: "visit-a",
      terminalAbbrev: "P52",
      departure: makeBoundary({
        key: "wen-p52-dep",
        segmentKey: "seg-a",
        terminalAbbrev: "P52",
        eventType: "dep-dock",
        scheduled: "2026-04-25T08:00:00.000Z",
        actual: "2026-04-25T08:00:00.000Z",
      }),
    });
    const visitB = makeVisit({
      key: "visit-b",
      terminalAbbrev: "BBI",
      arrival: makeBoundary({
        key: "wen-bbi-arr",
        segmentKey: "seg-b",
        terminalAbbrev: "BBI",
        eventType: "arv-dock",
        scheduled: "2026-04-25T08:35:00.000Z",
        actual: "2026-04-25T08:34:00.000Z",
      }),
      departure: makeBoundary({
        key: "wen-bbi-dep",
        segmentKey: "seg-b",
        terminalAbbrev: "BBI",
        eventType: "dep-dock",
        scheduled: "2026-04-25T08:55:00.000Z",
      }),
    });
    const snapshot = makeSnapshot([makeVessel([visitA, visitB])]);

    const renderState = fromRouteTimelineModel({
      snapshot,
      vesselAbbrev: "WEN",
      getTerminalNameByAbbrev,
      now: new Date("2026-04-25T08:40:00.000Z"),
      vesselLocation: makeVesselLocation({
        AtDock: true,
        Speed: 0,
        DepartingTerminalAbbrev: "BBI",
      }),
    });

    expect(renderState.activeRowIndex).toBe(2);
    expect(
      Math.abs((renderState.activeIndicator?.positionPercent ?? 0) - 0.285714)
    ).toBeLessThan(1e-5);
    expect(renderState.activeIndicator?.subtitle).toBe("At dock BBI");
    expect(renderState.activeIndicator?.animate).toBeFalse();
  });

  it("uses crossing display-time progress when distances are missing", () => {
    const visitA = makeVisit({
      key: "visit-a",
      terminalAbbrev: "P52",
      departure: makeBoundary({
        key: "wen-p52-dep",
        segmentKey: "seg-a",
        terminalAbbrev: "P52",
        eventType: "dep-dock",
        scheduled: "2026-04-25T08:00:00.000Z",
        actual: "2026-04-25T08:00:00.000Z",
      }),
    });
    const visitB = makeVisit({
      key: "visit-b",
      terminalAbbrev: "BBI",
      arrival: makeBoundary({
        key: "wen-bbi-arr",
        segmentKey: "seg-b",
        terminalAbbrev: "BBI",
        eventType: "arv-dock",
        scheduled: "2026-04-25T08:40:00.000Z",
      }),
    });
    const snapshot = makeSnapshot([makeVessel([visitA, visitB])]);

    const renderState = fromRouteTimelineModel({
      snapshot,
      vesselAbbrev: "WEN",
      getTerminalNameByAbbrev,
      now: new Date("2026-04-25T08:20:00.000Z"),
      vesselLocation: makeVesselLocation({
        DepartingDistance: undefined,
        ArrivingDistance: undefined,
      }),
    });

    expect(renderState.activeRowIndex).toBe(1);
    expect(
      Math.abs((renderState.activeIndicator?.positionPercent ?? 0) - 0.5)
    ).toBeLessThan(1e-5);
  });

  it("centers dock indicator when start display time is in the future", () => {
    const visitA = makeVisit({
      key: "visit-a",
      terminalAbbrev: "P52",
      arrival: makeBoundary({
        key: "wen-p52-arr",
        segmentKey: "seg-a",
        terminalAbbrev: "P52",
        eventType: "arv-dock",
        scheduled: "2026-04-25T09:00:00.000Z",
        actual: "2026-04-25T09:00:00.000Z",
      }),
      departure: makeBoundary({
        key: "wen-p52-dep",
        segmentKey: "seg-a",
        terminalAbbrev: "P52",
        eventType: "dep-dock",
        scheduled: "2026-04-25T09:30:00.000Z",
      }),
    });
    const snapshot = makeSnapshot([makeVessel([visitA])]);

    const renderState = fromRouteTimelineModel({
      snapshot,
      vesselAbbrev: "WEN",
      getTerminalNameByAbbrev,
      now: new Date("2026-04-25T08:20:00.000Z"),
      vesselLocation: makeVesselLocation({
        DepartingTerminalAbbrev: "P52",
      }),
    });

    expect(renderState.activeRowIndex).toBe(0);
    expect(renderState.activeIndicator?.positionPercent).toBe(0.5);
  });

  it("uses terminal-tail indicator position and label policy", () => {
    const visitA = makeVisit({
      key: "visit-a",
      terminalAbbrev: "P52",
      departure: makeBoundary({
        key: "wen-p52-dep",
        segmentKey: "seg-a",
        terminalAbbrev: "P52",
        eventType: "dep-dock",
        scheduled: "2026-04-25T08:00:00.000Z",
      }),
    });
    const visitB = makeVisit({
      key: "visit-b",
      terminalAbbrev: "BBI",
      arrival: makeBoundary({
        key: "wen-bbi-arr",
        segmentKey: "seg-b",
        terminalAbbrev: "BBI",
        eventType: "arv-dock",
        scheduled: "2026-04-25T08:35:00.000Z",
        actual: "2026-04-25T08:35:00.000Z",
      }),
    });
    const snapshot = makeSnapshot([makeVessel([visitA, visitB])]);

    const renderState = fromRouteTimelineModel({
      snapshot,
      vesselAbbrev: "WEN",
      getTerminalNameByAbbrev,
      now: new Date("2026-04-25T09:00:00.000Z"),
      vesselLocation: makeVesselLocation({
        DepartingTerminalAbbrev: "BBI",
      }),
    });

    expect(renderState.activeRowIndex).toBe(2);
    expect(renderState.activeIndicator?.positionPercent).toBe(0);
    expect(renderState.activeIndicator?.label).toBe("--");
  });

  it("uses eased progress for start-of-day dock spans", () => {
    const visitA = makeVisit({
      key: "visit-a",
      terminalAbbrev: "P52",
      departure: makeBoundary({
        key: "wen-p52-dep",
        segmentKey: "seg-a",
        terminalAbbrev: "P52",
        eventType: "dep-dock",
        scheduled: "2026-04-25T08:00:00.000Z",
      }),
    });
    const visitB = makeVisit({
      key: "visit-b",
      terminalAbbrev: "BBI",
      arrival: makeBoundary({
        key: "wen-bbi-arr",
        segmentKey: "seg-b",
        terminalAbbrev: "BBI",
        eventType: "arv-dock",
        scheduled: "2026-04-25T08:40:00.000Z",
      }),
    });
    const snapshot = makeSnapshot([makeVessel([visitA, visitB])]);

    const renderState = fromRouteTimelineModel({
      snapshot,
      vesselAbbrev: "WEN",
      getTerminalNameByAbbrev,
      now: new Date("2026-04-25T07:50:00.000Z"),
      vesselLocation: makeVesselLocation({
        AtDock: true,
        DepartingTerminalAbbrev: "P52",
      }),
    });

    expect(renderState.activeRowIndex).toBe(0);
    expect(renderState.activeIndicator?.positionPercent).toBe(0);
  });
});
