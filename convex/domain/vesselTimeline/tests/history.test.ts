/**
 * Covers history-backed enrichment for schedule-seeded boundary events.
 */
import { describe, expect, it } from "bun:test";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import type { TerminalIdentity } from "../../../functions/terminals/resolver";
import type { ConvexVesselTimelineEventRecord } from "../../../functions/vesselTimeline/schemas";
import type { RawWsfScheduleSegment } from "../../../shared/fetchWsfScheduleData";
import type { VesselIdentity } from "../../../shared/vessels";
import {
  buildSeedVesselTripEventsFromRawSegments,
  createSeededScheduleSegmentResolver,
  mergeSeededEventsWithHistory,
} from "../events";

/**
 * Creates a UTC fixture timestamp for history-merge tests.
 *
 * @param hours - UTC hour for the fixture timestamp
 * @param minutes - UTC minute for the fixture timestamp
 * @returns Date instance for the requested fixture time
 */
const at = (hours: number, minutes: number) =>
  new Date(Date.UTC(2026, 2, 18, hours, minutes));

const backendVessels: VesselIdentity[] = [
  {
    VesselID: 1,
    VesselName: "Tokitae",
    VesselAbbrev: "TOK",
  },
  {
    VesselID: 2,
    VesselName: "Cathlamet",
    VesselAbbrev: "CAT",
  },
];

const backendTerminals: TerminalIdentity[] = [
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
  {
    TerminalID: 3,
    TerminalName: "Vashon Island",
    TerminalAbbrev: "VAI",
  },
  {
    TerminalID: 4,
    TerminalName: "Fauntleroy",
    TerminalAbbrev: "FAU",
  },
];

