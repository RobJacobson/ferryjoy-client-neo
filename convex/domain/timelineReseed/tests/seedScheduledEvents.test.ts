import { describe, expect, it } from "bun:test";
import type { TerminalIdentity, VesselIdentity } from "../../../adapters/wsf";
import type { RawWsfScheduleSegment } from "../../../adapters/wsf/scheduledTrips";
import type { ConvexVesselLocation } from "../../../functions/vesselLocation/schemas";
import type { ConvexVesselTimelineEventRecord } from "../../../functions/vesselTimeline/schemas";
import { buildBoundaryKey, buildSegmentKey } from "../../../shared/keys";
import { normalizeScheduledDockSeams } from "../normalizeEventRecords";
import { buildActualDockWritesFromLocation } from "../reconcileLiveLocations";
import { buildSeedVesselTripEventsFromRawSegments } from "../seedScheduledEvents";

const at = (hours: number, minutes: number) =>
  Date.UTC(2026, 2, 13, hours + 7, minutes);

const backendVessels: VesselIdentity[] = [
  { VesselID: 8, VesselName: "Issaquah", VesselAbbrev: "ISS" },
  { VesselID: 64, VesselName: "Tokitae", VesselAbbrev: "TOK" },
];

const backendTerminals: TerminalIdentity[] = [
  { TerminalID: 1, TerminalName: "Anacortes", TerminalAbbrev: "ANA" },
  { TerminalID: 2, TerminalName: "Bainbridge Island", TerminalAbbrev: "BBI" },
  { TerminalID: 3, TerminalName: "Bremerton", TerminalAbbrev: "BRE" },
  { TerminalID: 4, TerminalName: "Seattle", TerminalAbbrev: "P52" },
  { TerminalID: 5, TerminalName: "Orcas Island", TerminalAbbrev: "ORI" },
  { TerminalID: 6, TerminalName: "Shaw Island", TerminalAbbrev: "SHI" },
];

describe("buildSeedVesselTripEventsFromRawSegments", () => {
  it("builds dep/arv rows for direct raw schedule segments", () => {
    const events = buildSeedVesselTripEventsFromRawSegments(
      [
        makeRawSegment({
          VesselName: "Tokitae",
          DepartingTerminalName: "Seattle",
          ArrivingTerminalName: "Bainbridge Island",
          DepartingTime: new Date(at(8, 35)),
          RouteID: 7,
          RouteAbbrev: "sea-bi",
        }),
      ],
      backendVessels,
      backendTerminals
    );

    const segmentKey = buildSegmentKey(
      "TOK",
      "P52",
      "BBI",
      new Date(at(8, 35))
    );

    expect(events.map((event) => event.EventType)).toEqual([
      "dep-dock",
      "arv-dock",
    ]);
    expect(events[0]?.Key).toBe(
      buildBoundaryKey(segmentKey as string, "dep-dock")
    );
    expect(events[1]?.Key).toBe(
      buildBoundaryKey(segmentKey as string, "arv-dock")
    );
    expect(events[1]?.EventScheduledTime).toBe(at(9, 10));
  });

  it("filters indirect raw schedule segments before seeding", () => {
    const events = buildSeedVesselTripEventsFromRawSegments(
      [
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
      ],
      backendVessels,
      backendTerminals
    );

    expect(events).toHaveLength(4);
    expect(events.some((event) => event.TerminalAbbrev === "BRE")).toBe(false);
  });
});

