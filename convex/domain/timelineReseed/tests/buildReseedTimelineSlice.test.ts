/**
 * Exercises the public reseed row-slice entrypoint with hydrated event records.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexVesselLocation } from "../../../functions/vesselLocation/schemas";
import type { ConvexVesselTimelineEventRecord } from "../../../functions/vesselTimeline/schemas";
import { buildBoundaryKey, buildSegmentKey } from "../../../shared/keys";
import { generateTripKey } from "../../../shared/physicalTripIdentity";
import type {
  ActiveTripForPhysicalActualReconcile,
  TripContextForActualRow,
} from "../../timelineRows";
import { buildReseedTimelineSlice } from "../buildReseedTimelineSlice";

const at = (hours: number, minutes: number) =>
  Date.UTC(2026, 2, 13, hours + 7, minutes);

const SAILING_DAY = "2026-03-13";

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
        SailingDay: SAILING_DAY,
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
        SailingDay: SAILING_DAY,
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

describe("buildReseedTimelineSlice", () => {
  it("builds scheduled rows from hydrated events; base actual rows only when events carry occurrence or actual time", () => {
    const events = makeSeedEvents([
      {
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(9, 10),
      },
    ]);
    const updatedAt = 1;
    const tripIdx = tripIndexFromSeedEvents(events);

    const { scheduledRows, actualRows, scheduledCount, actualCount } =
      buildReseedTimelineSlice({
        sailingDay: SAILING_DAY,
        events,
        updatedAt,
        tripBySegmentKey: tripIdx,
        activeTripsByVesselAbbrev: new Map(),
        physicalOnlyTrips: [],
        vesselLocations: [],
      });

    expect(scheduledCount).toBe(events.length);
    expect(scheduledRows.length).toBe(events.length);
    expect(actualCount).toBe(0);
    expect(actualRows.length).toBe(0);
  });

  it("applies live vessel-location patches into merged actual rows", () => {
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

    const { actualRows } = buildReseedTimelineSlice({
      sailingDay: SAILING_DAY,
      events,
      updatedAt,
      tripBySegmentKey: tripIdx,
      activeTripsByVesselAbbrev: new Map(),
      physicalOnlyTrips: [],
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
    });

    const depRow = actualRows.find((r) => r.EventType === "dep-dock");
    expect(depRow?.EventOccurred).toBe(true);
  });

  it("ignores locations whose effective sailing day differs from the slice", () => {
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

    const { actualRows: withWrongDay } = buildReseedTimelineSlice({
      sailingDay: SAILING_DAY,
      events,
      updatedAt,
      tripBySegmentKey: tripIdx,
      activeTripsByVesselAbbrev: new Map(),
      physicalOnlyTrips: [],
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
    });

    const { actualRows: baseline } = buildReseedTimelineSlice({
      sailingDay: SAILING_DAY,
      events,
      updatedAt,
      tripBySegmentKey: tripIdx,
      activeTripsByVesselAbbrev: new Map(),
      physicalOnlyTrips: [],
      vesselLocations: [],
    });

    expect(withWrongDay.map((r) => r.EventKey)).toEqual(
      baseline.map((r) => r.EventKey)
    );
  });

  it("does not duplicate actuals when events already mark departure as occurred", () => {
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

    const { actualRows } = buildReseedTimelineSlice({
      sailingDay: SAILING_DAY,
      events: withOccurred,
      updatedAt,
      tripBySegmentKey: tripIdx,
      activeTripsByVesselAbbrev: new Map(),
      physicalOnlyTrips: [],
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
    });

    const depRows = actualRows.filter((r) => r.EventType === "dep-dock");
    expect(depRows.length).toBe(1);
  });

  it("recreates a physical-only dep row from a no-schedule trip plus live location", () => {
    const trip = makeActivePhysicalTrip({
      VesselAbbrev: "SAL",
      TripKey: "SAL 2026-03-13 17:20:00Z",
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: "VAI",
      SailingDay: SAILING_DAY,
      ScheduledDeparture: at(17, 20),
    });

    const { actualRows } = buildReseedTimelineSlice({
      sailingDay: SAILING_DAY,
      events: [],
      updatedAt: 0,
      tripBySegmentKey: new Map(),
      activeTripsByVesselAbbrev: new Map([["SAL", trip]]),
      physicalOnlyTrips: [trip],
      vesselLocations: [
        makeLocation({
          VesselAbbrev: "SAL",
          DepartingTerminalAbbrev: "SOU",
          ArrivingTerminalAbbrev: undefined,
          ScheduledDeparture: undefined,
          RouteAbbrev: "f-v-s",
          LeftDock: at(17, 29),
          TimeStamp: at(17, 31),
          AtDock: false,
          Speed: 12,
        }),
      ],
    });

    expect(actualRows).toContainEqual(
      expect.objectContaining({
        EventKey: "SAL 2026-03-13 17:20:00Z--dep-dock",
        TripKey: trip.TripKey,
        ScheduleKey: undefined,
        TerminalAbbrev: "SOU",
        EventType: "dep-dock",
        EventActualTime: at(17, 29),
      })
    );
  });

  it("recreates a physical-only arv row from a no-schedule trip plus live location", () => {
    const trip = makeActivePhysicalTrip({
      VesselAbbrev: "SAL",
      TripKey: "SAL 2026-03-13 17:20:00Z",
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: "VAI",
      SailingDay: SAILING_DAY,
      ScheduledDeparture: at(17, 20),
    });

    const { actualRows } = buildReseedTimelineSlice({
      sailingDay: SAILING_DAY,
      events: [],
      updatedAt: 0,
      tripBySegmentKey: new Map(),
      activeTripsByVesselAbbrev: new Map([["SAL", trip]]),
      physicalOnlyTrips: [trip],
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
    });

    expect(actualRows).toContainEqual(
      expect.objectContaining({
        EventKey: "SAL 2026-03-13 17:20:00Z--arv-dock",
        TripKey: trip.TripKey,
        ScheduleKey: undefined,
        TerminalAbbrev: "VAI",
        EventType: "arv-dock",
        EventActualTime: at(17, 31),
      })
    );
  });

  it("reconstructs physical-only rows from trip state even without live locations", () => {
    const trip = makeActivePhysicalTrip({
      VesselAbbrev: "SAL",
      TripKey: "SAL 2026-03-13 17:20:00Z",
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: "VAI",
      SailingDay: SAILING_DAY,
      ScheduledDeparture: at(17, 20),
      ArrivedNextActual: at(17, 55),
      LeftDockActual: at(17, 30),
      ArriveDest: at(17, 56),
    });

    const { actualRows } = buildReseedTimelineSlice({
      sailingDay: SAILING_DAY,
      events: [],
      updatedAt: 0,
      tripBySegmentKey: new Map(),
      activeTripsByVesselAbbrev: new Map([["SAL", trip]]),
      physicalOnlyTrips: [trip],
      vesselLocations: [],
    });

    expect(actualRows.map((row) => row.EventKey).sort()).toEqual([
      "SAL 2026-03-13 17:20:00Z--arv-dock",
      "SAL 2026-03-13 17:20:00Z--dep-dock",
    ]);
  });

  it("reconstructs only the departure physical-only row when canonical departure exists but arrival is legacy-only", () => {
    const trip = makeActivePhysicalTrip({
      VesselAbbrev: "SAL",
      TripKey: "SAL 2026-03-13 17:20:00Z",
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: "VAI",
      SailingDay: SAILING_DAY,
      ScheduledDeparture: at(17, 20),
      ArrivedNextActual: undefined,
      LeftDockActual: at(17, 29),
      ArriveDest: at(17, 55),
    });

    const { actualRows } = buildReseedTimelineSlice({
      sailingDay: SAILING_DAY,
      events: [],
      updatedAt: 0,
      tripBySegmentKey: new Map(),
      activeTripsByVesselAbbrev: new Map([["SAL", trip]]),
      physicalOnlyTrips: [trip],
      vesselLocations: [],
    });

    expect(actualRows).toHaveLength(1);
    expect(actualRows[0]?.EventType).toBe("dep-dock");
  });

  it("handles a mixed slice with scheduled and physical-only vessels", () => {
    const events = makeSeedEvents([
      {
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(9, 10),
      },
    ]);
    const tripIdx = tripIndexFromSeedEvents(events);
    const salTrip = makeActivePhysicalTrip({
      VesselAbbrev: "SAL",
      TripKey: "SAL 2026-03-13 17:20:00Z",
      DepartingTerminalAbbrev: "SOU",
      ArrivingTerminalAbbrev: "VAI",
      SailingDay: SAILING_DAY,
      ScheduledDeparture: at(17, 20),
    });

    const { actualRows } = buildReseedTimelineSlice({
      sailingDay: SAILING_DAY,
      events,
      updatedAt: 0,
      tripBySegmentKey: tripIdx,
      activeTripsByVesselAbbrev: new Map([["SAL", salTrip]]),
      physicalOnlyTrips: [salTrip],
      vesselLocations: [
        makeLocation({
          VesselAbbrev: "TOK",
          DepartingTerminalAbbrev: "P52",
          ArrivingTerminalAbbrev: "BBI",
          ScheduledDeparture: at(8, 35),
          TimeStamp: at(8, 50),
          AtDock: false,
          Speed: 12,
        }),
        makeLocation({
          VesselAbbrev: "SAL",
          DepartingTerminalAbbrev: "SOU",
          ArrivingTerminalAbbrev: undefined,
          ScheduledDeparture: undefined,
          RouteAbbrev: "f-v-s",
          LeftDock: at(17, 29),
          TimeStamp: at(17, 31),
          AtDock: false,
          Speed: 12,
        }),
      ],
    });

    expect(actualRows.some((row) => row.VesselAbbrev === "TOK")).toBe(true);
    expect(
      actualRows.some(
        (row) => row.VesselAbbrev === "SAL" && row.ScheduleKey === undefined
      )
    ).toBe(true);
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
    SailingDay: SAILING_DAY,
    DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: "BBI",
    ScheduledDeparture: at(17, 20),
    ArrivedNextActual: undefined,
    LeftDock: undefined,
    LeftDockActual: undefined,
    ArriveDest: undefined,
    AtDockActual: undefined,
    ...rest,
  }))(overrides) as ActiveTripForPhysicalActualReconcile & { TripKey: string };
