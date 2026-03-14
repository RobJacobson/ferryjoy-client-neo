// @ts-nocheck
import { describe, expect, it } from "bun:test";
import type { VesselTimelineTrip } from "@/data/contexts";
import type { VesselTimelineLayoutConfig } from "../../types";
import type { TripBoundaryData } from "./boundaries";
import { renderRows } from "./renderRows";
import { getRows } from "./rows";

const layout: VesselTimelineLayoutConfig = {
  pixelsPerMinute: 6,
  minRowHeightPx: 64,
  compressedBreakThresholdMinutes: 60,
  compressedBreakMarkerHeightPx: 20,
  compressedBreakStubMinutes: 10,
  compressedBreakDepartureWindowMinutes: 50,
  initialAutoScroll: "none",
  initialScrollAnchorPercent: 0.5,
};

const at = (hours: number, minutes: number) =>
  new Date(Date.UTC(2026, 2, 13, hours, minutes));

describe("VesselTimeline row geometry", () => {
  it("uses the previous sea arrival as the next dock row start", () => {
    const trips = [
      makeTrip("trip-1"),
      makeTrip("trip-2", {
        scheduledArriveCurr: at(20, 45),
        tripStart: at(20, 46),
      }),
    ];
    const boundaryData: TripBoundaryData[] = [
      makeBoundaries("trip-1", {
        arriveCurr: at(20, 0),
        departCurr: at(20, 5),
        arriveNext: at(20, 25),
      }),
      makeBoundaries("trip-2", {
        arriveCurr: at(20, 45),
        departCurr: at(20, 30),
        arriveNext: at(20, 50),
      }),
    ];

    const rows = getRows(trips, boundaryData, layout);
    const dockRow = rows.find((row) => row.id === "trip-2-dock");

    expect(dockRow?.startBoundary.timePoint.scheduled?.toISOString()).toBe(
      at(20, 25).toISOString()
    );
    expect(dockRow?.actualDurationMinutes).toBe(5);
  });

  it("labels rows with their start boundary event", () => {
    const rows = renderRows(
      {
        rows: [
          {
            id: "dock",
            segmentIndex: 0,
            kind: "dock",
            startBoundary: makeBoundary("VSH", at(20, 25)),
            endBoundary: makeBoundary("VSH", at(20, 30)),
            actualDurationMinutes: 5,
            displayDurationMinutes: 5,
            displayMode: "proportional",
          },
          {
            id: "sea",
            segmentIndex: 1,
            kind: "sea",
            startBoundary: makeBoundary("VSH", at(20, 30)),
            endBoundary: makeBoundary("SWV", at(20, 40)),
            actualDurationMinutes: 10,
            displayDurationMinutes: 10,
            displayMode: "proportional",
          },
        ],
        activeSegmentIndex: 0,
        indicatorState: "active",
      },
      layout
    );

    expect(rows[0]?.startBoundary.label).toBe("Arv");
    expect(rows[0]?.startBoundary.timePoint.scheduled?.toISOString()).toBe(
      at(20, 25).toISOString()
    );
    expect(rows[1]?.startBoundary.label).toBe("Dep");
    expect(rows[1]?.startBoundary.timePoint.scheduled?.toISOString()).toBe(
      at(20, 30).toISOString()
    );
  });

  it("adds a terminal arrival row for the final trip endpoint", () => {
    const trips = [makeTrip("trip-1")];
    const boundaryData: TripBoundaryData[] = [
      makeBoundaries("trip-1", {
        arriveCurr: at(20, 0),
        departCurr: at(20, 50),
        arriveNext: at(21, 47),
      }),
    ];

    const rows = getRows(trips, boundaryData, layout);
    const terminalRow = rows[rows.length - 1];

    expect(terminalRow?.id).toBe("trip-1-terminal");
    expect(terminalRow?.isTerminal).toBe(true);
    expect(terminalRow?.startBoundary.terminalAbbrev).toBe("SWV");
    expect(terminalRow?.startBoundary.timePoint.scheduled?.toISOString()).toBe(
      at(21, 47).toISOString()
    );
  });
});

const makeTrip = (
  key: string,
  overrides: Partial<VesselTimelineTrip> = {}
): VesselTimelineTrip => ({
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
  ...overrides,
});

const makeBoundary = (terminalAbbrev: string, scheduled: Date) => ({
  terminalAbbrev,
  timePoint: { scheduled },
});

const makeBoundaries = (
  key: string,
  times: {
    arriveCurr: Date;
    departCurr: Date;
    arriveNext: Date;
  }
): TripBoundaryData => ({
  key,
  departingTerminalAbbrev: "VSH",
  arrivingTerminalAbbrev: "SWV",
  arriveCurr: makeBoundary("VSH", times.arriveCurr),
  departCurr: makeBoundary("VSH", times.departCurr),
  arriveNext: makeBoundary("SWV", times.arriveNext),
  departNext: makeBoundary("SWV", at(21, 0)),
});