describe("normalizeScheduledDockSeams", () => {
  it("expands zero-length dock seams into a five-minute interval", () => {
    const events = normalizeScheduledDockSeams([
      makeEvent({
        SegmentKey: "seg-a",
        Key: "seg-a--arv-dock",
        EventType: "arv-dock",
        TerminalAbbrev: "SHI",
        ScheduledDeparture: at(8, 30),
        EventScheduledTime: at(9, 10),
      }),
      makeEvent({
        SegmentKey: "seg-b",
        Key: "seg-b--dep-dock",
        EventType: "dep-dock",
        TerminalAbbrev: "SHI",
        ScheduledDeparture: at(9, 10),
        EventScheduledTime: at(9, 10),
      }),
    ]);

    expect(events[0]?.EventScheduledTime).toBe(at(9, 5));
    expect(events[1]?.EventScheduledTime).toBe(at(9, 10));
  });
});

describe("buildActualDockWritesFromLocation", () => {
  it("emits a departure patch when telemetry proves departure", () => {
    const patches = buildActualDockWritesFromLocation(
      [
        makeEvent({
          SegmentKey: "TOK--2026-03-13--08:35--P52-BBI",
          Key: "TOK--2026-03-13--08:35--P52-BBI--dep-dock",
          EventType: "dep-dock",
          ScheduledDeparture: at(8, 35),
          TerminalAbbrev: "P52",
        }),
        makeEvent({
          SegmentKey: "TOK--2026-03-13--08:35--P52-BBI",
          Key: "TOK--2026-03-13--08:35--P52-BBI--arv-dock",
          EventType: "arv-dock",
          ScheduledDeparture: at(8, 35),
          TerminalAbbrev: "BBI",
          EventScheduledTime: at(9, 10),
        }),
      ],
      makeLocation({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "P52",
        ArrivingTerminalAbbrev: "BBI",
        ScheduledDeparture: at(8, 35),
        TimeStamp: at(8, 50),
        AtDock: false,
        Speed: 12,
      })
    );

    expect(patches).toEqual([
      {
        SegmentKey: "TOK--2026-03-13--08:35--P52-BBI",
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

  it("emits an arrival patch when telemetry proves arrival", () => {
    const patches = buildActualDockWritesFromLocation(
      [
        makeEvent({
          SegmentKey: "seg-1",
          Key: "seg-1--dep-dock",
          EventType: "dep-dock",
          ScheduledDeparture: at(8, 35),
          TerminalAbbrev: "P52",
        }),
        makeEvent({
          SegmentKey: "seg-1",
          Key: "seg-1--arv-dock",
          EventType: "arv-dock",
          ScheduledDeparture: at(8, 35),
          TerminalAbbrev: "BBI",
          EventScheduledTime: at(9, 10),
        }),
        makeEvent({
          SegmentKey: "seg-2",
          Key: "seg-2--dep-dock",
          EventType: "dep-dock",
          ScheduledDeparture: at(9, 20),
          TerminalAbbrev: "BBI",
          EventScheduledTime: at(9, 20),
        }),
        makeEvent({
          SegmentKey: "seg-2",
          Key: "seg-2--arv-dock",
          EventType: "arv-dock",
          ScheduledDeparture: at(9, 20),
          TerminalAbbrev: "P52",
          EventScheduledTime: at(9, 55),
        }),
      ],
      makeLocation({
        VesselAbbrev: "TOK",
        DepartingTerminalAbbrev: "BBI",
        ArrivingTerminalAbbrev: "P52",
        ScheduledDeparture: at(9, 20),
        TimeStamp: at(9, 18),
        AtDock: true,
        Speed: 0,
      })
    );

    expect(patches).toEqual([
      {
        SegmentKey: "seg-1",
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
});

const makeEvent = (
  overrides: Partial<ConvexVesselTimelineEventRecord>
): ConvexVesselTimelineEventRecord => ({
  SegmentKey: "seg-1",
  Key: "seg-1--dep-dock",
  VesselAbbrev: "TOK",
  SailingDay: "2026-03-13",
  ScheduledDeparture: at(8, 35),
  TerminalAbbrev: "P52",
  EventType: "dep-dock",
  EventScheduledTime: at(8, 35),
  EventPredictedTime: undefined,
  EventOccurred: undefined,
  EventActualTime: undefined,
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
