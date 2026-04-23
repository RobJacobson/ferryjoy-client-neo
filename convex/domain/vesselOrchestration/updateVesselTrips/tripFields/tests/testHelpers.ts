import type { ConvexInferredScheduledSegment } from "domain/events/scheduled/schemas";
import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared/scheduleContinuity";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";

export const ms = (iso: string) => new Date(iso).getTime();

export const makeLocation = (
  overrides: Partial<ConvexVesselLocation> = {}
): ConvexVesselLocation => ({
  VesselID: 1,
  VesselName: "Chelan",
  VesselAbbrev: "CHE",
  DepartingTerminalID: 1,
  DepartingTerminalName: "Clinton",
  DepartingTerminalAbbrev: "CLI",
  ArrivingTerminalID: 2,
  ArrivingTerminalName: "Mukilteo",
  ArrivingTerminalAbbrev: "MUK",
  Latitude: 47.98,
  Longitude: -122.35,
  Speed: 0,
  Heading: 0,
  InService: true,
  AtDock: true,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
  RouteAbbrev: "muk-cl",
  VesselPositionNum: 1,
  TimeStamp: ms("2026-03-13T11:08:00-07:00"),
  ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
  DepartingDistance: 0,
  ArrivingDistance: undefined,
  ...overrides,
});

export const makeTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "CLI",
  ArrivingTerminalAbbrev: "MUK",
  RouteAbbrev: "muk-cl",
  TripKey: generateTripKey("CHE", ms("2026-03-13T11:08:00-07:00")),
  ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "MUK",
  ArriveDest: undefined,
  AtDockActual: ms("2026-03-13T10:30:00-07:00"),
  TripStart: ms("2026-03-13T10:30:00-07:00"),
  AtDock: true,
  AtDockDuration: undefined,
  ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
  LeftDock: undefined,
  LeftDockActual: undefined,
  TripDelay: undefined,
  Eta: undefined,
  NextScheduleKey: undefined,
  NextScheduledDeparture: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T11:08:00-07:00"),
  PrevScheduledDeparture: ms("2026-03-13T09:30:00-07:00"),
  PrevLeftDock: ms("2026-03-13T09:34:00-07:00"),
  ...overrides,
});

export const makeScheduledSegment = (
  overrides: Partial<ConvexInferredScheduledSegment> = {}
): ConvexInferredScheduledSegment => ({
  Key: "CHE--2026-03-13--11:00--CLI-MUK",
  SailingDay: "2026-03-13",
  DepartingTerminalAbbrev: "CLI",
  ArrivingTerminalAbbrev: "MUK",
  DepartingTime: ms("2026-03-13T11:00:00-07:00"),
  NextKey: undefined,
  NextDepartingTime: undefined,
  ...overrides,
});

export const makeScheduledTables = (
  options: {
    sailingDay?: string;
    segments?: ConvexInferredScheduledSegment[];
    scheduledDeparturesByVesselAbbrev?: Record<
      string,
      ReadonlyArray<{
        Key: string;
        ScheduledDeparture: number;
        TerminalAbbrev: string;
      }>
    >;
  } = {}
): ScheduledSegmentTables => ({
  getScheduledSegmentByKey: async (scheduleKey) =>
    (options.segments ?? []).find((segment) => segment.Key === scheduleKey) ??
    null,
  getScheduledDeparturesForVesselAndSailingDay: async (
    vesselAbbrev,
    sailingDay
  ) =>
    sailingDay !== (options.sailingDay ?? "2026-03-13")
      ? []
      : (options.scheduledDeparturesByVesselAbbrev?.[vesselAbbrev] ?? []),
});
