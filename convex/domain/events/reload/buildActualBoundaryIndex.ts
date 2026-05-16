/**
 * Build lookup indexes for reload actual-row boundaries.
 *
 * Scheduled boundaries and physical-only trips are normalized into the same
 * boundary shape, then projected into maps tailored to history, tracking, and
 * durable trip-field source phases.
 */

import type { DockEventType } from "functions/events/common/schemas";
import { buildPhysicalActualEventKey } from "shared/physicalTripIdentity";
import {
  type ActualBoundary,
  type ActualBoundaryIndex,
  compact,
  DOCK_EVENT_SPECS,
  type PhysicalTripBoundaries,
  toSegmentEventKey,
} from "./buildActualRowsShared";
import type { ActualTripScope } from "./resolveActualTripScope";
import type { ReloadTripWithTripKey, ScheduledBoundary } from "./types";

type IndexedScheduledBoundary = {
  boundary: ScheduledBoundary;
  actualBoundary: ActualBoundary;
};

type IndexedPhysicalTripBoundaries = {
  trip: ReloadTripWithTripKey;
  boundaries: PhysicalTripBoundaries;
  isActive: boolean;
};

/**
 * Builds lookup maps for scheduled and physical-only actual boundaries.
 *
 * The index is intentionally source-aware: scheduled lookups are isolated from
 * physical-only lookups while both feed common source-phase matching. That
 * prevents tracking fallbacks from accidentally matching a physical-only trip
 * as though it were part of the scheduled reload slice.
 *
 * @param boundaries - Scheduled dock boundaries in reload scope
 * @param tripScope - Keyed active and completed trips in reload scope
 * @returns Boundary lookup maps used by actual row source phases
 */
const buildActualBoundaryIndex = (
  boundaries: ScheduledBoundary[],
  tripScope: ActualTripScope
): ActualBoundaryIndex => {
  const tripKeyBySegmentKey = buildTripKeyBySegmentKey(tripScope.tripsWithKeys);
  const scheduledBoundaryEntries = buildIndexedScheduledBoundaries(
    boundaries,
    tripKeyBySegmentKey
  );
  const physicalTripBoundaryEntries =
    buildIndexedPhysicalTripBoundaries(tripScope);

  return {
    byBoundaryKey: buildScheduledBoundaryKeyIndex(scheduledBoundaryEntries),
    byScheduledSegmentEventKey: buildScheduledSegmentEventIndex(
      scheduledBoundaryEntries
    ),
    byPhysicalSegmentEventKey: buildPhysicalSegmentEventIndex(
      physicalTripBoundaryEntries
    ),
    byVesselAbbrev: buildScheduledVesselIndex(scheduledBoundaryEntries),
    byActivePhysicalVesselAbbrev: buildActivePhysicalVesselIndex(
      physicalTripBoundaryEntries
    ),
  };
};

/**
 * Builds the trip-key lookup used to attach scheduled boundaries to trips.
 *
 * @param tripsWithKeys - Active and completed trips with persisted trip identity
 * @returns Trip keys keyed by scheduled segment key or physical-only trip key
 */
const buildTripKeyBySegmentKey = (
  tripsWithKeys: ReloadTripWithTripKey[]
): Map<string, string> =>
  new Map(
    tripsWithKeys.map((trip) => [
      trip.ScheduleKey ?? trip.TripKey,
      trip.TripKey,
    ])
  );

/**
 * Attaches resolved trip identity to scheduled boundaries.
 *
 * @param boundaries - Scheduled dock boundaries in reload scope
 * @param tripKeyBySegmentKey - Trip keys keyed by segment identity
 * @returns Scheduled boundary entries whose trips can be resolved
 */
const buildIndexedScheduledBoundaries = (
  boundaries: ScheduledBoundary[],
  tripKeyBySegmentKey: Map<string, string>
): IndexedScheduledBoundary[] =>
  boundaries.flatMap((boundary) =>
    compact(toIndexedScheduledBoundary(boundary, tripKeyBySegmentKey))
  );

/**
 * Builds one indexed scheduled boundary when a matching trip exists.
 *
 * @param boundary - Scheduled dock boundary from the reload slice
 * @param tripKeyBySegmentKey - Trip keys keyed by segment identity
 * @returns Indexed boundary entry, or undefined when no trip key matches
 */
const toIndexedScheduledBoundary = (
  boundary: ScheduledBoundary,
  tripKeyBySegmentKey: Map<string, string>
): IndexedScheduledBoundary | undefined => {
  const tripKey = tripKeyBySegmentKey.get(boundary.SegmentKey);

  return tripKey === undefined
    ? undefined
    : {
        boundary,
        actualBoundary: toScheduledBoundary(boundary, tripKey),
      };
};

/**
 * Builds physical-only boundary entries for keyed trips.
 *
 * @param tripScope - Keyed active and completed trips in reload scope
 * @returns Physical-only trip boundary entries with active-trip membership
 */
const buildIndexedPhysicalTripBoundaries = (
  tripScope: ActualTripScope
): IndexedPhysicalTripBoundaries[] => {
  const activeTripKeys = new Set(
    tripScope.activeTripsWithKeys.map((trip) => trip.TripKey)
  );

  return tripScope.tripsWithKeys
    .filter((trip) => trip.ScheduleKey === undefined)
    .map((trip) => ({
      trip,
      boundaries: toPhysicalTripBoundaries(trip),
      isActive: activeTripKeys.has(trip.TripKey),
    }));
};