describe("mergeSeededEventsWithHistory", () => {
  it("backfills actuals from exact-matched vessel history", () => {
    const scheduleSegments = [
      makeRawSegment({
        VesselName: "Cathlamet",
        DepartingTerminalName: "Vashon Island",
        ArrivingTerminalName: "Fauntleroy",
        DepartingTime: at(14, 5),
        RouteID: 14,
        RouteAbbrev: "f-v-s",
      }),
    ];

    const mergedEvents = mergeSeededEventsWithHistory({
      seededEvents: buildSeedVesselTripEventsFromRawSegments(
        scheduleSegments,
        backendVessels,
        backendTerminals
      ),
      existingEvents: [],
      scheduleSegments,
      historyRecords: [
        makeHistory({
          Vessel: "Cathlamet",
          Departing: "Vashon",
          Arriving: "Fauntleroy",
          ScheduledDepart: at(14, 5),
          ActualDepart: at(14, 10),
          EstArrival: at(14, 24),
        }),
      ],
      vessels: backendVessels,
      terminals: backendTerminals,
    });

    expect(mergedEvents[0]?.EventActualTime).toBe(at(14, 10).getTime());
    expect(mergedEvents[1]?.EventActualTime).toBe(at(14, 24).getTime());
  });

  it("keeps departure actuals when history differs by less than three minutes", () => {
    const scheduleSegments = [makeRoute14Segment()];
    const seededEvents = buildSeedVesselTripEventsFromRawSegments(
      scheduleSegments,
      backendVessels,
      backendTerminals
    );
    const existingEvents = seededEvents.map((event, index) =>
      makeEvent({
        ...event,
        EventActualTime:
          index === 0 ? at(14, 9).getTime() : at(14, 23).getTime(),
      })
    );

    const mergedEvents = mergeSeededEventsWithHistory({
      seededEvents,
      existingEvents,
      scheduleSegments,
      historyRecords: [
        makeHistory({
          Vessel: "Cathlamet",
          Departing: "Vashon",
          Arriving: "Fauntleroy",
          ScheduledDepart: at(14, 5),
          ActualDepart: at(14, 10),
          EstArrival: at(14, 24),
        }),
      ],
      vessels: backendVessels,
      terminals: backendTerminals,
    });

    expect(mergedEvents[0]?.EventActualTime).toBe(at(14, 9).getTime());
  });

  it("keeps arrival actuals when ETA proxy differs by only one minute", () => {
    const scheduleSegments = [makeRoute14Segment()];
    const seededEvents = buildSeedVesselTripEventsFromRawSegments(
      scheduleSegments,
      backendVessels,
      backendTerminals
    );
    const existingEvents = seededEvents.map((event, index) =>
      makeEvent({
        ...event,
        EventActualTime:
          index === 0 ? at(14, 9).getTime() : at(14, 23).getTime(),
      })
    );

    const mergedEvents = mergeSeededEventsWithHistory({
      seededEvents,
      existingEvents,
      scheduleSegments,
      historyRecords: [
        makeHistory({
          Vessel: "Cathlamet",
          Departing: "Vashon",
          Arriving: "Fauntleroy",
          ScheduledDepart: at(14, 5),
          ActualDepart: at(14, 10),
          EstArrival: at(14, 24),
        }),
      ],
      vessels: backendVessels,
      terminals: backendTerminals,
    });

    expect(mergedEvents[1]?.EventActualTime).toBe(at(14, 23).getTime());
  });

  it("replaces departure actuals when history differs by three minutes or more", () => {
    const scheduleSegments = [makeRoute14Segment()];
    const seededEvents = buildSeedVesselTripEventsFromRawSegments(
      scheduleSegments,
      backendVessels,
      backendTerminals
    );
    const existingEvents = seededEvents.map((event, index) =>
      makeEvent({
        ...event,
        EventActualTime:
          index === 0 ? at(14, 5).getTime() : at(14, 18).getTime(),
      })
    );

    const mergedEvents = mergeSeededEventsWithHistory({
      seededEvents,
      existingEvents,
      scheduleSegments,
      historyRecords: [
        makeHistory({
          Vessel: "Cathlamet",
          Departing: "Vashon",
          Arriving: "Fauntleroy",
          ScheduledDepart: at(14, 5),
          ActualDepart: at(14, 10),
          EstArrival: at(14, 24),
        }),
      ],
      vessels: backendVessels,
      terminals: backendTerminals,
    });

    expect(mergedEvents[0]?.EventActualTime).toBe(at(14, 10).getTime());
    expect(mergedEvents[1]?.EventActualTime).toBe(at(14, 24).getTime());
  });

  it("replaces arrival actuals when ETA proxy differs by two minutes or more", () => {
    const scheduleSegments = [makeRoute14Segment()];
    const seededEvents = buildSeedVesselTripEventsFromRawSegments(
      scheduleSegments,
      backendVessels,
      backendTerminals
    );
    const existingEvents = seededEvents.map((event, index) =>
      makeEvent({
        ...event,
        EventActualTime:
          index === 0 ? at(14, 9).getTime() : at(14, 22).getTime(),
      })
    );

    const mergedEvents = mergeSeededEventsWithHistory({
      seededEvents,
      existingEvents,
      scheduleSegments,
      historyRecords: [
        makeHistory({
          Vessel: "Cathlamet",
          Departing: "Vashon",
          Arriving: "Fauntleroy",
          ScheduledDepart: at(14, 5),
          ActualDepart: at(14, 10),
          EstArrival: at(14, 24),
        }),
      ],
      vessels: backendVessels,
      terminals: backendTerminals,
    });

    expect(mergedEvents[1]?.EventActualTime).toBe(at(14, 24).getTime());
  });

  it("backfills departure actuals even when the arrival proxy is missing", () => {
    const scheduleSegments = [makeRoute14Segment()];

    const mergedEvents = mergeSeededEventsWithHistory({
      seededEvents: buildSeedVesselTripEventsFromRawSegments(
        scheduleSegments,
        backendVessels,
        backendTerminals
      ),
      existingEvents: [],
      scheduleSegments,
      historyRecords: [
        makeHistory({
          Vessel: "Cathlamet",
          Departing: "Vashon",
          Arriving: "Fauntleroy",
          ScheduledDepart: at(14, 5),
          ActualDepart: at(14, 10),
          EstArrival: undefined,
        }),
      ],
      vessels: backendVessels,
      terminals: backendTerminals,
    });

    expect(mergedEvents[0]?.EventActualTime).toBe(at(14, 10).getTime());
    expect(mergedEvents[1]?.EventActualTime).toBeUndefined();
  });

  it("fallback-matches departure when history omits Arriving (CAT-style row)", () => {
    const scheduleSegments = [makeRoute14Segment()];

    const mergedEvents = mergeSeededEventsWithHistory({
      seededEvents: buildSeedVesselTripEventsFromRawSegments(
        scheduleSegments,
        backendVessels,
        backendTerminals
      ),
      existingEvents: [],
      scheduleSegments,
      historyRecords: [
        makeHistory({
          Vessel: "Cathlamet",
          Departing: "Vashon",
          Arriving: null,
          ScheduledDepart: at(14, 5),
          ActualDepart: at(14, 10),
          EstArrival: undefined,
        }),
      ],
      vessels: backendVessels,
      terminals: backendTerminals,
    });

    expect(mergedEvents[0]?.EventActualTime).toBe(at(14, 10).getTime());
    expect(mergedEvents[1]?.EventActualTime).toBeUndefined();
  });

  it("fallback-matches both boundaries when Arriving is null but EstArrival is set", () => {
    const scheduleSegments = [makeRoute14Segment()];

    const mergedEvents = mergeSeededEventsWithHistory({
      seededEvents: buildSeedVesselTripEventsFromRawSegments(
        scheduleSegments,
        backendVessels,
        backendTerminals
      ),
      existingEvents: [],
      scheduleSegments,
      historyRecords: [
        makeHistory({
          Vessel: "Cathlamet",
          Departing: "Vashon",
          Arriving: null,
          ScheduledDepart: at(14, 5),
          ActualDepart: at(14, 10),
          EstArrival: at(14, 24),
        }),
      ],
      vessels: backendVessels,
      terminals: backendTerminals,
    });

    expect(mergedEvents[0]?.EventActualTime).toBe(at(14, 10).getTime());
    expect(mergedEvents[1]?.EventActualTime).toBe(at(14, 24).getTime());
  });
});

