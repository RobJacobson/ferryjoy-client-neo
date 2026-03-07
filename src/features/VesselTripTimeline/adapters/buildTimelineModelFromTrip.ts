/**
 * Builds a pure timeline data model from vessel trip domain data.
 * This module intentionally contains no JSX so timeline business logic can be
 * read/tested independently from rendering concerns.
 */

import { config, formatTerminalPairKey } from "convex/domain/ml/shared/config";
import { clamp } from "@/shared/utils";
import type {
  VesselTripTimelineItem,
  VesselTripTimelineRowModel,
} from "../types";
import {
  buildTimePoint,
  getLeftContentKind,
  getMinutesUntilLabel,
  getRightContentKind,
  getTerminalNameAtDestination,
  getTerminalNameAtOrigin,
} from "../utils";

const MIN_SEGMENT_MINUTES = 1;
const DEFAULT_ARRIVAL_MINUTES = 10;

/**
 * Parses a trip key to extract the departing terminal abbreviation.
 * Key format: [VesselAbbrev]--[PacificDate]--[PacificTime]--[Departing]-[Arriving]
 * Example: "KITT--2026-03-04--14:30--CLI-MUK"
 *
 * @param key - Trip key to parse
 * @returns Departing terminal abbreviation, or undefined if parsing fails
 */
const parseDepartingTerminalFromKey = (
  key: string | undefined
): string | undefined => {
  if (!key) return undefined;
  const parts = key.split("--");
  if (parts.length < 4) return undefined;
  const terminalPair = parts[3]; // Last part: "CLI-MUK"
  const terminals = terminalPair.split("-");
  return terminals[0]; // Departing terminal: "CLI"
};

/**
 * Builds a timeline data model for a single vessel trip card.
 * Produces 3 rows: at-dock (origin) | at-sea | at-dock (destination).
 *
 * @param item - Vessel trip and location pair
 * @param now - Current time used for progress calculations
 * @returns Pure timeline model rows for timeline rendering
 */
export const buildTimelineModelFromTrip = (
  item: VesselTripTimelineItem,
  now: Date = new Date()
): VesselTripTimelineRowModel[] => {
  const { trip, vesselLocation } = item;
  const times = buildSegmentTimes(item, now);
  const atSeaPercent = getAtSeaPercent(
    times.departedAt,
    times.arriveEta,
    trip,
    vesselLocation,
    now
  );
  const departureLabel = getMinutesUntilLabel(times.departedAtActual, now);
  const inTransitLabel = getMinutesUntilLabel(times.arriveEtaActual, now);
  const departDestLabel = getMinutesUntilLabel(times.predictedDepartDest, now);

  const useDistanceProgress =
    vesselLocation.DepartingDistance !== undefined &&
    vesselLocation.ArrivingDistance !== undefined &&
    vesselLocation.DepartingDistance + vesselLocation.ArrivingDistance > 0;

  const schedArriveCurr =
    trip.ScheduledTrip?.SchedArriveCurr ?? times.departWindowStart;
  const schedDeparture = trip.ScheduledDeparture ?? times.departWindowStart;
  const schedDepartNext =
    trip.ScheduledTrip?.NextDepartingTime ?? times.departDestTime;

  const schedArriveNext =
    trip.ScheduledTrip?.SchedArriveNext ??
    trip.ScheduledTrip?.ArrivingTime ??
    times.arriveEta;

  const rows: VesselTripTimelineRowModel[] = [
    {
      id: `${trip.VesselAbbrev}-at-dock-origin`,
      kind: "at-dock",
      startTime: times.departWindowStart,
      endTime: times.departedAt,
      percentComplete: trip.LeftDock ? 1 : 0,
      indicatorLabel: departureLabel,
      eventTimeStart: buildTimePoint(
        schedArriveCurr,
        trip.TripStart,
        undefined
      ),
      eventTimeEnd: buildTimePoint(
        schedDeparture,
        trip.LeftDock,
        trip.AtDockDepartCurr?.PredTime
      ),
      terminalName: getTerminalNameAtOrigin(vesselLocation),
      leftContentKind: getLeftContentKind("at-dock"),
      rightContentKind: getRightContentKind("at-dock"),
    },
    {
      id: `${trip.VesselAbbrev}-at-sea`,
      kind: "at-sea",
      startTime: times.departedAt,
      endTime: times.arriveEta,
      percentComplete: atSeaPercent,
      indicatorLabel: inTransitLabel,
      eventTimeStart: buildTimePoint(
        schedDeparture,
        trip.LeftDock,
        trip.AtDockDepartCurr?.PredTime
      ),
      eventTimeEnd: buildTimePoint(
        schedArriveNext,
        trip.TripEnd,
        trip.Eta ?? vesselLocation.Eta
      ),
      leftContentKind: getLeftContentKind("at-sea"),
      rightContentKind: getRightContentKind("at-sea"),
      useDistanceProgress,
    },
    {
      id: `${trip.VesselAbbrev}-at-dock-dest`,
      kind: "at-dock",
      startTime: times.tripEnd,
      endTime: times.departDestTime,
      percentComplete: 0,
      indicatorLabel: departDestLabel,
      eventTimeStart: buildTimePoint(schedArriveNext, trip.TripEnd, undefined),
      eventTimeEnd: buildTimePoint(
        schedDepartNext,
        trip.AtDockDepartNext?.Actual,
        trip.AtDockDepartNext?.PredTime ?? trip.AtSeaDepartNext?.PredTime
      ),
      terminalName: getTerminalNameAtDestination(vesselLocation),
      leftContentKind: getLeftContentKind("at-dock"),
      rightContentKind: getRightContentKind("at-dock"),
      minHeight: 0,
    },
  ];

  return rows;
};

