/**
 * Pure helpers for `ConvexVesselTimelineEventsContext`: maps the three parallel
 * `useQuery` results into a single context value without React or Convex hooks.
 */

import type { ConvexActualDockEvent } from "convex/functions/events/eventsActual/schemas";
import type { ConvexPredictedDockEvent } from "convex/functions/events/eventsPredicted/schemas";
import type { ConvexScheduledDockEvent } from "convex/functions/events/eventsScheduled/schemas";

/**
 * Vessel-day dock event rows exposed to timeline UI from Convex list queries.
 *
 * `scheduledEvents`, `actualEvents`, and `predictedEvents` are each `[]` while
 * that query is still loading (`undefined` from `useQuery`). `isLoading` is
 * true if any of the three is still loading, so callers must not treat all
 * empty arrays as “no events for this day” until `isLoading` is false.
 */
type ConvexVesselTimelineEventsContextType = {
  vesselAbbrev: string;
  sailingDay: string;
  scheduledEvents: ConvexScheduledDockEvent[];
  actualEvents: ConvexActualDockEvent[];
  predictedEvents: ConvexPredictedDockEvent[];
  isLoading: boolean;
  errorMessage: string | null;
  retry: () => void;
};

type BuildConvexVesselTimelineEventsContextValueArgs = {
  vesselAbbrev: string;
  sailingDay: string;
  scheduledRaw: ConvexScheduledDockEvent[] | undefined;
  actualRaw: ConvexActualDockEvent[] | undefined;
  predictedRaw: ConvexPredictedDockEvent[] | undefined;
  retry: () => void;
};

/**
 * Builds the context value from raw `useQuery` results and scope fields.
 *
 * Each raw slice is `undefined` until Convex delivers that query. This helper
 * maps `undefined` to `[]` and sets `isLoading` when any slice is still
 * undefined. Runtime query errors are not represented here; they are handled by
 * `ConvexVesselTimelineEventsErrorBoundary`, which supplies a separate context
 * value with `errorMessage` set.
 *
 * @param args - Scope, optional-not-yet-loaded slices (`undefined`), and retry
 * @returns Context value with coerced arrays, combined loading flag, and
 * `errorMessage` always `null` for the happy path
 */
const buildConvexVesselTimelineEventsContextValue = (
  args: BuildConvexVesselTimelineEventsContextValueArgs
): ConvexVesselTimelineEventsContextType => {
  const {
    vesselAbbrev,
    sailingDay,
    scheduledRaw,
    actualRaw,
    predictedRaw,
    retry,
  } = args;
  const isLoading =
    scheduledRaw === undefined ||
    actualRaw === undefined ||
    predictedRaw === undefined;

  return {
    vesselAbbrev,
    sailingDay,
    scheduledEvents: scheduledRaw ?? [],
    actualEvents: actualRaw ?? [],
    predictedEvents: predictedRaw ?? [],
    isLoading,
    errorMessage: null,
    retry,
  };
};

export type { ConvexVesselTimelineEventsContextType };
export { buildConvexVesselTimelineEventsContextValue };
