/**
 * Tests for scheduled and actual dock-event reload assembly.
 */

import { describe, expect, it } from "bun:test";
import { computeDockEventsReload } from "domain/events/reload";
import type { WsfScheduledSegment } from "domain/events/reload/schemas/validateReloadInput";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import { buildSegmentKey } from "shared/keys";

const at = (hours: number, minutes: number): number =>
  Date.UTC(2026, 2, 25, hours, minutes);

const vessels: VesselIdentity[] = [
  {
    VesselID: 1,
    VesselName: "Wenatchee",
    VesselAbbrev: "WEN",
  },
];

const terminals: TerminalIdentity[] = [
  {
    TerminalID: 1,
    TerminalName: "Seattle",
    TerminalAbbrev: "P52",
  },
  {
    TerminalID: 2,
    TerminalName: "Bainbridge Island",
    TerminalAbbrev: "BBI",
  },
];

describe("reload dock sailing day rows from schedule and history", () => {
  it("hydrates history actuals and keeps physical-only evidence", () => {
    const departure = at(12, 20);
    const arrival = at(12, 55);
    const segmentKey = buildSegmentKey(
      "WEN",
      "P52",
      "BBI",
      new Date(departure)
    );

    if (segmentKey === undefined) {
      throw new Error("Expected fixture segment key.");
    }

    const scheduleSegments = [scheduleSegment({ departure, arrival })];
    const historyRecords = [
      {
        VesselId: 1,
        Vessel: "Wenatchee",
        Departing: "Seattle",
        Arriving: "Bainbridge Island",
        ScheduledDepart: departure,
        ActualDepart: at(12, 24),
        EstArrival: at(13, 0),
      },
    ];
    const result = computeDockEventsReload({
      sailingDay: "2026-03-25",
      scheduleSegments,
      historyRecords,
      vessels,
      terminals,
      updatedAt: 42,
      vesselLocations: [],
      activeTrips: [],
      completedTrips: [
        {
          TripKey: "trip-scheduled",
          ScheduleKey: segmentKey,
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: departure,
        },
        {
          TripKey: "trip-physical",
          ScheduleKey: undefined,
          VesselAbbrev: "WEN",
          SailingDay: "2026-03-25",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: at(14, 0),
          LeftDockActual: at(14, 5),
          TripEnd: at(14, 40),
        },
      ],
    });

    expect(result.actualRows).toHaveLength(4);
    expect(result.physicalOnlyTripKeysToPreserve).toEqual(
      new Set(["trip-physical"])
    );
    expect(
      result.actualRows.map((row) => [
        row.EventKey,
        row.EventType,
        row.EventActualTime,
      ])
    ).toEqual([
      ["trip-scheduled--dep-dock", "dep-dock", at(12, 24)],
      ["trip-scheduled--arv-dock", "arv-dock", at(13, 0)],
      ["trip-physical--dep-dock", "dep-dock", at(14, 5)],
      ["trip-physical--arv-dock", "arv-dock", at(14, 40)],
    ]);
  });
});

const scheduleSegment = ({
  departure,
  arrival,
}: {
  departure: number;
  arrival: number;
}): WsfScheduledSegment => ({
  VesselName: "Wenatchee",
  DepartingTerminalID: 1,
  ArrivingTerminalID: 2,
  DepartingTerminalName: "Seattle",
  ArrivingTerminalName: "Bainbridge Island",
  DepartingTime: departure,
  ArrivingTime: arrival,
  SailingNotes: "",
  Annotations: [],
  RouteID: 3,
  RouteAbbrev: "sea-bi",
  SailingDay: "2026-03-25",
});
