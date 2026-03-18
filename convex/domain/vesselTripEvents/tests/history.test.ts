import { describe, expect, it } from "bun:test";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import type { RawWsfScheduleSegment } from "../../../shared/fetchWsfScheduleData";
import type { ConvexVesselTripEvent } from "../../../functions/vesselTripEvents/schemas";
import {
  buildSeedVesselTripEventsFromRawSegments,
  mergeSeededEventsWithHistory,
} from "../index";

const at = (hours: number, minutes: number) =>
  new Date(Date.UTC(2026, 2, 18, hours, minutes));

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
      sailingDay: "2026-03-18",
      seededEvents: buildSeedVesselTripEventsFromRawSegments(scheduleSegments),
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
    });

    expect(mergedEvents[0]?.ActualTime).toBe(at(14, 10).getTime());
    expect(mergedEvents[1]?.ActualTime).toBe(at(14, 24).getTime());
  });

  it("keeps existing actuals when history differs by less than three minutes", () => {
    const scheduleSegments = [makeRoute14Segment()];
    const seededEvents = buildSeedVesselTripEventsFromRawSegments(scheduleSegments);
    const existingEvents = seededEvents.map((event, index) =>
      makeEvent({
        ...event,
        ActualTime:
          index === 0 ? at(14, 9).getTime() : at(14, 23).getTime(),
      })
    );

    const mergedEvents = mergeSeededEventsWithHistory({
      sailingDay: "2026-03-18",
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
    });

    expect(mergedEvents[0]?.ActualTime).toBe(at(14, 9).getTime());
    expect(mergedEvents[1]?.ActualTime).toBe(at(14, 23).getTime());
  });

  it("replaces existing actuals when history differs by three minutes or more", () => {
    const scheduleSegments = [makeRoute14Segment()];
    const seededEvents = buildSeedVesselTripEventsFromRawSegments(scheduleSegments);
    const existingEvents = seededEvents.map((event, index) =>
      makeEvent({
        ...event,
        ActualTime:
          index === 0 ? at(14, 5).getTime() : at(14, 18).getTime(),
      })
    );

    const mergedEvents = mergeSeededEventsWithHistory({
      sailingDay: "2026-03-18",
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
    });

    expect(mergedEvents[0]?.ActualTime).toBe(at(14, 10).getTime());
    expect(mergedEvents[1]?.ActualTime).toBe(at(14, 24).getTime());
  });
});

const makeRoute14Segment = (): RawWsfScheduleSegment =>
  makeRawSegment({
    VesselName: "Cathlamet",
    DepartingTerminalName: "Vashon Island",
    ArrivingTerminalName: "Fauntleroy",
    DepartingTime: at(14, 5),
    RouteID: 14,
    RouteAbbrev: "f-v-s",
  });

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
  overrides: Partial<ConvexVesselTripEvent>
): ConvexVesselTripEvent => ({
  Key: "event",
  VesselAbbrev: "CAT",
  SailingDay: "2026-03-18",
  ScheduledDeparture: at(14, 5).getTime(),
  TerminalAbbrev: "VAI",
  EventType: "dep-dock",
  ScheduledTime: at(14, 5).getTime(),
  PredictedTime: undefined,
  ActualTime: undefined,
  ...overrides,
});
