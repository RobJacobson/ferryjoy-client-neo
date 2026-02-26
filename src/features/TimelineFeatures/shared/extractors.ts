/**
 * Pure functions for extracting display data from timeline segments.
 * These functions transform segment data into display-ready values without UI logic.
 * Use with layout components (e.g., StandardMarkerLayout, TimeBox) for composition.
 */

import type { AtDockSegment, AtSeaSegment, TimePoint } from "./types";

/**
 * Extracts the label text for an arrival at the current terminal.
 * Returns "Arrived {abbrev}" if actual arrival time exists, otherwise "Arrive {abbrev}".
 *
 * @param segment - AtDockSegment with arriveCurr and currTerminal
 * @returns Label string (e.g., "Arrived ABC" or "Arrive ABC")
 */
export const extractArriveCurrLabel = (segment: AtDockSegment): string =>
  `${segment.arriveCurr.actual ? "Arrived" : "Arrive"} ${segment.currTerminal.abbrev}`;

/**
 * Extracts the label text for a departure from the current terminal.
 * Returns "Left {abbrev}" if vessel has left, otherwise "Leave {abbrev}".
 *
 * @param segment - AtSeaSegment with leaveCurr, isLeft, and currTerminal
 * @returns Label string (e.g., "Left ABC" or "Leave ABC")
 */
export const extractDepartCurrLabel = (segment: AtSeaSegment): string =>
  `${segment.isLeft ? "Left" : "Leave"} ${segment.currTerminal.abbrev}`;

/**
 * Extracts the label text for an arrival at the next terminal.
 * Returns "Arrived {abbrev}" if actual arrival time exists, otherwise "Arrive {abbrev}".
 *
 * @param segment - AtSeaSegment with arriveNext and nextTerminal
 * @returns Label string (e.g., "Arrived XYZ" or "Arrive XYZ")
 */
export const extractArriveNextLabel = (segment: AtSeaSegment): string =>
  `${segment.arriveNext.actual ? "Arrived" : "Arrive"} ${segment.nextTerminal.abbrev}`;

/**
 * Extracts the arrival time point from an at-dock segment.
 *
 * @param segment - AtDockSegment with arriveCurr
 * @returns TimePoint containing scheduled, actual, and estimated times
 */
export const extractArriveCurrTimePoint = (segment: AtDockSegment): TimePoint =>
  segment.arriveCurr;

/**
 * Extracts the departure time point from an at-sea segment.
 *
 * @param segment - AtSeaSegment with leaveCurr
 * @returns TimePoint containing scheduled, actual, and estimated times
 */
export const extractDepartCurrTimePoint = (segment: AtSeaSegment): TimePoint =>
  segment.leaveCurr;

/**
 * Extracts the arrival time point from an at-sea segment.
 *
 * @param segment - AtSeaSegment with arriveNext
 * @returns TimePoint containing scheduled, actual, and estimated times
 */
export const extractArriveNextTimePoint = (segment: AtSeaSegment): TimePoint =>
  segment.arriveNext;
