import type { ConvexInferredScheduledSegment } from "domain/events/scheduled/schemas";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import type { UpdateVesselTripDbAccess } from "../../types";

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
  AtDockObserved: overrides.AtDockObserved ?? true,
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
      ReadonlyArray<ConvexScheduledDockEvent>
    >;
    terminalsByAbbrev?: Record<string, TerminalIdentity | null>;
  } = {}
): UpdateVesselTripDbAccess => ({
  getTerminalIdentity: async (terminalAbbrev) =>
    Object.hasOwn(options.terminalsByAbbrev ?? {}, terminalAbbrev)
      ? (options.terminalsByAbbrev?.[terminalAbbrev] ?? null)
      : makeTerminalIdentity(terminalAbbrev),
  getScheduledDepartureEvent: async (scheduleKey) => {
    const segment = (options.segments ?? []).find(
      (candidate) => candidate.Key === scheduleKey
    );
    if (!segment) {
      return null;
    }
    return scheduledDepartureRowFromSegment(segment, "CHE");
  },
  getScheduledDockEvents: async (vesselAbbrev, sailingDay) =>
    sailingDay !== (options.sailingDay ?? "2026-03-13")
      ? []
      : (options.scheduledDeparturesByVesselAbbrev?.[vesselAbbrev] ??
        (options.segments ?? [])
          .filter((segment) => segment.SailingDay === sailingDay)
          .flatMap((segment) => {
            const rows: ConvexScheduledDockEvent[] = [
              scheduledDepartureRowFromSegment(segment, vesselAbbrev),
            ];

            if (segment.NextKey && segment.NextDepartingTime) {
              const [nextDepartingTerminalAbbrev, nextArrivingTerminalAbbrev] =
                parseRouteTerminalsFromSegmentKey(segment.NextKey);
              rows.push({
                Key: `${segment.NextKey}--dep-dock`,
                VesselAbbrev: vesselAbbrev,
                SailingDay: segment.SailingDay,
                UpdatedAt: 1,
                ScheduledDeparture: segment.NextDepartingTime,
                TerminalAbbrev: nextDepartingTerminalAbbrev ?? "UNK",
                NextTerminalAbbrev: nextArrivingTerminalAbbrev ?? "UNK",
                EventType: "dep-dock",
              });
            }

            return rows;
          })),
});

export const makeTerminalIdentity = (
  terminalAbbrev = "CLI",
  overrides: Partial<TerminalIdentity> = {}
): TerminalIdentity => ({
  TerminalID: 1,
  TerminalName: terminalAbbrev,
  TerminalAbbrev: terminalAbbrev,
  IsPassengerTerminal: true,
  Latitude: 47.98,
  Longitude: -122.35,
  UpdatedAt: 1,
  ...overrides,
});

const scheduledDepartureRowFromSegment = (
  segment: ConvexInferredScheduledSegment,
  vesselAbbrev: string
): ConvexScheduledDockEvent => ({
  Key: `${segment.Key}--dep-dock`,
  VesselAbbrev: vesselAbbrev,
  SailingDay: segment.SailingDay,
  UpdatedAt: 1,
  ScheduledDeparture: segment.DepartingTime,
  TerminalAbbrev: segment.DepartingTerminalAbbrev,
  NextTerminalAbbrev: segment.ArrivingTerminalAbbrev,
  EventType: "dep-dock",
});

const parseRouteTerminalsFromSegmentKey = (
  segmentKey: string
): [string | undefined, string | undefined] => {
  const [_vessel, _date, _time, route] = segmentKey.split("--");
  const [departingTerminal, arrivingTerminal] = (route ?? "").split("-");
  return [departingTerminal, arrivingTerminal];
};
