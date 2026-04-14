/**
 * Tests building sparse actual-boundary patches for one sailing day from loaded
 * rows and live locations.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexScheduledTrip } from "../../../functions/scheduledTrips/schemas";
import type { ConvexVesselLocation } from "../../../functions/vesselLocation/schemas";
import { generateTripKey } from "../../../shared/physicalTripIdentity";
import { buildActualBoundaryPatchesForSailingDay } from "../events/reconcile";
import { buildSeedVesselTripEvents } from "../events/seed";
import {
  buildActualBoundaryEvents,
  buildScheduledBoundaryEvents,
} from "../normalizedEvents";
import type { TripContextForActualRow } from "../tripContextForActualRows";

const at = (hours: number, minutes: number) =>
  Date.UTC(2026, 2, 13, hours + 7, minutes);

/**
 * Builds a segment-key → trip context map for seed events (unique TripKey per
 * segment) so PR3 patches and hydrated actuals resolve `TripKey`.
 *
 * @param events - Seed boundary events
 * @returns Map for `buildActualBoundaryEvents` / `tripBySegmentKey`
 */
const tripIndexFromSeedEvents = (
  events: { SegmentKey: string }[]
): Map<string, TripContextForActualRow> => {
  const map = new Map<string, TripContextForActualRow>();
  const segments = [...new Set(events.map((e) => e.SegmentKey))];

  for (const [i, seg] of segments.entries()) {
    map.set(seg, {
      TripKey: generateTripKey("TOK", Date.UTC(2026, 2, 13, 8 + i, 35)),
      ScheduleKey: seg,
    });
  }

  return map;
};