type SegmentTimes = {
  departWindowStart: Date;
  departedAt: Date;
  departedAtActual: Date | undefined;
  arriveEta: Date;
  arriveEtaActual: Date | undefined;
  tripEnd: Date;
  departDestTime: Date;
  predictedDepartDest: Date | undefined;
};

/**
 * Resolves timeline segment boundaries from trip/location timestamps.
 *
 * @param item - Vessel trip and location pair
 * @param now - Current time for active trip fallback values
 * @returns Coherent segment times with monotonic ordering
 */
const buildSegmentTimes = (
  item: VesselTripTimelineItem,
  now: Date
): SegmentTimes => {
  const { trip, vesselLocation } = item;
  const arrivingTerminal = trip.ArrivingTerminalAbbrev;
  const terminalPairKey = arrivingTerminal
    ? formatTerminalPairKey(trip.DepartingTerminalAbbrev, arrivingTerminal)
    : "";
  const defaultAtDockMinutes = config.getMeanAtDockDuration(terminalPairKey);
  const defaultAtSeaMinutes = config.getMeanAtSeaDuration(terminalPairKey);

  // Build raw segment times using cascading fallbacks for missing data
  // Actual/predicted times are tracked separately from geometry fallbacks
  const rawDepartWindowStart =
    trip.TripStart ??
    trip.ScheduledDeparture ??
    vesselLocation.ScheduledDeparture ??
    now;
  const departedAtActual =
    vesselLocation.LeftDock ?? trip.LeftDock ?? trip.AtDockDepartCurr?.PredTime;
  const rawDepartedAt = departedAtActual; // Use actual/predicted for geometry
  const arriveEtaActual = trip.Eta ?? vesselLocation.Eta;
  const rawArriveEta =
    arriveEtaActual ??
    (rawDepartedAt !== undefined
      ? addMinutes(rawDepartedAt, defaultAtSeaMinutes)
      : undefined);
  const tripEndActual = trip.TripEnd;

  // Parse NextKey to get next leg's departing terminal
  const nextDepartingTerminal = parseDepartingTerminalFromKey(
    trip.ScheduledTrip?.NextKey
  );

  // Determine terminal pair for ML config fallback (B->C)
  const nextTerminalPairKey =
    arrivingTerminal && nextDepartingTerminal
      ? formatTerminalPairKey(arrivingTerminal, nextDepartingTerminal)
      : terminalPairKey;

  const rawDepartDest =
    trip.AtDockDepartNext?.PredTime ?? trip.ScheduledTrip?.NextDepartingTime;
  const predictedDepartDest = trip.AtDockDepartNext?.PredTime;

  const departWindowStart = new Date(rawDepartWindowStart);
  const departedAt = ensureAfter(
    rawDepartedAt,
    departWindowStart,
    defaultAtDockMinutes
  );
  const arriveEta = ensureAfter(rawArriveEta, departedAt, defaultAtSeaMinutes);
  const tripEnd = ensureAfter(
    tripEndActual,
    arriveEta,
    DEFAULT_ARRIVAL_MINUTES
  );

  const departDestTime = ensureAfter(
    rawDepartDest ?? undefined,
    tripEnd,
    config.getMeanAtDockDuration(nextTerminalPairKey)
  );

  return {
    departWindowStart,
    departedAt,
    departedAtActual,
    arriveEta,
    arriveEtaActual,
    tripEnd,
    departDestTime,
    predictedDepartDest,
  };
};

