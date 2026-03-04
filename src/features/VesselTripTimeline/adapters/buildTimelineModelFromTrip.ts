/**
 * Builds a pure timeline data model from vessel trip domain data.
 * This module intentionally contains no JSX so timeline business logic can be
 * read/tested independently from rendering concerns.
 */

import { config, formatTerminalPairKey } from "convex/domain/ml/shared/config";
import type {
  VesselTripTimelineItem,
  VesselTripTimelineRowModel,
} from "../types";

const MIN_SEGMENT_MINUTES = 1;
const DEFAULT_ARRIVAL_MINUTES = 10;

/**
 * Builds a timeline data model for a single vessel trip card.
 *
 * @param item - Vessel trip and location pair
 * @param now - Current time used for progress calculations
 * @returns Pure timeline model rows for timeline rendering
 */
export const buildTimelineModelFromTrip = (
  item: VesselTripTimelineItem,
  now: Date = new Date()
): VesselTripTimelineRowModel[] => {
  const { trip } = item;
  const times = buildSegmentTimes(item, now);
  const atSeaPercent = getAtSeaPercent(
    times.departedAt,
    times.arriveEta,
    trip,
    now
  );
  const departureLabel = getMinutesUntilLabel(times.departedAtActual, now);
  const inTransitLabel = getMinutesUntilLabel(times.arriveEtaActual, now);
  const arrivalLabel = "--";

  // Build three segment models:
  // 1) pre-departure at start terminal
  // 2) in-transit at sea
  // 3) arrival at destination terminal
  // UI component selection/layout is attached later in render-layer mapping.

  const rows: VesselTripTimelineRowModel[] = [
    {
      id: `${trip.VesselAbbrev}-depart`,
      startTime: times.departWindowStart,
      endTime: times.departedAt,
      percentComplete: trip.LeftDock ? 1 : 0,
      phase: "at-start",
      indicatorLabel: departureLabel,
    },
    {
      id: `${trip.VesselAbbrev}-at-sea`,
      startTime: times.departedAt,
      endTime: times.arriveEta,
      percentComplete: atSeaPercent,
      phase: "at-sea",
      indicatorLabel: inTransitLabel,
    },
    {
      id: `${trip.VesselAbbrev}-arrive`,
      startTime: times.arriveEta,
      endTime: times.tripEnd,
      percentComplete: trip.TripEnd ? 1 : 0,
      phase: "at-dest",
      indicatorLabel: arrivalLabel,
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
  const tripEndActual =
    trip.TripEnd ??
    trip.AtSeaArriveNext?.PredTime ??
    trip.AtDockArriveNext?.PredTime;

  // Ensure monotonic ordering with minimum segment durations
  // Geometry uses historical averages when actual/predicted data is missing

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

  return {
    departWindowStart,
    departedAt,
    departedAtActual,
    arriveEta,
    arriveEtaActual,
    tripEnd,
  };
};

/**
 * Calculates the completion ratio for the at-sea segment.
 *
 * @param departedAt - Segment start timestamp
 * @param arriveEta - Segment end timestamp
 * @param trip - Vessel trip with completion markers
 * @param now - Current time used for active progress
 * @returns Normalized completion value from 0 to 1
 */
const getAtSeaPercent = (
  departedAt: Date,
  arriveEta: Date,
  trip: VesselTripTimelineItem["trip"],
  now: Date
): number => {
  if (!trip.LeftDock) return 0;
  if (trip.TripEnd) return 1;

  // Calculate elapsed time ratio for in-transit progress
  const duration = arriveEta.getTime() - departedAt.getTime();
  if (duration <= 0) return 0;
  const elapsed = now.getTime() - departedAt.getTime();
  return clamp01(elapsed / duration);
};

/**
 * Produces a short minutes-until label for indicator content.
 * Uses actual/predicted times only; returns "--" for missing data.
 *
 * @param targetTime - Target timestamp (undefined means no data available)
 * @param now - Current time
 * @returns Remaining minutes label or "--" if no data
 */
const getMinutesUntilLabel = (
  targetTime: Date | undefined,
  now: Date
): string => {
  if (targetTime === undefined) {
    return "--";
  }
  // Calculate remaining minutes with ceiling for display
  const remainingMs = targetTime.getTime() - now.getTime();
  const remainingMinutes = Math.max(0, Math.ceil(remainingMs / 60000));
  return `${remainingMinutes}m`;
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

/**
 * Clamps a number to the inclusive range [0, 1].
 *
 * @param value - Raw ratio
 * @returns Clamped ratio
 */
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
