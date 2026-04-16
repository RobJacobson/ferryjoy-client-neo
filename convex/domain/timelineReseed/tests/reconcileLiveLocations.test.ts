/**
 * Tests building sparse actual-boundary patches for one sailing day from loaded
 * rows and live locations.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexVesselLocation } from "../../../functions/vesselLocation/schemas";
import type { ConvexVesselTimelineEventRecord } from "../../../functions/vesselTimeline/schemas";
import { buildBoundaryKey, buildSegmentKey } from "../../../shared/keys";
import { generateTripKey } from "../../../shared/physicalTripIdentity";
import {
  type ActiveTripForPhysicalActualReconcile,
  buildActualBoundaryEvents,
  buildScheduledBoundaryEvents,
  type TripContextForActualRow,
} from "../../timelineRows";
import { buildActualBoundaryPatchesForSailingDay } from "../reconcileLiveLocations";

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
    const events = makeSeedEvents([
      {
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(9, 10),
      },
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
      activeTripsByVesselAbbrev: new Map(),
    });

    const seg0 = events[0]?.SegmentKey;
    const ctx0 = seg0 ? tripIdx.get(seg0) : undefined;
    expect(ctx0?.TripKey).toBeDefined();

    expect(effects).toEqual([
      {
        TripKey: ctx0!.TripKey,
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
    const events = makeSeedEvents([
      {
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(9, 10),
      },
      {
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "BBI",
        ArrivingTerminalAbbrev: "P52",
        DepartingTime: at(9, 20),
        SchedArriveNext: at(9, 55),
      },
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
      activeTripsByVesselAbbrev: new Map(),
    });

    const seg1 = events[1]?.SegmentKey;
    const ctx1 = seg1 ? tripIdx.get(seg1) : undefined;
    expect(ctx1?.TripKey).toBeDefined();

    expect(effects).toEqual([
      {
        TripKey: ctx1!.TripKey,
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
    const events = makeSeedEvents([
      {
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(9, 10),
      },
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
      activeTripsByVesselAbbrev: new Map(),
    });

    expect(effects).toEqual([]);
  });

  it("emits a physical-only departure patch for an active no-schedule trip", () => {
    const trip = makeActivePhysicalTrip({
      VesselAbbrev: "SAL",
      TripKey: "SAL 2026-03-13 17:20:00Z",
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: "VAI",
      SailingDay: "2026-03-13",
    });

    const effects = buildActualBoundaryPatchesForSailingDay({
      sailingDay: "2026-03-13",
      scheduledEvents: [],
      actualEvents: [],
      vesselLocations: [
        makeLocation({
          VesselAbbrev: "SAL",
          DepartingTerminalAbbrev: "SOU",
          ArrivingTerminalAbbrev: undefined,
          ScheduledDeparture: undefined,
          RouteAbbrev: "f-v-s",
          TimeStamp: at(17, 31),
          LeftDock: at(17, 29),
          AtDock: false,
          Speed: 12,
        }),
      ],
      tripBySegmentKey: new Map(),
      activeTripsByVesselAbbrev: new Map([["SAL", trip]]),
    });

    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      TripKey: trip.TripKey,
      ScheduleKey: undefined,
      VesselAbbrev: "SAL",
      SailingDay: "2026-03-13",
      TerminalAbbrev: "SOU",
      EventType: "dep-dock",
      EventOccurred: true,
      EventActualTime: at(17, 29),
    });
  });

  it("falls back to the proving tick time for a no-schedule departure", () => {
    const trip = makeActivePhysicalTrip({
      VesselAbbrev: "SAL",
      TripKey: "SAL 2026-03-13 17:20:00Z",
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: "VAI",
      SailingDay: "2026-03-13",
    });

    const effects = buildActualBoundaryPatchesForSailingDay({
      sailingDay: "2026-03-13",
      scheduledEvents: [],
      actualEvents: [],
      vesselLocations: [
        makeLocation({
          VesselAbbrev: "SAL",
          DepartingTerminalAbbrev: "SOU",
          ArrivingTerminalAbbrev: undefined,
          ScheduledDeparture: undefined,
          RouteAbbrev: "f-v-s",
          TimeStamp: at(17, 31),
          LeftDock: undefined,
          AtDock: false,
          Speed: 12,
        }),
      ],
      tripBySegmentKey: new Map(),
      activeTripsByVesselAbbrev: new Map([["SAL", trip]]),
    });

    expect(effects[0]?.EventActualTime).toBe(at(17, 31));
  });

  it("emits a physical-only arrival patch for an active no-schedule trip", () => {
    const trip = makeActivePhysicalTrip({
      VesselAbbrev: "SAL",
      TripKey: "SAL 2026-03-13 17:20:00Z",
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: "VAI",
      SailingDay: "2026-03-13",
    });

    const effects = buildActualBoundaryPatchesForSailingDay({
      sailingDay: "2026-03-13",
      scheduledEvents: [],
      actualEvents: [],
      vesselLocations: [
        makeLocation({
          VesselAbbrev: "SAL",
          DepartingTerminalAbbrev: "VAI",
          ArrivingTerminalAbbrev: undefined,
          ScheduledDeparture: undefined,
          RouteAbbrev: "f-v-s",
          TimeStamp: at(17, 31),
          AtDock: true,
          Speed: 0,
        }),
      ],
      tripBySegmentKey: new Map(),
      activeTripsByVesselAbbrev: new Map([["SAL", trip]]),
    });

    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      TripKey: trip.TripKey,
      ScheduleKey: undefined,
      VesselAbbrev: "SAL",
      SailingDay: "2026-03-13",
      TerminalAbbrev: "VAI",
      EventType: "arv-dock",
      EventOccurred: true,
      EventActualTime: at(17, 31),
    });
  });

  it("skips a physical-only arrival patch when the trip has no usable arrival terminal", () => {
    const trip = makeActivePhysicalTrip({
      VesselAbbrev: "SAL",
      TripKey: "SAL 2026-03-13 17:20:00Z",
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: undefined,
      SailingDay: "2026-03-13",
    });

    const effects = buildActualBoundaryPatchesForSailingDay({
      sailingDay: "2026-03-13",
      scheduledEvents: [],
      actualEvents: [],
      vesselLocations: [
        makeLocation({
          VesselAbbrev: "SAL",
          DepartingTerminalAbbrev: "VAI",
          ArrivingTerminalAbbrev: undefined,
          ScheduledDeparture: undefined,
          RouteAbbrev: "f-v-s",
          TimeStamp: at(17, 31),
          AtDock: true,
          Speed: 0,
        }),
      ],
      tripBySegmentKey: new Map(),
      activeTripsByVesselAbbrev: new Map([["SAL", trip]]),
    });

    expect(effects).toEqual([]);
  });

  it("does not emit a physical-only patch when the boundary already exists for that TripKey", () => {
    const trip = makeActivePhysicalTrip({
      VesselAbbrev: "SAL",
      TripKey: "SAL 2026-03-13 17:20:00Z",
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: "VAI",
      SailingDay: "2026-03-13",
    });

    const effects = buildActualBoundaryPatchesForSailingDay({
      sailingDay: "2026-03-13",
      scheduledEvents: [],
      actualEvents: [
        {
          EventKey: "SAL 2026-03-13 17:20:00Z--dep-dock",
          TripKey: trip.TripKey,
          ScheduleKey: undefined,
          EventType: "dep-dock",
          VesselAbbrev: "SAL",
          SailingDay: "2026-03-13",
          UpdatedAt: 0,
          ScheduledDeparture: at(17, 20),
          TerminalAbbrev: "SOU",
          EventOccurred: true,
          EventActualTime: at(17, 29),
        },
      ],
      vesselLocations: [
        makeLocation({
          VesselAbbrev: "SAL",
          DepartingTerminalAbbrev: "SOU",
          ArrivingTerminalAbbrev: undefined,
          ScheduledDeparture: undefined,
          RouteAbbrev: "f-v-s",
          TimeStamp: at(17, 31),
          LeftDock: undefined,
          AtDock: false,
          Speed: 12,
        }),
      ],
      tripBySegmentKey: new Map(),
      activeTripsByVesselAbbrev: new Map([["SAL", trip]]),
    });

    expect(effects).toEqual([]);
  });

  it("replaces the old SAL no-op characterization with physical-only reconstruction", () => {
    const events = makeSeedEvents([
      {
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(9, 10),
      },
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
      activeTripsByVesselAbbrev: new Map([
        [
          "SAL",
          makeActivePhysicalTrip({
            VesselAbbrev: "SAL",
            TripKey: "SAL 2026-03-13 17:20:00Z",
            DepartingTerminalAbbrev: "SOU",
            ArrivingTerminalAbbrev: "VAI",
            SailingDay: "2026-03-13",
          }),
        ],
      ]),
    });

    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      TripKey: "SAL 2026-03-13 17:20:00Z",
      ScheduleKey: undefined,
      VesselAbbrev: "SAL",
      TerminalAbbrev: "VAI",
      EventType: "arv-dock",
    });
  });

  it("does not emit duplicate effects when actual rows already mark the boundary", () => {
    const events = makeSeedEvents([
      {
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(9, 10),
      },
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
      activeTripsByVesselAbbrev: new Map(),
    });

    expect(effects).toEqual([]);
  });
});

const makeActivePhysicalTrip = (
  overrides: Partial<ActiveTripForPhysicalActualReconcile> & {
    VesselAbbrev: string;
    DepartingTerminalAbbrev: string;
  }
): ActiveTripForPhysicalActualReconcile & { TripKey: string } =>
  (({
    VesselAbbrev,
    DepartingTerminalAbbrev,
    ...rest
  }: Partial<ActiveTripForPhysicalActualReconcile> & {
    VesselAbbrev: string;
    DepartingTerminalAbbrev: string;
  }) => ({
    TripKey: "TOK 2026-03-13 15:35:00Z",
    ScheduleKey: undefined,
    VesselAbbrev,
    SailingDay: "2026-03-13",
    DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: "BBI",
    ScheduledDeparture: at(17, 20),
    LeftDock: undefined,
    LeftDockActual: undefined,
    ArriveDest: undefined,
    AtDockActual: undefined,
    ...rest,
  }))(overrides) as ActiveTripForPhysicalActualReconcile & { TripKey: string };

type SeedSegment = {
  VesselAbbrev: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  DepartingTime: number;
  SchedArriveNext?: number;
};

const makeSeedEvents = (
  segments: SeedSegment[]
): ConvexVesselTimelineEventRecord[] =>
  segments.flatMap((segment) => {
    const segmentKey = buildSegmentKey(
      segment.VesselAbbrev,
      segment.DepartingTerminalAbbrev,
      segment.ArrivingTerminalAbbrev,
      new Date(segment.DepartingTime)
    ) as string;

    return [
      {
        SegmentKey: segmentKey,
        Key: buildBoundaryKey(segmentKey, "dep-dock"),
        VesselAbbrev: segment.VesselAbbrev,
        SailingDay: "2026-03-13",
        ScheduledDeparture: segment.DepartingTime,
        TerminalAbbrev: segment.DepartingTerminalAbbrev,
        EventType: "dep-dock" as const,
        EventScheduledTime: segment.DepartingTime,
        EventPredictedTime: undefined,
        EventOccurred: undefined,
        EventActualTime: undefined,
      },
      {
        SegmentKey: segmentKey,
        Key: buildBoundaryKey(segmentKey, "arv-dock"),
        VesselAbbrev: segment.VesselAbbrev,
        SailingDay: "2026-03-13",
        ScheduledDeparture: segment.DepartingTime,
        TerminalAbbrev: segment.ArrivingTerminalAbbrev,
        EventType: "arv-dock" as const,
        EventScheduledTime: segment.SchedArriveNext,
        EventPredictedTime: undefined,
        EventOccurred: undefined,
        EventActualTime: undefined,
      },
    ];
  });

const makeLocation = (
  overrides: Partial<ConvexVesselLocation>
): ConvexVesselLocation => ({
  VesselAbbrev: "TOK",
  VesselID: 1,
  VesselName: "Tokitae",
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