/**
 * Calculates the completion ratio for the at-sea segment.
 * Uses distance-based progress when vesselLocation has distance data.
 *
 * @param departedAt - Segment start timestamp
 * @param arriveEta - Segment end timestamp
 * @param trip - Vessel trip with completion markers
 * @param vesselLocation - Real-time vessel location for distance-based progress
 * @param now - Current time used for time-based progress
 * @returns Normalized completion value from 0 to 1
 */
const getAtSeaPercent = (
  departedAt: Date,
  arriveEta: Date,
  trip: VesselTripTimelineItem["trip"],
  vesselLocation: VesselTripTimelineItem["vesselLocation"],
  now: Date
): number => {
  if (!trip.LeftDock) return 0;
  if (trip.TripEnd) return 1;

  // Prefer distance-based progress when telemetry is available
  const departing = vesselLocation.DepartingDistance;
  const arriving = vesselLocation.ArrivingDistance;
  if (
    departing !== undefined &&
    arriving !== undefined &&
    departing + arriving > 0
  ) {
    const ratio = departing / (departing + arriving);
    return clamp(ratio, 0, 1);
  }

  // Fallback to time-based progress
  const duration = arriveEta.getTime() - departedAt.getTime();
  if (duration <= 0) return 0;
  const elapsed = now.getTime() - departedAt.getTime();
  return clamp(elapsed / duration, 0, 1);
};

/**
 * Ensures a timestamp is strictly after an anchor with a fallback offset.
 *
 * @param value - Candidate timestamp (undefined uses fallback)
 * @param anchor - Reference timestamp
 * @param fallbackMinutes - Offset applied if value is not after anchor
 * @returns Timestamp that is at least fallback minutes after anchor
 */
const ensureAfter = (
  value: Date | undefined,
  anchor: Date,
  fallbackMinutes: number
): Date => {
  if (value === undefined) {
    return addMinutes(anchor, Math.max(MIN_SEGMENT_MINUTES, fallbackMinutes));
  }
  if (value.getTime() > anchor.getTime()) return new Date(value);
  return addMinutes(anchor, Math.max(MIN_SEGMENT_MINUTES, fallbackMinutes));
};

/**
 * Adds minutes to a Date and returns a new Date instance.
 *
 * @param value - Base timestamp
 * @param minutes - Minutes to add
 * @returns Shifted Date
 */
const addMinutes = (value: Date, minutes: number): Date =>
  new Date(value.getTime() + minutes * 60000);
