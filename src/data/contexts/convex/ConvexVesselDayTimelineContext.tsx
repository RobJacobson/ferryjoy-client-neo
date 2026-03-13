/**
 * Convex-backed vessel-day timeline context.
 *
 * This provider fetches scheduled, active, completed, and live vessel-location
 * data for one vessel and one sailing day, then normalizes that data into a
 * timeline-oriented trip array for the VesselTimeline feature.
 */

import { api } from "convex/_generated/api";
import type { ScheduledTrip } from "convex/functions/scheduledTrips/schemas";
import { toDomainScheduledTrip } from "convex/functions/scheduledTrips/schemas";
import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import { toDomainVesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { toDomainVesselTrip } from "convex/functions/vesselTrips/schemas";
import { useQuery } from "convex/react";
import type { PropsWithChildren, ReactNode } from "react";
import {
  createContext,
  Component as ReactComponent,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * Normalized trip shape consumed by vessel-day timeline features.
 *
 * This is intentionally narrower than the raw backend types. The goal is to
 * keep the timeline feature focused on the fields it actually needs rather than
 * exposing full query payloads everywhere.
 */
export type VesselTimelineTrip = {
  key: string;
  vesselAbbrev: string;
  sailingDay: string;
  routeAbbrev?: string;
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev?: string;
  scheduledDeparture: Date;
  scheduledArrival?: Date;
  scheduledArriveCurr?: Date;
  nextScheduledDeparture?: Date;
  tripStart?: Date;
  leftDock?: Date;
  arriveDest?: Date;
  tripEnd?: Date;
  predictedDepartCurr?: Date;
  predictedArriveNext?: Date;
  predictedDepartNext?: Date;
  hasActiveData: boolean;
  hasCompletedData: boolean;
};

/**
 * Context value for vessel-day timeline consumers.
 */
type ConvexVesselDayTimelineContextType = {
  vesselAbbrev: string;
  sailingDay: string;
  trips: VesselTimelineTrip[];
  vesselLocation?: VesselLocation;
  isLoading: boolean;
  error: string | null;
};

/**
 * Provider props for vessel-day timeline data.
 */
type ConvexVesselDayTimelineProviderProps = PropsWithChildren<{
  vesselAbbrev: string;
  sailingDay: string;
}>;

const ConvexVesselDayTimelineContext = createContext<
  ConvexVesselDayTimelineContextType | undefined
>(undefined);

/**
 * Error boundary that captures Convex query errors for this provider.
 *
 * The provider surfaces the error in context state while still rendering the
 * children so the consuming screen can decide how to present failure states.
 */
class ConvexVesselDayTimelineErrorBoundary extends ReactComponent<{
  onError: (error: string) => void;
  fallback: ReactNode;
  children: ReactNode;
}> {
  override state = { hasError: false };

  /**
   * Transitions the boundary into its fallback state after an error.
   *
   * @returns Object that marks the boundary as failed
   */
  static getDerivedStateFromError() {
    return { hasError: true };
  }

  /**
   * Reports the captured error message to the provider.
   *
   * @param error - Error thrown by a nested query consumer
   * @returns Nothing
   */
  override componentDidCatch(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.props.onError(message);
  }

  /**
   * Renders either the children or the provider fallback.
   *
   * @returns React tree for the provider
   */
  override render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

/**
 * Internal data fetcher for the vessel-day timeline provider.
 *
 * This component owns the actual Convex subscriptions and emits partial state
 * updates back to the parent provider. Keeping the subscriptions in a child
 * component allows the error boundary to catch query failures cleanly.
 *
 * @param props - Data fetcher props
 * @param props.vesselAbbrev - Vessel abbreviation to fetch
 * @param props.sailingDay - Sailing day in YYYY-MM-DD format
 * @param props.onStateChange - Partial state updater owned by the parent
 * @param props.children - Child tree rendered once subscriptions are mounted
 * @returns Child tree wrapped by the provider's data subscriptions
 */
const ConvexVesselDayTimelineDataFetcher = ({
  vesselAbbrev,
  sailingDay,
  onStateChange,
  children,
}: PropsWithChildren<{
  vesselAbbrev: string;
  sailingDay: string;
  onStateChange: (state: Partial<ConvexVesselDayTimelineContextType>) => void;
}>) => {
  const rawScheduledTrips = useQuery(
    api.functions.scheduledTrips.queries.getDirectScheduledTripsForVessel,
    {
      vesselAbbrev,
      sailingDay,
    }
  );
  const rawActiveVesselTrips = useQuery(
    api.functions.vesselTrips.queries.getActiveTripsByVessel,
    {
      vesselAbbrev,
    }
  );
  const rawCompletedVesselTrips = useQuery(
    api.functions.vesselTrips.queries.getCompletedTripsByVesselAndSailingDay,
    {
      vesselAbbrev,
      sailingDay,
    }
  );
  const rawVesselLocation = useQuery(
    api.functions.vesselLocation.queries.getByVesselAbbrev,
    {
      vesselAbbrev,
    }
  );

  const isLoading =
    rawScheduledTrips === undefined ||
    rawActiveVesselTrips === undefined ||
    rawCompletedVesselTrips === undefined ||
    rawVesselLocation === undefined;

  const scheduledTrips = (rawScheduledTrips ?? [])
    .map(toDomainScheduledTrip)
    .sort(
      (left, right) =>
        left.DepartingTime.getTime() - right.DepartingTime.getTime()
    );
  const activeVesselTrips = (rawActiveVesselTrips ?? []).map(
    toDomainVesselTrip
  );
  const completedVesselTrips = (rawCompletedVesselTrips ?? []).map(
    toDomainVesselTrip
  );
  const vesselLocation = rawVesselLocation
    ? toDomainVesselLocation(rawVesselLocation)
    : undefined;
  const trips = isLoading
    ? []
    : buildVesselTimelineTrips(
        scheduledTrips,
        activeVesselTrips,
        completedVesselTrips,
        vesselAbbrev,
        sailingDay
      );

  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  useEffect(() => {
    onStateChangeRef.current({
      vesselAbbrev,
      sailingDay,
      trips,
      vesselLocation,
      isLoading,
      error: null,
    });
  }, [vesselAbbrev, sailingDay, trips, vesselLocation, isLoading]);

  return <>{children}</>;
};

/**
 * Provider that exposes normalized vessel-day timeline data.
 *
 * @param props - Provider props
 * @param props.vesselAbbrev - Vessel abbreviation to fetch
 * @param props.sailingDay - Sailing day in YYYY-MM-DD format
 * @param props.children - Child tree that consumes the context
 * @returns Context provider for vessel-day timeline data
 */
export const ConvexVesselDayTimelineProvider = ({
  vesselAbbrev,
  sailingDay,
  children,
}: ConvexVesselDayTimelineProviderProps) => {
  const [state, setState] = useState<ConvexVesselDayTimelineContextType>({
    vesselAbbrev,
    sailingDay,
    trips: [],
    vesselLocation: undefined,
    isLoading: true,
    error: null,
  });

  /**
   * Handles provider-level query errors.
   *
   * @param error - Error message captured by the boundary
   * @returns Nothing
   */
  const handleError = (error: string) => {
    setState((previous) => ({
      ...previous,
      vesselAbbrev,
      sailingDay,
      error,
      isLoading: false,
    }));
  };

  return (
    <ConvexVesselDayTimelineContext.Provider value={state}>
      <ConvexVesselDayTimelineErrorBoundary
        onError={handleError}
        fallback={children}
      >
        <ConvexVesselDayTimelineDataFetcher
          vesselAbbrev={vesselAbbrev}
          sailingDay={sailingDay}
          onStateChange={(partial) =>
            setState((previous) => ({ ...previous, ...partial }))
          }
        >
          {children}
        </ConvexVesselDayTimelineDataFetcher>
      </ConvexVesselDayTimelineErrorBoundary>
    </ConvexVesselDayTimelineContext.Provider>
  );
};

/**
 * Hook to access normalized vessel-day timeline data.
 *
 * @returns Vessel-day timeline context value
 * @throws Error when used outside the matching provider
 */
export const useConvexVesselDayTimeline = () => {
  const context = useContext(ConvexVesselDayTimelineContext);
  if (context === undefined) {
    throw new Error(
      "useConvexVesselDayTimeline must be used within ConvexVesselDayTimelineProvider"
    );
  }

  return context;
};

/**
 * Builds the normalized trip array consumed by vessel-day timeline features.
 *
 * Scheduled trips are the canonical backbone. Active and completed vessel trips
 * are joined by stable composite key and only enrich the scheduled structure.
 *
 * @param scheduledTrips - Direct scheduled trips for the vessel/day
 * @param activeVesselTrips - Active vessel trips for the vessel
 * @param completedVesselTrips - Completed vessel trips for the vessel/day
 * @param vesselAbbrev - Vessel abbreviation requested by the provider
 * @param sailingDay - Sailing day requested by the provider
 * @returns Ordered array of normalized vessel timeline trips
 */
const buildVesselTimelineTrips = (
  scheduledTrips: ScheduledTrip[],
  activeVesselTrips: VesselTrip[],
  completedVesselTrips: VesselTrip[],
  vesselAbbrev: string,
  sailingDay: string
): VesselTimelineTrip[] => {
  const activeByKey = new Map(
    activeVesselTrips.flatMap((trip) =>
      trip.Key ? ([[trip.Key, trip]] as const) : []
    )
  );
  const completedByKey = new Map(
    completedVesselTrips.flatMap((trip) =>
      trip.Key ? ([[trip.Key, trip]] as const) : []
    )
  );

  return scheduledTrips.map((scheduledTrip) =>
    normalizeVesselTimelineTrip(
      scheduledTrip,
      activeByKey.get(scheduledTrip.Key),
      completedByKey.get(scheduledTrip.Key),
      vesselAbbrev,
      sailingDay
    )
  );
};

/**
 * Normalizes one scheduled trip plus its optional operational overlays.
 *
 * The function prefers active trip data when present because it represents the
 * current in-progress operational state. Completed data is used for past trips
 * when no active record exists.
 *
 * @param scheduledTrip - Scheduled trip backbone for the timeline segment
 * @param activeVesselTrip - Active operational overlay for the trip, if any
 * @param completedVesselTrip - Completed operational overlay for the trip, if any
 * @param vesselAbbrev - Vessel abbreviation requested by the provider
 * @param sailingDay - Sailing day requested by the provider
 * @returns Narrow feature-specific vessel timeline trip model
 */
const normalizeVesselTimelineTrip = (
  scheduledTrip: ScheduledTrip,
  activeVesselTrip: VesselTrip | undefined,
  completedVesselTrip: VesselTrip | undefined,
  vesselAbbrev: string,
  sailingDay: string
): VesselTimelineTrip => {
  const operationalTrip = activeVesselTrip ?? completedVesselTrip;

  return {
    key: scheduledTrip.Key,
    vesselAbbrev,
    sailingDay,
    routeAbbrev:
      scheduledTrip.RouteAbbrev ??
      activeVesselTrip?.RouteAbbrev ??
      completedVesselTrip?.RouteAbbrev,
    departingTerminalAbbrev: scheduledTrip.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: scheduledTrip.ArrivingTerminalAbbrev,
    scheduledDeparture: scheduledTrip.DepartingTime,
    scheduledArrival:
      scheduledTrip.SchedArriveNext ?? scheduledTrip.ArrivingTime,
    scheduledArriveCurr: scheduledTrip.SchedArriveCurr,
    nextScheduledDeparture: scheduledTrip.NextDepartingTime,
    tripStart: operationalTrip?.TripStart,
    leftDock: operationalTrip?.LeftDock,
    arriveDest: operationalTrip?.ArriveDest ?? operationalTrip?.TripEnd,
    tripEnd: operationalTrip?.TripEnd,
    predictedDepartCurr: activeVesselTrip?.AtDockDepartCurr?.PredTime,
    predictedArriveNext:
      activeVesselTrip?.AtSeaArriveNext?.PredTime ??
      activeVesselTrip?.AtDockArriveNext?.PredTime ??
      completedVesselTrip?.AtSeaArriveNext?.PredTime ??
      completedVesselTrip?.AtDockArriveNext?.PredTime,
    predictedDepartNext:
      activeVesselTrip?.AtDockDepartNext?.PredTime ??
      activeVesselTrip?.AtSeaDepartNext?.PredTime ??
      completedVesselTrip?.AtDockDepartNext?.PredTime ??
      completedVesselTrip?.AtSeaDepartNext?.PredTime,
    hasActiveData: activeVesselTrip !== undefined,
    hasCompletedData: completedVesselTrip !== undefined,
  };
};
