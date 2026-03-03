/**
 * Builds a pure timeline data model from vessel trip domain data.
 * This module intentionally contains no JSX so timeline business logic can be
 * read/tested independently from rendering concerns.
 */

import type {
  VesselTripTimelineItem,
  VesselTripTimelineRowModel,
} from "../types";

const MIN_SEGMENT_MINUTES = 1;
const DEFAULT_DOCK_MINUTES = 12;
const DEFAULT_AT_SEA_MINUTES = 45;
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
  const departureLabel = getMinutesUntilLabel(times.departedAt, now);
  const inTransitLabel = getMinutesUntilLabel(times.arriveEta, now);
  const arrivalLabel = "--";

  // Build three segment models:
  // 1) pre-departure at dock
  // 2) in-transit at sea
  // 3) arrival/docking
  // UI component selection/layout is attached later in render-layer mapping.

  const rows: VesselTripTimelineRowModel[] = [
    {
      id: `${trip.VesselAbbrev}-depart`,
      startTime: times.departWindowStart,
      endTime: times.departedAt,
      percentComplete: trip.LeftDock ? 1 : 0,
      phase: "departure",
      indicatorLabel: departureLabel,
    },
    {
      id: `${trip.VesselAbbrev}-at-sea`,
      startTime: times.departedAt,
      endTime: times.arriveEta,
      percentComplete: atSeaPercent,
      phase: "transit",
      indicatorLabel: inTransitLabel,
    },
    {
      id: `${trip.VesselAbbrev}-arrive`,
      startTime: times.arriveEta,
      endTime: times.tripEnd,
      percentComplete: trip.TripEnd ? 1 : 0,
      phase: "arrival",
      indicatorLabel: arrivalLabel,
    },
  ];

  return rows;
};

type SegmentTimes = {
  departWindowStart: Date;
  departedAt: Date;
  arriveEta: Date;
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
  // Build raw segment times using cascading fallbacks for missing data
  const rawDepartWindowStart =
    trip.TripStart ??
    trip.ScheduledDeparture ??
    vesselLocation.ScheduledDeparture ??
    now;
  const rawDepartedAt =
    trip.LeftDock ??
    vesselLocation.LeftDock ??
    addMinutes(rawDepartWindowStart, 8);
  const rawArriveEta =
    trip.Eta ??
    vesselLocation.Eta ??
    addMinutes(rawDepartedAt, DEFAULT_AT_SEA_MINUTES);
  const rawTripEnd =
    trip.TripEnd ??
    (trip.AtDock ? now : addMinutes(rawArriveEta, DEFAULT_ARRIVAL_MINUTES));

  // Ensure monotonic ordering with minimum segment durations

  const departWindowStart = new Date(rawDepartWindowStart);
  const departedAt = ensureAfter(
    rawDepartedAt,
    departWindowStart,
    DEFAULT_DOCK_MINUTES
  );
  const arriveEta = ensureAfter(
    rawArriveEta,
    departedAt,
    DEFAULT_AT_SEA_MINUTES
  );
  const tripEnd = ensureAfter(rawTripEnd, arriveEta, DEFAULT_ARRIVAL_MINUTES);

  return { departWindowStart, departedAt, arriveEta, tripEnd };
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
 *
 * @param targetTime - Target timestamp
 * @param now - Current time
 * @returns Remaining minutes label
 */
const getMinutesUntilLabel = (targetTime: Date, now: Date): string => {
  // Calculate remaining minutes with ceiling for display
  const remainingMs = targetTime.getTime() - now.getTime();
  const remainingMinutes = Math.max(0, Math.ceil(remainingMs / 60000));
  return `${remainingMinutes}m`;
};

/**
 * Ensures a timestamp is strictly after an anchor with a fallback offset.
 *
 * @param value - Candidate timestamp
 * @param anchor - Reference timestamp
 * @param fallbackMinutes - Offset applied if value is not after anchor
 * @returns Timestamp that is at least fallback minutes after anchor
 */
const ensureAfter = (
  value: Date,
  anchor: Date,
  fallbackMinutes: number
): Date => {
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

