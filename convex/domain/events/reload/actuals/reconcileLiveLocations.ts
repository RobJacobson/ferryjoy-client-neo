/**
 * Reconciles live vessel locations into sparse actual dock writes during reload.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { getSailingDay } from "shared/time";
import type {
  ActiveTripForPhysicalActualReconcile,
  DockStatusEventRecord,
  TripContextForActualRow,
} from "../types";
import { buildTripBoundaryKeySet } from "./liveLocationBoundaryKeys";
import { buildPhysicalOnlyActualRows } from "./physicalOnlyLiveLocations";
import { buildScheduleAlignedActualRows } from "./scheduleAlignedLiveLocations";

/**
 * Builds persisted actual rows from locations when history missed schedule rows.
 *
 * Runs two sibling builders in sequence over the same sailing-day-filtered
 * locations: first schedule-aligned rows that match a known boundary record,
 * then physical-only rows for boundaries that neither schedule alignment nor
 * the caller's base rows already cover.
 *
 * @param args.sailingDay - Target sailing day string
 * @param args.events - Normalized boundary records for correlation
 * @param args.actualRows - Base actual rows from schedule and physical trips
 * @param args.updatedAt - UpdatedAt stamp for new Convex rows
 * @param args.vesselLocations - Latest pings for matching
 * @param args.tripBySegmentKey - TripKey lookup by segment key
 * @param args.activeTripsByVesselAbbrev - Physical-only active trips
 * @returns Extra actual rows to merge into the sailing day reload payload
 */
const reconcileLiveLocations = ({
  sailingDay,
  events,
  actualRows,
  updatedAt,
  vesselLocations,
  tripBySegmentKey,
  activeTripsByVesselAbbrev,
}: {
  sailingDay: string;
  events: DockStatusEventRecord[];
  actualRows: ConvexActualDockEvent[];
  updatedAt: number;
  vesselLocations: ConvexVesselLocation[];
  tripBySegmentKey: Map<string, TripContextForActualRow>;
  activeTripsByVesselAbbrev: Map<
    string,
    ActiveTripForPhysicalActualReconcile & { TripKey: string }
  >;
}): ConvexActualDockEvent[] => {
  // Share one pre-filtered slice so both builders read the same input.
  const sailingDayLocations = vesselLocations.filter(
    locationMatchesSailingDay(sailingDay)
  );

  // Run schedule alignment first so its rows anchor the fallback's dedupe set.
  const scheduleAligned = buildScheduleAlignedActualRows({
    locations: sailingDayLocations,
    events,
    tripBySegmentKey,
    updatedAt,
  });

  // Build the dedupe horizon so the fallback skips already-covered boundaries.
  const representedTripBoundaryKeys = buildTripBoundaryKeySet([
    ...actualRows,
    ...scheduleAligned,
  ]);

  // Backfill from physical-only trips for boundaries schedule alignment missed.
  const physicalOnly = buildPhysicalOnlyActualRows({
    locations: sailingDayLocations,
    activeTripsByVesselAbbrev,
    representedTripBoundaryKeys,
    updatedAt,
  });

  // Return both sources; the represented-set guard keeps them non-overlapping.
  return [...scheduleAligned, ...physicalOnly];
};

const locationMatchesSailingDay =
  (sailingDay: string) => (location: ConvexVesselLocation) =>
    getSailingDay(
      new Date(location.ScheduledDeparture ?? location.TimeStamp)
    ) === sailingDay;

export { reconcileLiveLocations };
