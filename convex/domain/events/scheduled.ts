/**
 * Domain-owned scheduled dock-event contracts and continuity helpers.
 *
 * Vessel-trip schedule readers use these helpers to infer a portable segment
 * from one departure boundary and to choose the next departure in a row pool.
 */

/** Stable dock event types used across scheduled, actual, and predicted rows. */
type DockEventType = "dep-dock" | "arv-dock";

/** Canonical persisted scheduled dock row. */
type ConvexScheduledDockEvent = {
  Key: string;
  VesselAbbrev: string;
  SailingDay: string;
  UpdatedAt: number;
  ScheduledDeparture: number;
  TerminalAbbrev: string;
  NextTerminalAbbrev: string;
  EventType: DockEventType;
  EventScheduledTime?: number;
  IsLastArrivalOfSailingDay?: boolean;
};

/** Portable inferred segment used by continuity and timeline reads. */
type ConvexInferredScheduledSegment = {
  Key: string;
  SailingDay: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  DepartingTime: number;
  NextKey?: string;
  NextDepartingTime?: number;
};

const EVENT_TYPE_SORT_ORDER: Record<DockEventType, 0 | 1> = {
  "arv-dock": 0,
  "dep-dock": 1,
};

/**
 * Infers one scheduled segment from a departure event and same-day rows.
 *
 * @param departureEvent - Departure boundary anchoring the inferred segment
 * @param sameDayEvents - Scheduled rows for the same vessel and sailing day
 * @returns Segment context with optional next departure linkage
 */
const inferScheduledSegmentFromDepartureEvent = (
  departureEvent: ConvexScheduledDockEvent,
  sameDayEvents: ReadonlyArray<ConvexScheduledDockEvent>
): ConvexInferredScheduledSegment => {
  const nextDepartureEvent = findNextDepartureEvent(sameDayEvents, {
    afterTime: departureEvent.ScheduledDeparture,
  });

  return {
    Key: getSegmentKeyFromBoundaryKey(departureEvent.Key),
    SailingDay: departureEvent.SailingDay,
    DepartingTerminalAbbrev: departureEvent.TerminalAbbrev,
    ArrivingTerminalAbbrev: departureEvent.NextTerminalAbbrev,
    DepartingTime: getBoundaryTime(departureEvent),
    NextKey: nextDepartureEvent
      ? getSegmentKeyFromBoundaryKey(nextDepartureEvent.Key)
      : undefined,
    NextDepartingTime: nextDepartureEvent
      ? getBoundaryTime(nextDepartureEvent)
      : undefined,
  };
};

/**
 * Finds the next departure row after a threshold.
 *
 * @param events - Candidate scheduled events
 * @param args.terminalAbbrev - Optional departing terminal filter
 * @param args.afterTime - Exclusive scheduled-departure lower bound
 * @returns Earliest matching departure row, or null when absent
 */
const findNextDepartureEvent = (
  events: ReadonlyArray<ConvexScheduledDockEvent>,
  args: {
    terminalAbbrev?: string;
    afterTime: number;
  }
): ConvexScheduledDockEvent | null =>
  [...events]
    .filter(
      (event) =>
        event.EventType === "dep-dock" &&
        (args.terminalAbbrev === undefined ||
          event.TerminalAbbrev === args.terminalAbbrev) &&
        event.ScheduledDeparture > args.afterTime
    )
    .sort(compareScheduledDockEvents)[0] ?? null;

/**
 * Extracts the segment portion from a boundary key.
 *
 * @param boundaryKey - Full boundary key ending in dep-dock or arv-dock
 * @returns Segment key without the boundary suffix
 */
const getSegmentKeyFromBoundaryKey = (boundaryKey: string): string =>
  boundaryKey.replace(/--(?:dep|arv)-dock$/, "");

/**
 * Resolves the comparable scheduled boundary instant.
 *
 * @param event - Event carrying scheduled boundary fields
 * @returns EventScheduledTime when present, otherwise ScheduledDeparture
 */
const getBoundaryTime = (
  event: Pick<
    ConvexScheduledDockEvent,
    "EventScheduledTime" | "ScheduledDeparture"
  >
): number => event.EventScheduledTime ?? event.ScheduledDeparture;

/**
 * Sorts scheduled rows in deterministic timeline order.
 *
 * @param left - First scheduled row
 * @param right - Second scheduled row
 * @returns Sort comparator result
 */
const compareScheduledDockEvents = (
  left: ConvexScheduledDockEvent,
  right: ConvexScheduledDockEvent
): number =>
  getBoundaryTime(left) - getBoundaryTime(right) ||
  EVENT_TYPE_SORT_ORDER[left.EventType] -
    EVENT_TYPE_SORT_ORDER[right.EventType] ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev);

export type {
  ConvexInferredScheduledSegment,
  ConvexScheduledDockEvent,
  DockEventType,
};
export { findNextDepartureEvent, inferScheduledSegmentFromDepartureEvent };
