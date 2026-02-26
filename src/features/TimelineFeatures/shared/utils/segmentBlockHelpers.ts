/**
 * Segment block helpers: conversions and bar-status mapping.
 * TripSegment → AtDockSegment/AtSeaSegment and TimelineBar status for dock/sea blocks.
 */

import type {
  AtDockSegment,
  AtSeaSegment,
  TimelineBarStatus,
  TripSegment,
} from "../types";

/**
 * Derives AtDockSegment from TripSegment for dock block rendering.
 *
 * @param trip - Full trip segment from synthesis
 * @returns AtDockSegment for ArriveCurrMarker and TimelineBarAtDock
 */
export const toAtDockSegment = (trip: TripSegment): AtDockSegment => ({
  currTerminal: trip.currTerminal,
  arriveCurr: trip.arriveCurr,
  leaveCurr: trip.leaveCurr,
  isArrived: trip.isArrived,
  isHeld: trip.isHeld,
  status: trip.status,
  phase: trip.phase,
});

/**
 * Derives AtSeaSegment from TripSegment for sea block rendering.
 *
 * @param trip - Full trip segment from synthesis
 * @returns AtSeaSegment for DepartCurrMarker, TimelineBarAtSea, and ArriveNextMarker
 */
export const toAtSeaSegment = (trip: TripSegment): AtSeaSegment => ({
  currTerminal: trip.currTerminal,
  nextTerminal: trip.nextTerminal,
  leaveCurr: trip.leaveCurr,
  arriveNext: trip.arriveNext,
  isLeft: trip.isLeft,
  isHeld: trip.isHeld,
  status: trip.status,
  phase: trip.phase,
});

/**
 * Maps AtDockSegment to the status for the at-dock bar.
 *
 * @param segment - At-dock segment
 * @returns Timeline bar status for the dock segment
 */
export const getDockBarStatus = (segment: AtDockSegment): TimelineBarStatus =>
  segment.phase === "at-dock"
    ? "InProgress"
    : segment.status === "past" ||
        segment.phase === "at-sea" ||
        segment.phase === "completed"
      ? "Completed"
      : "Pending";

/**
 * Maps AtSeaSegment to the status for the at-sea bar.
 *
 * @param segment - At-sea segment
 * @returns Timeline bar status for the sea segment
 */
export const getSeaBarStatus = (segment: AtSeaSegment): TimelineBarStatus =>
  segment.phase === "at-sea"
    ? "InProgress"
    : segment.status === "past" || segment.phase === "completed"
      ? "Completed"
      : "Pending";

/**
 * Whether to show the indicator on the at-sea bar.
 *
 * @param segment - At-sea segment
 * @returns True when the sea bar should display the vessel indicator
 */
export const getSeaBarShowIndicator = (segment: AtSeaSegment): boolean =>
  segment.phase === "at-sea" ||
  (segment.isHeld && segment.phase === "completed");

/**
 * Whether the at-sea bar should show "Arrived" label.
 *
 * @param segment - At-sea segment
 * @returns True when the sea bar should show "Arrived"
 */
export const getSeaBarIsArrived = (segment: AtSeaSegment): boolean =>
  segment.phase !== "at-sea" && !!segment.arriveNext.actual;
