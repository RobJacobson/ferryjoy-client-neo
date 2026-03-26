/**
 * Covers seeding and live-update behavior for the VesselTimeline boundary
 * event model.
 */
import { describe, expect, it } from "bun:test";
import type { ConvexScheduledTrip } from "../../../functions/scheduledTrips/schemas";
import type { ConvexVesselLocation } from "../../../functions/vesselLocation/schemas";
import type { ConvexVesselTimelineEventRecord } from "../../../functions/vesselTimeline/eventRecordSchemas";
import type { RawWsfScheduleSegment } from "../../../shared/fetchWsfScheduleData";
import {
  applyLiveLocationToEvents,
  buildEventKey,
  getLocationSailingDay,
  normalizeScheduledDockSeams,
  sortVesselTripEvents,
} from "../events/liveUpdates";
import {
  buildSeedVesselTripEvents,
  buildSeedVesselTripEventsFromRawSegments,
} from "../events/seed";

/**
 * Creates a UTC timestamp for the fixture sailing day using local service
 * hours.
 *
 * @param hours - Hour component in local service time
 * @param minutes - Minute component in local service time
 * @returns Epoch milliseconds for the requested fixture time
 */
const at = (hours: number, minutes: number) =>
  Date.UTC(2026, 2, 13, hours + 7, minutes);

describe("buildSeedVesselTripEvents", () => {
  it("builds dep/arv events from direct segments", () => {
    const events = buildSeedVesselTripEvents([
      makeTrip({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(9, 10),
      }),
    ]);

    expect(events.map((event) => event.EventType)).toEqual([
      "dep-dock",
      "arv-dock",
    ]);
    expect(events[1]?.ScheduledTime).toBe(at(9, 10));
  });

  it("subtracts five minutes from arrival time when schedule arrival equals departure", () => {
    const events = buildSeedVesselTripEvents([
      makeTrip({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        ArrivingTime: at(8, 35),
      }),
    ]);

    expect(events[1]?.ScheduledTime).toBe(at(8, 30));
  });

  it("subtracts five minutes from an arrival when the next same-terminal departure has the identical scheduled time", () => {
    const events = buildSeedVesselTripEvents([
      makeTrip({
        VesselAbbrev: "ISS",
        DepartingTerminalAbbrev: "ORI",
        ArrivingTerminalAbbrev: "SHI",
        DepartingTime: at(8, 30),
        SchedArriveNext: at(9, 10),
      }),
      makeTrip({
        VesselAbbrev: "ISS",
        DepartingTerminalAbbrev: "SHI",
        ArrivingTerminalAbbrev: "ANA",
        DepartingTime: at(9, 10),
        SchedArriveNext: at(9, 40),
      }),
    ]);

    expect(events[1]?.EventType).toBe("arv-dock");
    expect(events[1]?.TerminalAbbrev).toBe("SHI");
    expect(events[1]?.ScheduledTime).toBe(at(9, 5));
    expect(events[2]?.EventType).toBe("dep-dock");
    expect(events[2]?.TerminalAbbrev).toBe("SHI");
    expect(events[2]?.ScheduledTime).toBe(at(9, 10));
  });

  it("uses sailing day, vessel, departure, terminal, and event type in Key", () => {
    const events = buildSeedVesselTripEvents([
      makeTrip({
        SailingDay: "2026-03-13",
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        DepartingTime: at(8, 35),
      }),
    ]);

    expect(events[0]?.Key).toBe(
      buildEventKey("2026-03-13", "TOK", at(8, 35), "P52", "dep-dock")
    );
    expect(events[1]?.Key).toBe(
      buildEventKey("2026-03-13", "TOK", at(8, 35), "P52", "arv-dock")
    );
  });

  it("formats Key with double-hyphen separators and ISO timestamps", () => {
    expect(
      buildEventKey("2026-03-13", "TOK", at(8, 35), "P52", "dep-dock")
    ).toBe("2026-03-13--TOK--2026-03-13--08:35:00--P52--dep");
    expect(
      buildEventKey("2026-03-13", "TOK", at(8, 35), "P52", "arv-dock")
    ).toBe("2026-03-13--TOK--2026-03-13--08:35:00--P52--arv");
  });

  it("builds dep/arv events directly from raw WSF schedule segments", () => {
    const events = buildSeedVesselTripEventsFromRawSegments([
      makeRawSegment({
        VesselName: "Tokitae",
        DepartingTerminalName: "Seattle",
        ArrivingTerminalName: "Bainbridge Island",
        DepartingTime: new Date(at(8, 35)),
        RouteID: 7,
        RouteAbbrev: "sea-bi",
      }),
    ]);

    expect(events.map((event) => event.EventType)).toEqual([
      "dep-dock",
      "arv-dock",
    ]);
    expect(events[0]?.TerminalAbbrev).toBe("P52");
    expect(events[1]?.TerminalAbbrev).toBe("BBI");
    expect(events[1]?.ScheduledTime).toBe(at(9, 10));
  });

  it("filters indirect raw schedule segments before seeding events", () => {
    const events = buildSeedVesselTripEventsFromRawSegments([
      makeRawSegment({
        VesselName: "Tokitae",
        DepartingTerminalName: "Seattle",
        ArrivingTerminalName: "Bainbridge Island",
        DepartingTime: new Date(at(8, 35)),
        RouteID: 7,
        RouteAbbrev: "sea-bi",
      }),
      makeRawSegment({
        VesselName: "Tokitae",
        DepartingTerminalName: "Seattle",
        ArrivingTerminalName: "Bremerton",
        DepartingTime: new Date(at(8, 35)),
        RouteID: 8,
        RouteAbbrev: "sea-br",
      }),
      makeRawSegment({
        VesselName: "Tokitae",
        DepartingTerminalName: "Bainbridge Island",
        ArrivingTerminalName: "Seattle",
        DepartingTime: new Date(at(9, 20)),
        RouteID: 7,
        RouteAbbrev: "sea-bi",
      }),
    ]);

    expect(events).toHaveLength(4);
    expect(events[0]?.TerminalAbbrev).toBe("P52");
    expect(events[1]?.TerminalAbbrev).toBe("BBI");
    expect(events.some((event) => event.TerminalAbbrev === "BRE")).toBe(false);
  });
});