/**
 * Indexes scheduled actual boundaries by scheduled boundary key.
 *
 * @param entries - Scheduled boundary entries with resolved actual identity
 * @returns Actual boundaries keyed by scheduled boundary key
 */
const buildScheduledBoundaryKeyIndex = (
  entries: IndexedScheduledBoundary[]
): Map<string, ActualBoundary> =>
  new Map(
    entries.map(({ boundary, actualBoundary }) => [
      boundary.Key,
      actualBoundary,
    ])
  );

/**
 * Indexes scheduled actual boundaries by segment and event type.
 *
 * @param entries - Scheduled boundary entries with resolved actual identity
 * @returns Actual boundaries keyed by scheduled segment-event identity
 */
const buildScheduledSegmentEventIndex = (
  entries: IndexedScheduledBoundary[]
): Map<string, ActualBoundary> =>
  new Map(
    entries.map(({ boundary, actualBoundary }) => [
      toSegmentEventKey(boundary.SegmentKey, boundary.EventType),
      actualBoundary,
    ])
  );

/**
 * Indexes physical-only boundaries by trip key and event type.
 *
 * @param entries - Physical-only trip boundary entries
 * @returns Actual boundaries keyed by physical trip-event identity
 */
const buildPhysicalSegmentEventIndex = (
  entries: IndexedPhysicalTripBoundaries[]
): Map<string, ActualBoundary> =>
  new Map(
    entries.flatMap(({ trip, boundaries }) =>
      compact(...Object.values(boundaries)).map((boundary) => [
        toSegmentEventKey(trip.TripKey, boundary.EventType),
        boundary,
      ])
    )
  );

/**
 * Groups scheduled boundaries by vessel abbreviation for tracking fallbacks.
 *
 * @param entries - Scheduled boundary entries with resolved actual identity
 * @returns Scheduled actual boundaries grouped by vessel abbreviation
 */
const buildScheduledVesselIndex = (
  entries: IndexedScheduledBoundary[]
): Map<string, ActualBoundary[]> =>
  entries.reduce(
    (boundariesByVessel, { actualBoundary }) =>
      new Map(boundariesByVessel).set(actualBoundary.VesselAbbrev, [
        ...(boundariesByVessel.get(actualBoundary.VesselAbbrev) ?? []),
        actualBoundary,
      ]),
    new Map<string, ActualBoundary[]>()
  );

/**
 * Indexes active physical-only boundaries by vessel abbreviation.
 *
 * @param entries - Physical-only trip boundary entries
 * @returns Physical-only boundary pairs keyed by active vessel abbreviation
 */
const buildActivePhysicalVesselIndex = (
  entries: IndexedPhysicalTripBoundaries[]
): Map<string, PhysicalTripBoundaries> =>
  new Map(
    entries
      .filter((entry) => entry.isActive)
      .map(({ trip, boundaries }) => [trip.VesselAbbrev, boundaries])
  );

/**
 * Builds an actual boundary from a scheduled dock boundary.
 *
 * @param boundary - Scheduled boundary with segment identity
 * @param tripKey - TripKey resolved for the scheduled segment
 * @returns Actual boundary attached to the resolved trip
 */
const toScheduledBoundary = (
  boundary: ScheduledBoundary,
  tripKey: string
): ActualBoundary => ({
  EventKey: buildPhysicalActualEventKey(tripKey, boundary.EventType),
  TripKey: tripKey,
  VesselAbbrev: boundary.VesselAbbrev,
  SailingDay: boundary.SailingDay,
  ScheduledDeparture: boundary.ScheduledDeparture,
  TerminalAbbrev: boundary.TerminalAbbrev,
  EventType: boundary.EventType,
  EventScheduledTime: boundary.EventScheduledTime,
});

/**
 * Builds physical-only departure and arrival boundaries for one trip.
 *
 * @param trip - Physical-only trip carrying actual row identity
 * @returns Physical boundaries supported by the trip terminal fields
 */
const toPhysicalTripBoundaries = (
  trip: ReloadTripWithTripKey
): PhysicalTripBoundaries =>
  Object.fromEntries(
    DOCK_EVENT_SPECS.map(([eventType, boundaryField, tripTerminal]) => [
      boundaryField,
      toPhysicalTripBoundary(trip, eventType, trip[tripTerminal]),
    ])
  ) as PhysicalTripBoundaries;

/**
 * Builds one physical-only actual boundary when terminal identity exists.
 *
 * @param trip - Physical-only trip carrying actual row identity
 * @param eventType - Dock boundary type represented by the boundary
 * @param terminalAbbrev - Terminal abbreviation for the boundary
 * @returns Actual boundary, or undefined when terminal identity is absent
 */
const toPhysicalTripBoundary = (
  trip: ReloadTripWithTripKey,
  eventType: DockEventType,
  terminalAbbrev: string | undefined
): ActualBoundary | undefined =>
  terminalAbbrev === undefined
    ? undefined
    : {
        EventKey: buildPhysicalActualEventKey(trip.TripKey, eventType),
        TripKey: trip.TripKey,
        VesselAbbrev: trip.VesselAbbrev,
        SailingDay: trip.SailingDay,
        ScheduledDeparture: trip.ScheduledDeparture,
        TerminalAbbrev: terminalAbbrev,
        EventType: eventType,
      };

export { buildActualBoundaryIndex };