describe("createSeededScheduleSegmentResolver", () => {
  const sailingDay = "2026-03-18";
  const segKeyA = "CAT--2026-03-18--07:05--VAI-FAU";

  /**
   * Builds minimal dep-dock rows for lookup tests.
   *
   * @param rows - Departure rows to include in the seed
   * @returns Convex timeline event fixtures
   */
  const seedDeps = (
    rows: Array<{
      segmentKey: string;
      scheduledMs: number;
      vessel?: string;
    }>
  ): ConvexVesselTimelineEventRecord[] =>
    rows.flatMap((row) => [
      {
        SegmentKey: row.segmentKey,
        Key: `${row.segmentKey}--dep-dock`,
        VesselAbbrev: row.vessel ?? "CAT",
        SailingDay: sailingDay,
        ScheduledDeparture: row.scheduledMs,
        TerminalAbbrev: "VAI",
        EventType: "dep-dock" as const,
        EventScheduledTime: row.scheduledMs,
        EventPredictedTime: undefined,
        EventOccurred: undefined,
        EventActualTime: undefined,
      },
      {
        SegmentKey: row.segmentKey,
        Key: `${row.segmentKey}--arv-dock`,
        VesselAbbrev: row.vessel ?? "CAT",
        SailingDay: sailingDay,
        ScheduledDeparture: row.scheduledMs,
        TerminalAbbrev: "FAU",
        EventType: "arv-dock" as const,
        EventScheduledTime: row.scheduledMs,
        EventPredictedTime: undefined,
        EventOccurred: undefined,
        EventActualTime: undefined,
      },
    ]);

  it("resolves exact scheduled departure match", () => {
    const ms = at(14, 5).getTime();
    const resolve = createSeededScheduleSegmentResolver(
      seedDeps([{ segmentKey: segKeyA, scheduledMs: ms }])
    );

    expect(resolve("CAT", at(14, 5))).toBe(segKeyA);
  });

  it("returns undefined when scheduled departure does not match exactly", () => {
    const ms = at(14, 5).getTime();
    const resolve = createSeededScheduleSegmentResolver(
      seedDeps([{ segmentKey: segKeyA, scheduledMs: ms }])
    );

    expect(resolve("CAT", at(14, 6))).toBeUndefined();
  });
});

/**
 * Creates a route-14 schedule segment fixture.
 *
 * @returns Raw WSF schedule segment for a Vashon to Fauntleroy sailing
 */
const makeRoute14Segment = (): RawWsfScheduleSegment =>
  makeRawSegment({
    VesselName: "Cathlamet",
    DepartingTerminalName: "Vashon Island",
    ArrivingTerminalName: "Fauntleroy",
    DepartingTime: at(14, 5),
    RouteID: 14,
    RouteAbbrev: "f-v-s",
  });

/**
 * Creates a raw WSF schedule segment fixture with overrides.
 *
 * @param overrides - Partial raw segment fields to override
 * @returns Raw schedule segment fixture
 */
const makeRawSegment = (
  overrides: Partial<RawWsfScheduleSegment>
): RawWsfScheduleSegment => ({
  VesselName: "Tokitae",
  DepartingTerminalName: "Seattle",
  ArrivingTerminalName: "Bainbridge Island",
  DepartingTime: at(15, 35),
  ArrivingTime: null,
  SailingNotes: "",
  Annotations: [],
  RouteID: 7,
  RouteAbbrev: "sea-bi",
  SailingDay: "2026-03-18",
  ...overrides,
});

/**
 * Creates a vessel history fixture with overrides.
 *
 * @param overrides - Partial history fields to override
 * @returns Vessel history fixture
 */
const makeHistory = (overrides: Partial<VesselHistory>): VesselHistory =>
  ({
    VesselId: 1,
    Vessel: "Tokitae",
    Departing: "Seattle",
    Arriving: "Bainbridge Island",
    ScheduledDepart: at(15, 35),
    ActualDepart: at(15, 36),
    EstArrival: at(16, 10),
    Date: at(15, 35),
    ...overrides,
  }) as VesselHistory;

const makeEvent = (
  overrides: Partial<ConvexVesselTimelineEventRecord>
): ConvexVesselTimelineEventRecord => ({
  Key: "event",
  VesselAbbrev: "CAT",
  SailingDay: "2026-03-18",
  ScheduledDeparture: at(14, 5).getTime(),
  TerminalAbbrev: "VAI",
  EventType: "dep-dock",
  EventScheduledTime: at(14, 5).getTime(),
  EventPredictedTime: undefined,
  EventActualTime: undefined,
  ...overrides,
});