describe("applyLiveLocationToEvents", () => {
  it("writes departure actuals and clears false departures", () => {
    const seededEvents = buildSeedVesselTripEvents([
      makeTrip({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(9, 10),
      }),
    ]);

    const departed = applyLiveLocationToEvents(
      seededEvents,
      makeLocation({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        ScheduledDeparture: at(8, 35),
        TimeStamp: at(8, 36),
        AtDock: false,
        Speed: 12,
      })
    );
    expect(departed[0]?.ActualTime).toBe(at(8, 36));

    const unwound = applyLiveLocationToEvents(
      departed,
      makeLocation({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        ScheduledDeparture: at(8, 35),
        TimeStamp: at(8, 37),
        AtDock: true,
        Speed: 0,
      })
    );

    expect(unwound[0]?.ActualTime).toBeUndefined();
  });

  it("does not write predicted times from live vessel locations", () => {
    const seededEvents = buildSeedVesselTripEvents([
      makeTrip({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(9, 10),
      }),
    ]);

    const firstPass = applyLiveLocationToEvents(
      seededEvents,
      makeLocation({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        ScheduledDeparture: at(8, 35),
        Eta: at(9, 8),
        TimeStamp: at(8, 34),
      })
    );
    const secondPass = applyLiveLocationToEvents(
      firstPass,
      makeLocation({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        ScheduledDeparture: at(8, 35),
        Eta: at(9, 5),
        TimeStamp: at(8, 40),
        AtDock: false,
        Speed: 14,
      })
    );

    expect(secondPass[1]?.PredictedTime).toBeUndefined();
  });

  it("writes early arrival actuals before the scheduled arrival time", () => {
    const seededEvents = buildSeedVesselTripEvents([
      makeTrip({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(9, 10),
      }),
    ]);

    const withPrediction = applyLiveLocationToEvents(
      seededEvents,
      makeLocation({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        ScheduledDeparture: at(8, 35),
        Eta: at(9, 5),
        TimeStamp: at(8, 50),
        AtDock: false,
        Speed: 12,
      })
    );

    const arrivedEarly = applyLiveLocationToEvents(
      withPrediction,
      makeLocation({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "BBI",
        ArrivingTerminalAbbrev: "P52",
        ScheduledDeparture: at(9, 20),
        TimeStamp: at(9, 6),
        AtDock: true,
        Speed: 0,
      })
    );

    expect(arrivedEarly[1]?.ActualTime).toBe(at(9, 6));
    expect(arrivedEarly[1]?.PredictedTime).toBeUndefined();
  });

  it("resolves the most recent eligible arrival for a terminal", () => {
    const seededEvents = buildSeedVesselTripEvents([
      makeTrip({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(9, 10),
      }),
      makeTrip({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(9, 20),
        SchedArriveNext: at(9, 55),
      }),
    ]);

    const arrived = applyLiveLocationToEvents(
      seededEvents,
      makeLocation({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "BBI",
        ArrivingTerminalAbbrev: "P52",
        ScheduledDeparture: at(10, 10),
        TimeStamp: at(10, 0),
        AtDock: true,
        Speed: 0,
      })
    );

    expect(arrived[1]?.ActualTime).toBeUndefined();
    expect(arrived[3]?.ActualTime).toBe(at(10, 0));
  });

  it("does not keep backfilling older arrivals on repeated docked ticks", () => {
    const seededEvents = buildSeedVesselTripEvents([
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
      makeTrip({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(10, 10),
        SchedArriveNext: at(10, 45),
      }),
    ]);

    const firstDockedTick = applyLiveLocationToEvents(
      seededEvents,
      makeLocation({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        ScheduledDeparture: at(10, 10),
        TimeStamp: at(10, 0),
        AtDock: true,
        Speed: 0,
      })
    );

    const secondDockedTick = applyLiveLocationToEvents(
      firstDockedTick,
      makeLocation({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        ScheduledDeparture: at(10, 10),
        TimeStamp: at(10, 1),
        AtDock: true,
        Speed: 0,
      })
    );

    expect(firstDockedTick[3]?.ActualTime).toBe(at(10, 0));
    expect(secondDockedTick[3]?.ActualTime).toBe(at(10, 0));
    expect(secondDockedTick[1]?.ActualTime).toBeUndefined();
  });

  it("treats ScheduledDeparture as authoritative for arrival anchoring", () => {
    const seededEvents = buildSeedVesselTripEvents([
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

    const arrived = applyLiveLocationToEvents(
      seededEvents,
      makeLocation({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        ScheduledDeparture: at(8, 0),
        TimeStamp: at(10, 0),
        AtDock: true,
        Speed: 0,
      })
    );

    expect(arrived[1]?.ActualTime).toBeUndefined();
    expect(arrived[3]?.ActualTime).toBeUndefined();
  });

  it("does not unwind a departure after the paired arrival has actualized", () => {
    const seededEvents = buildSeedVesselTripEvents([
      makeTrip({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(8, 40),
      }),
    ]);

    const withPrediction = applyLiveLocationToEvents(
      seededEvents,
      makeLocation({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        ScheduledDeparture: at(8, 35),
        Eta: at(8, 37),
        TimeStamp: at(8, 34),
        AtDock: false,
        Speed: 12,
      })
    );
    const departed = applyLiveLocationToEvents(
      withPrediction,
      makeLocation({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        ScheduledDeparture: at(8, 35),
        TimeStamp: at(8, 36),
        AtDock: false,
        Speed: 12,
      })
    );
    const arrived = applyLiveLocationToEvents(
      departed,
      makeLocation({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "BBI",
        ArrivingTerminalAbbrev: "P52",
        ScheduledDeparture: at(8, 50),
        TimeStamp: at(8, 37),
        AtDock: true,
        Speed: 0,
      })
    );
    const dockBounce = applyLiveLocationToEvents(
      arrived,
      makeLocation({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        ScheduledDeparture: at(8, 35),
        TimeStamp: at(8, 38),
        AtDock: true,
        Speed: 0,
      })
    );

    expect(dockBounce[0]?.ActualTime).toBe(at(8, 36));
    expect(dockBounce[1]?.ActualTime).toBe(at(8, 37));
  });

  it("ignores live updates when the departing terminal does not match the keyed trip", () => {
    const seededEvents = buildSeedVesselTripEvents([
      makeTrip({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(9, 10),
      }),
    ]);

    const updated = applyLiveLocationToEvents(
      seededEvents,
      makeLocation({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "EDM",
        ArrivingTerminalAbbrev: "BBI",
        ScheduledDeparture: at(8, 35),
        TimeStamp: at(8, 36),
        AtDock: false,
        Speed: 12,
        Eta: at(9, 0),
      })
    );

    expect(updated).toEqual(seededEvents);
  });

  it("does not write live actuals while the vessel is out of service", () => {
    const seededEvents = buildSeedVesselTripEvents([
      makeTrip({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        DepartingTime: at(8, 35),
        SchedArriveNext: at(9, 10),
      }),
    ]);

    const updated = applyLiveLocationToEvents(
      seededEvents,
      makeLocation({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        ScheduledDeparture: at(8, 35),
        TimeStamp: at(8, 36),
        AtDock: false,
        Speed: 12,
        InService: false,
        Eta: at(9, 5),
      })
    );

    expect(updated[0]?.ActualTime).toBeUndefined();
    expect(updated[1]?.ActualTime).toBeUndefined();
    expect(updated[1]?.PredictedTime).toBeUndefined();
  });
});

describe("getLocationSailingDay", () => {
  it("prefers ScheduledDeparture when present", () => {
    const location = makeLocation({
      ScheduledDeparture: at(8, 35),
      TimeStamp: Date.UTC(2026, 2, 14, 8, 30),
    });

    expect(getLocationSailingDay(location)).toBe("2026-03-13");
  });

  it("falls back to TimeStamp when ScheduledDeparture is missing", () => {
    const location = makeLocation({
      ScheduledDeparture: undefined,
      TimeStamp: Date.UTC(2026, 2, 14, 10, 30),
    });

    expect(getLocationSailingDay(location)).toBe("2026-03-14");
  });
});

describe("sortVesselTripEvents", () => {
  it("sorts by scheduled departure, then departure before arrival, then terminal", () => {
    const events = [
      makeEvent({
        Key: "c",
        ScheduledDeparture: at(9, 0),
        TerminalAbbrev: "BBI",
        EventType: "arv-dock",
      }),
      makeEvent({
        Key: "b",
        ScheduledDeparture: at(8, 35),
        TerminalAbbrev: "P52",
        EventType: "arv-dock",
      }),
      makeEvent({
        Key: "d",
        ScheduledDeparture: at(9, 0),
        TerminalAbbrev: "ANA",
        EventType: "arv-dock",
      }),
      makeEvent({
        Key: "a",
        ScheduledDeparture: at(8, 35),
        TerminalAbbrev: "P52",
        EventType: "dep-dock",
      }),
    ];

    expect(events.sort(sortVesselTripEvents).map((event) => event.Key)).toEqual(
      ["a", "b", "d", "c"]
    );
  });
});

describe("normalizeScheduledDockSeams", () => {
  it("subtracts five minutes from an arrival when the next same-terminal departure has the identical scheduled time", () => {
    const normalizedEvents = normalizeScheduledDockSeams(
      [
        makeEvent({
          Key: "arv-1",
          EventType: "arv-dock",
          TerminalAbbrev: "SHI",
          ScheduledDeparture: at(16, 15),
          ScheduledTime: at(16, 50),
        }),
        makeEvent({
          Key: "dep-1",
          EventType: "dep-dock",
          TerminalAbbrev: "SHI",
          ScheduledDeparture: at(16, 50),
          ScheduledTime: at(16, 50),
        }),
      ].sort(sortVesselTripEvents)
    );

    expect(normalizedEvents[0]?.ScheduledTime).toBe(at(16, 45));
    expect(normalizedEvents[1]?.ScheduledTime).toBe(at(16, 50));
  });

  it("normalizes identical same-terminal seams even when other vessels are interleaved in the global day list", () => {
    const normalizedEvents = normalizeScheduledDockSeams(
      [
        makeEvent({
          Key: "che-arv-shi",
          VesselAbbrev: "CHE",
          SailingDay: "2026-03-13",
          EventType: "arv-dock",
          TerminalAbbrev: "SHI",
          ScheduledDeparture: at(6, 50),
          ScheduledTime: at(7, 5),
        }),
        makeEvent({
          Key: "yak-dep-fhy",
          VesselAbbrev: "YAK",
          SailingDay: "2026-03-13",
          EventType: "dep-dock",
          TerminalAbbrev: "FRH",
          ScheduledDeparture: at(7, 0),
          ScheduledTime: at(7, 0),
        }),
        makeEvent({
          Key: "che-dep-shi",
          VesselAbbrev: "CHE",
          SailingDay: "2026-03-13",
          EventType: "dep-dock",
          TerminalAbbrev: "SHI",
          ScheduledDeparture: at(7, 5),
          ScheduledTime: at(7, 5),
        }),
      ].sort(sortVesselTripEvents)
    );

    expect(
      normalizedEvents.find((event) => event.Key === "che-arv-shi")
        ?.ScheduledTime
    ).toBe(at(7, 0));
    expect(
      normalizedEvents.find((event) => event.Key === "che-dep-shi")
        ?.ScheduledTime
    ).toBe(at(7, 5));
    expect(
      normalizedEvents.find((event) => event.Key === "yak-dep-fhy")
        ?.ScheduledTime
    ).toBe(at(7, 0));
  });

  it("does not adjust dock seams for different terminals or different scheduled times", () => {
    const normalizedEvents = normalizeScheduledDockSeams(
      [
        makeEvent({
          Key: "arv-1",
          EventType: "arv-dock",
          TerminalAbbrev: "ORI",
          ScheduledDeparture: at(16, 15),
          ScheduledTime: at(16, 50),
        }),
        makeEvent({
          Key: "dep-1",
          EventType: "dep-dock",
          TerminalAbbrev: "SHI",
          ScheduledDeparture: at(16, 50),
          ScheduledTime: at(16, 50),
        }),
        makeEvent({
          Key: "arv-2",
          EventType: "arv-dock",
          TerminalAbbrev: "ANA",
          ScheduledDeparture: at(17, 15),
          ScheduledTime: at(17, 44),
        }),
        makeEvent({
          Key: "dep-2",
          EventType: "dep-dock",
          TerminalAbbrev: "ANA",
          ScheduledDeparture: at(17, 50),
          ScheduledTime: at(17, 50),
        }),
      ].sort(sortVesselTripEvents)
    );

    expect(normalizedEvents[0]?.ScheduledTime).toBe(at(16, 50));
    expect(normalizedEvents[2]?.ScheduledTime).toBe(at(17, 44));
  });
});

/**
 * Creates a baseline scheduled trip fixture with optional overrides.
 *
 * @param overrides - Partial trip fields to override in the default fixture
 * @returns A valid scheduled trip fixture for seed and live-update tests
 */
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

const makeRawSegment = (
  overrides: Partial<RawWsfScheduleSegment>
): RawWsfScheduleSegment => ({
  VesselName: "Tokitae",
  DepartingTerminalName: "Seattle",
  ArrivingTerminalName: "Bainbridge Island",
  DepartingTime: new Date(at(8, 35)),
  ArrivingTime: null,
  SailingNotes: "",
  Annotations: [],
  RouteID: 7,
  RouteAbbrev: "sea-bi",
  SailingDay: "2026-03-13",
  ...overrides,
});

/**
 * Creates a baseline vessel location fixture with optional overrides.
 *
 * @param overrides - Partial location fields to override in the default fixture
 * @returns A valid vessel location fixture for live-update tests
 */
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
  DepartingDistance: undefined,
  ArrivingDistance: undefined,
  ...overrides,
});

/**
 * Creates a baseline vessel trip event fixture with optional overrides.
 *
 * @param overrides - Partial event fields to override in the default fixture
 * @returns A valid vessel trip event fixture for sorting tests
 */
const makeEvent = (
  overrides: Partial<
    import("../../../functions/vesselTimeline/eventRecordSchemas").ConvexVesselTimelineEventRecord
  >
) => ({
  Key: "2026-03-13--TOK--2026-03-13--15:35:00.000Z--P52--dep",
  VesselAbbrev: "TOK",
  SailingDay: "2026-03-13",
  ScheduledDeparture: at(8, 35),
  TerminalAbbrev: "P52",
  EventType: "dep-dock" as const,
  ScheduledTime: at(8, 35),
  PredictedTime: undefined,
  ActualTime: undefined,
  ...overrides,
});
