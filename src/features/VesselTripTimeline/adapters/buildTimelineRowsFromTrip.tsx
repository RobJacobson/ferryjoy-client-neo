/**
 * Adapter that maps vessel trip domain data into Timeline primitive rows.
 */

import type { TimelineRow } from "@/components/Timeline";
import { Text } from "@/components/ui";
import { ArriveEventCard } from "../components/events/ArriveEventCard";
import { DepartEventCard } from "../components/events/DepartEventCard";
import { InTransitEventCard } from "../components/events/InTransitEventCard";
import type { VesselTripTimelineItem } from "../types";

const MIN_SEGMENT_MINUTES = 1;
const DEFAULT_DOCK_MINUTES = 12;
const DEFAULT_AT_SEA_MINUTES = 45;
const DEFAULT_ARRIVAL_MINUTES = 10;

/**
 * Builds timeline rows for a single vessel trip card.
 *
 * @param item - Vessel trip and location pair
 * @param now - Current time used for progress calculations
 * @returns Timeline rows for departure, in-transit, and arrival
 */
export const buildTimelineRowsFromTrip = (
  item: VesselTripTimelineItem,
  now: Date = new Date()
): TimelineRow[] => {
  const { trip, vesselLocation } = item;
  const times = buildSegmentTimes(item, now);
  const atSeaPercent = getAtSeaPercent(
    times.departedAt,
    times.arriveEta,
    trip,
    now
  );
  const inTransitSubtitle = buildInTransitSubtitle(item);
  const indicatorText = getRemainingMinutesLabel(times.arriveEta, trip, now);

  return [
    {
      id: `${trip.VesselAbbrev}-depart`,
      startTime: times.departWindowStart,
      endTime: times.departedAt,
      percentComplete: trip.LeftDock ? 1 : 0,
      rightContent: (
        <DepartEventCard
          title={`Depart ${vesselLocation.DepartingTerminalAbbrev}`}
          subtitle={trip.LeftDock ? "Departed" : "Preparing to depart"}
        />
      ),
    },
    {
      id: `${trip.VesselAbbrev}-at-sea`,
      startTime: times.departedAt,
      endTime: times.arriveEta,
      percentComplete: atSeaPercent,
      leftContent: (
        <InTransitEventCard
          vesselName={vesselLocation.VesselName}
          subtitle={inTransitSubtitle}
        />
      ),
      rightContent: (
        <ArriveEventCard
          title={`Arrive ${vesselLocation.ArrivingTerminalAbbrev ?? "Terminal"}`}
          subtitle={`ETA ${formatTime(times.arriveEta)}`}
        />
      ),
      indicatorContent: indicatorText ? (
        <Text className="font-bold text-green-700 text-xs">
          {indicatorText}
        </Text>
      ) : undefined,
    },
    {
      id: `${trip.VesselAbbrev}-arrive`,
      startTime: times.arriveEta,
      endTime: times.tripEnd,
      percentComplete: trip.TripEnd ? 1 : 0,
      rightContent: (
        <ArriveEventCard
          title={`Dock ${vesselLocation.ArrivingTerminalAbbrev ?? "Terminal"}`}
          subtitle={trip.TripEnd ? "Arrived" : "Awaiting arrival"}
        />
      ),
    },
  ];
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
 * Builds compact subtitle text for in-transit details.
 *
 * @param item - Vessel trip and location pair
 * @returns Compact in-transit subtitle
 */
const buildInTransitSubtitle = (item: VesselTripTimelineItem): string => {
  const { vesselLocation } = item;
  const speedText = `${Math.round(vesselLocation.Speed)} kn`;

  if (typeof vesselLocation.ArrivingDistance === "number") {
    const miles = vesselLocation.ArrivingDistance.toFixed(1);
    return `${speedText} · ${miles} mi to destination`;
  }

  return `${speedText} · In transit`;
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

  const duration = arriveEta.getTime() - departedAt.getTime();
  if (duration <= 0) return 0;
  const elapsed = now.getTime() - departedAt.getTime();
  return clamp01(elapsed / duration);
};

/**
 * Produces a short remaining-minutes label for the moving indicator.
 *
 * @param arriveEta - ETA used as countdown target
 * @param trip - Vessel trip data
 * @param now - Current time
 * @returns Remaining minutes label, or undefined when inapplicable
 */
const getRemainingMinutesLabel = (
  arriveEta: Date,
  trip: VesselTripTimelineItem["trip"],
  now: Date
): string | undefined => {
  if (trip.TripEnd || !trip.LeftDock) return undefined;

  const remainingMs = arriveEta.getTime() - now.getTime();
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

/**
 * Formats a timestamp as a local short time string.
 *
 * @param value - Date to format
 * @returns Short local time string
 */
const formatTime = (value: Date): string =>
  value.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