describe("buildActualBoundaryPatchesForSailingDay", () => {
  it("emits a departure actual-boundary patch when underway location proves departure", () => {
    const events = buildSeedVesselTripEvents([
      makeTrip({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(9, 10),
      }),
    ]);
    const updatedAt = 0;
    const tripIdx = tripIndexFromSeedEvents(events);
    const scheduledEvents = buildScheduledBoundaryEvents(events, updatedAt);
    const actualEvents = buildActualBoundaryEvents(events, updatedAt, tripIdx);

    const effects = buildActualBoundaryPatchesForSailingDay({
      sailingDay: "2026-03-13",
      scheduledEvents,
      actualEvents,
      vesselLocations: [
        makeLocation({
          VesselAbbrev: "TOK",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: at(8, 35),
          TimeStamp: at(8, 50),
          AtDock: false,
          Speed: 12,
          LeftDock: undefined,
        }),
      ],
      tripBySegmentKey: tripIdx,
    });

    const seg0 = events[0]?.SegmentKey;
    const ctx0 = seg0 ? tripIdx.get(seg0) : undefined;

    expect(effects).toEqual([
      {
        TripKey: ctx0?.TripKey,
        ScheduleKey: seg0,
        SegmentKey: seg0,
        VesselAbbrev: "TOK",
        SailingDay: "2026-03-13",
        ScheduledDeparture: at(8, 35),
        TerminalAbbrev: "P52",
        EventType: "dep-dock",
        EventOccurred: true,
        EventActualTime: undefined,
      },
    ]);
  });

  it("emits an arrival actual-boundary patch when docked location proves arrival", () => {
    const events = buildSeedVesselTripEvents([
      makeTrip({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(9, 10),
      }),
      makeTrip({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "BBI",
        ArrivingTerminalAbbrev: "P52",
        DepartingTime: at(9, 20),
        SchedArriveNext: at(9, 55),
      }),
    ]);
    const updatedAt = 0;
    const tripIdx = tripIndexFromSeedEvents(events);
    const scheduledEvents = buildScheduledBoundaryEvents(events, updatedAt);
    const actualEvents = buildActualBoundaryEvents(events, updatedAt, tripIdx);

    const effects = buildActualBoundaryPatchesForSailingDay({
      sailingDay: "2026-03-13",
      scheduledEvents,
      actualEvents,
      vesselLocations: [
        makeLocation({
          VesselAbbrev: "TOK",
          DepartingTerminalAbbrev: "BBI",
          ArrivingTerminalAbbrev: "P52",
          ScheduledDeparture: at(9, 20),
          TimeStamp: at(9, 18),
          AtDock: true,
          Speed: 0,
        }),
      ],
      tripBySegmentKey: tripIdx,
    });

    const seg1 = events[1]?.SegmentKey;
    const ctx1 = seg1 ? tripIdx.get(seg1) : undefined;

    expect(effects).toEqual([
      {
        TripKey: ctx1?.TripKey,
        ScheduleKey: seg1,
        SegmentKey: seg1,
        VesselAbbrev: "TOK",
        SailingDay: "2026-03-13",
        ScheduledDeparture: at(8, 35),
        TerminalAbbrev: "BBI",
        EventType: "arv-dock",
        EventOccurred: true,
        EventActualTime: undefined,
      },
    ]);
  });

  it("ignores locations whose effective sailing day is different", () => {
    const events = buildSeedVesselTripEvents([
      makeTrip({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(9, 10),
      }),
    ]);
    const updatedAt = 0;
    const tripIdx = tripIndexFromSeedEvents(events);
    const scheduledEvents = buildScheduledBoundaryEvents(events, updatedAt);
    const actualEvents = buildActualBoundaryEvents(events, updatedAt, tripIdx);

    const effects = buildActualBoundaryPatchesForSailingDay({
      sailingDay: "2026-03-13",
      scheduledEvents,
      actualEvents,
      vesselLocations: [
        makeLocation({
          VesselAbbrev: "TOK",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: undefined,
          TimeStamp: Date.UTC(2026, 2, 14, 15, 30),
          AtDock: false,
          Speed: 12,
        }),
      ],
      tripBySegmentKey: tripIdx,
    });

    expect(effects).toEqual([]);
  });

  it("SAL dock window with no scheduled identity produces no reconciliation effects", () => {
    const events = buildSeedVesselTripEvents([
      makeTrip({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(9, 10),
      }),
    ]);
    const updatedAt = 0;
    const tripIdx = tripIndexFromSeedEvents(events);
    const scheduledEvents = buildScheduledBoundaryEvents(events, updatedAt);
    const actualEvents = buildActualBoundaryEvents(events, updatedAt, tripIdx);

    const effects = buildActualBoundaryPatchesForSailingDay({
      sailingDay: "2026-03-13",
      scheduledEvents,
      actualEvents,
      vesselLocations: [
        makeLocation({
          VesselAbbrev: "SAL",
          DepartingTerminalAbbrev: "SOU",
          ArrivingTerminalAbbrev: undefined,
          ScheduledDeparture: undefined,
          RouteAbbrev: "f-v-s",
          TimeStamp: at(17, 31),
          AtDock: true,
          Speed: 0,
        }),
      ],
      tripBySegmentKey: tripIdx,
    });

    expect(effects).toEqual([]);
  });

  it("does not emit duplicate effects when actual rows already mark the boundary", () => {
    const events = buildSeedVesselTripEvents([
      makeTrip({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(9, 10),
      }),
    ]);
    const withOccurred = events.map((event, index) =>
      index === 0 ? { ...event, EventOccurred: true as const } : event
    );
    const updatedAt = 0;
    const tripIdx = tripIndexFromSeedEvents(withOccurred);
    const scheduledEvents = buildScheduledBoundaryEvents(
      withOccurred,
      updatedAt
    );
    const actualEvents = buildActualBoundaryEvents(
      withOccurred,
      updatedAt,
      tripIdx
    );

    const effects = buildActualBoundaryPatchesForSailingDay({
      sailingDay: "2026-03-13",
      scheduledEvents,
      actualEvents,
      vesselLocations: [
        makeLocation({
          VesselAbbrev: "TOK",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: at(8, 35),
          TimeStamp: at(8, 50),
          AtDock: false,
          Speed: 12,
          LeftDock: undefined,
        }),
      ],
      tripBySegmentKey: tripIdx,
    });

    expect(effects).toEqual([]);
  });
});

const makeTrip = (
  overrides: Partial<ConvexScheduledTrip>
): ConvexScheduledTrip => ({
  VesselAbbrev: "TOK",
  DepartingTerminalAbbrev: "P52",
  ArrivingTerminalAbbrev: "BBI",
  DepartingTime: at(8, 35),
  ArrivingTime: undefined,
  SailingNotes: "",
  Annotations: [],
  RouteID: 1,
  RouteAbbrev: "sea-bi",
  Key: "TOK-P52-BBI-0835",
  SailingDay: "2026-03-13",
  TripType: "direct",
  ...overrides,
});

const makeLocation = (
  overrides: Partial<ConvexVesselLocation>
): ConvexVesselLocation => ({
  VesselID: 1,
  VesselName: "Tokitae",
  VesselAbbrev: "TOK",
  DepartingTerminalID: 1,
  DepartingTerminalName: "Seattle",
  DepartingTerminalAbbrev: "P52",
  ArrivingTerminalID: 2,
  ArrivingTerminalName: "Bainbridge",
  ArrivingTerminalAbbrev: "BBI",
  Latitude: 0,
  Longitude: 0,
  Speed: 0,
  Heading: 0,
  InService: true,
  AtDock: true,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: at(8, 35),
  RouteAbbrev: "sea-bi",
  VesselPositionNum: 1,
  TimeStamp: at(8, 34),
  DepartingDistance: 0,
  ArrivingDistance: undefined,
  ...overrides,
});
