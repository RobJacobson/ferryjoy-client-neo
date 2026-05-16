/**
 * Shared actual-row boundary vocabulary for reload assembly.
 *
 * Keeps boundary and lookup types close to the small utilities that connect
 * boundary indexing, source phases, and row materialization.
 */

import type { DockEventType } from "functions/events/common/schemas";

type ActualBoundary = {
  EventKey: string;
  TripKey: string;
  VesselAbbrev: string;
  SailingDay?: string;
  ScheduledDeparture?: number;
  TerminalAbbrev: string;
  EventType: DockEventType;
  EventScheduledTime?: number;
};

type ActualBoundaryIndex = {
  byBoundaryKey: Map<string, ActualBoundary>;
  byScheduledSegmentEventKey: Map<string, ActualBoundary>;
  byPhysicalSegmentEventKey: Map<string, ActualBoundary>;
  byVesselAbbrev: Map<string, ActualBoundary[]>;
  byActivePhysicalVesselAbbrev: Map<string, PhysicalTripBoundaries>;
};

type PhysicalTripBoundaries = {
  departure?: ActualBoundary;
  arrival?: ActualBoundary;
};

const DOCK_EVENT_SPECS = [
  [
    "dep-dock",
    "departure",
    "DepartingTerminalAbbrev",
    "LeftDockActual",
    "ActualDepart",
  ],
  ["arv-dock", "arrival", "ArrivingTerminalAbbrev", "TripEnd", "EstArrival"],
] as const;

/**
 * Removes undefined values from optional helper results.
 *
 * Source helpers often encode absence as undefined because the surrounding
 * pipeline wants arrays. This helper keeps that conversion consistent without
 * leaking optional values into downstream mappers.
 *
 * @param values - Optional values produced by source helpers
 * @returns Values with undefined entries removed
 */
const compact = <T>(...values: Array<T | undefined>): T[] =>
  values.filter((value): value is T => value !== undefined);

/**
 * Builds the segment-event lookup key.
 *
 * Scheduled and physical-only lookups share the same two-part identity even
 * though their segment source differs. Keeping the key format centralized
 * prevents source helpers from drifting apart.
 *
 * @param segmentKey - Scheduled segment key or physical-only trip key
 * @param eventType - Dock boundary type
 * @returns Composite key for boundary lookup maps
 */
const toSegmentEventKey = (
  segmentKey: string,
  eventType: DockEventType
): string => `${segmentKey}|${eventType}`;

export type { ActualBoundary, ActualBoundaryIndex, PhysicalTripBoundaries };
export { compact, DOCK_EVENT_SPECS, toSegmentEventKey };
