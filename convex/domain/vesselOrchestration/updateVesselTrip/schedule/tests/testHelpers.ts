/**
 * Test fixtures for updateVesselTrip schedule-resolution suites.
 *
 * These helpers produce stable location, trip, segment, and DB-access doubles
 * so tests can exercise continuity and schedule-table fallback behavior without
 * touching Convex runtime APIs.
 */

import type { ConvexInferredScheduledSegment } from "domain/events/scheduled";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { addDaysToYyyyMmDd, getSailingDay } from "shared/time";
import type { UpdateVesselTripDbAccess } from "../../types";

/**
 * Converts an ISO date-time string into epoch milliseconds.
 *
 * @param iso - ISO-8601 date-time string
 * @returns Epoch-millisecond timestamp
 */
export const ms = (iso: string) => new Date(iso).getTime();

/**
 * Builds a vessel-location fixture with optional field overrides.
 *
 * @param overrides - Partial location fields that replace fixture defaults
 * @returns Complete location row used by schedule tests
 */
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

/**
 * Builds an active-trip fixture with optional field overrides.
 *
 * @param overrides - Partial trip fields that replace fixture defaults
 * @returns Complete trip row used by continuity tests
 */
export const makeTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "CLI",
  ArrivingTerminalAbbrev: "MUK",
  RouteAbbrev: "muk-cl",
  TripKey: "CHE--2026-03-13--11:00--CLI-MUK",
  ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "MUK",
  TripEnd: undefined,
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
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T11:08:00-07:00"),
  PrevScheduledDeparture: ms("2026-03-13T09:30:00-07:00"),
  PrevLeftDock: ms("2026-03-13T09:34:00-07:00"),
  ...overrides,
});

/**
 * Builds an inferred scheduled-segment fixture with optional overrides.
 *
 * @param overrides - Partial segment fields that replace fixture defaults
 * @returns Inferred segment used by schedule-resolution tests
 */
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

/**
 * Creates a schedule DB-access test double for continuity resolution.
 *
 * @param options - Optional sailing-day, segment, and dock-event fixture inputs
 * @returns UpdateVesselTripDbAccess implementation backed by in-memory fixtures
 */
export const makeScheduledTables = (
  options: {
    sailingDay?: string;
    segments?: ConvexInferredScheduledSegment[];
    scheduledDeparturesByVesselAbbrev?: Record<
      string,
      ReadonlyArray<ConvexScheduledDockEvent>
    >;
  } = {}
): UpdateVesselTripDbAccess => ({
  getScheduledSegmentByScheduleKey: async (scheduleKey) =>
    (options.segments ?? []).find(
      (candidate) => candidate.Key === scheduleKey
    ) ?? null,
  getScheduleRolloverDockEvents: async ({ vesselAbbrev, timestamp }) => {
    const currentSailingDay = getSailingDay(new Date(timestamp));
    const nextSailingDay = addDaysToYyyyMmDd(currentSailingDay, 1);
    return {
      currentSailingDay,
      currentDayEvents: scheduledRowsForSailingDay({
        vesselAbbrev,
        sailingDay: currentSailingDay,
        options,
      }),
      nextSailingDay,
      nextDayEvents: scheduledRowsForSailingDay({
        vesselAbbrev,
        sailingDay: nextSailingDay,
        options,
      }),
    };
  },
});

/**
 * Converts one inferred segment into a scheduled dep-dock event row.
 *
 * @param segment - Inferred segment carrying departure and route details
 * @param vesselAbbrev - Vessel abbreviation for the generated event row
 * @returns Scheduled departure event compatible with schedule lookup helpers
 */
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

/**
 * Builds one sailing-day event pool for a vessel from overrides or segments.
 *
 * @param args - Vessel and sailing-day scope plus fixture source options
 * @returns Scheduled dock-event rows for the requested service-day pool
 */
const scheduledRowsForSailingDay = ({
  vesselAbbrev,
  sailingDay,
  options,
}: {
  vesselAbbrev: string;
  sailingDay: string;
  options: {
    sailingDay?: string;
    segments?: ConvexInferredScheduledSegment[];
    scheduledDeparturesByVesselAbbrev?: Record<
      string,
      ReadonlyArray<ConvexScheduledDockEvent>
    >;
  };
}) => {
  const fromOverride =
    options.scheduledDeparturesByVesselAbbrev?.[vesselAbbrev];
  if (fromOverride !== undefined) {
    return fromOverride.filter((row) => row.SailingDay === sailingDay);
  }
  if (sailingDay !== (options.sailingDay ?? "2026-03-13")) {
    return [];
  }
  return (options.segments ?? [])
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
    });
};

/**
 * Parses departing and arriving terminal abbreviations from a segment key.
 *
 * @param segmentKey - Canonical segment key string
 * @returns Departing and arriving terminal abbreviations, when present
 */
const parseRouteTerminalsFromSegmentKey = (
  segmentKey: string
): [string | undefined, string | undefined] => {
  const [_vessel, _date, _time, route] = segmentKey.split("--");
  const [departingTerminal, arrivingTerminal] = (route ?? "").split("-");
  return [departingTerminal, arrivingTerminal];
};
