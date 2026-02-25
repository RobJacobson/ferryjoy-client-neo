/**
 * UnifiedTripsContext - Joins scheduled, active, and completed trips by composite key.
 *
 * Fetches route-scoped trip data via Convex subscriptions and stitches them into
 * a single Record<key, UnifiedTrip>. Each key maps to at most one scheduled trip,
 * one active trip, and one completed trip (active and completed are mutually exclusive).
 *
 * Supports direct trips only (backend filter). For indirect trips A→C, use
 * resolveIndirectToSegments with a separate query for indirect scheduled trips.
 */

import { api } from "convex/_generated/api";
import {
  type ScheduledTrip,
  toDomainScheduledTrip,
} from "convex/functions/scheduledTrips/schemas";
import {
  toDomainVesselTrip,
  type VesselTrip,
} from "convex/functions/vesselTrips/schemas";
import { useQuery } from "convex/react";
import type { PropsWithChildren, ReactNode } from "react";
import {
  createContext,
  Component as ReactComponent,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  expandRouteAbbrev,
  type UnifiedTrip,
  type UnifiedTripRecord,
} from "./unifiedTripsHelpers";

type UnifiedTripsContextType = {
  /** Record mapping composite Key to unified trip (scheduled, active, completed) */
  unifiedTrips: UnifiedTripRecord;
  /** True while any of the queries is loading */
  isLoading: boolean;
  /** Error message if any query failed; null when no error */
  error: string | null;
};

const UnifiedTripsContext = createContext<UnifiedTripsContextType | undefined>(
  undefined
);

type UnifiedTripsProviderProps = PropsWithChildren<{
  routeAbbrev: string;
  tripDate: string;
}>;

/**
 * Error boundary that catches query errors and reports them via callback.
 * When an error occurs, renders fallback (user children) so consumers can show
 * error UI from context; does not re-render the failing DataFetcher.
 */
class UnifiedTripsErrorBoundary extends ReactComponent<{
  onError: (error: string) => void;
  fallback: ReactNode;
  children: ReactNode;
}> {
  override state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.props.onError(message);
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * Internal fetcher that runs Convex queries and updates provider state.
 * Throws on query error; UnifiedTripsErrorBoundary catches and reports.
 */
const UnifiedTripsDataFetcher = ({
  routeAbbrev,
  tripDate,
  onStateChange,
  children,
}: PropsWithChildren<{
  routeAbbrev: string;
  tripDate: string;
  onStateChange: (state: Partial<UnifiedTripsContextType>) => void;
}>) => {
  const routeAbbrevs = expandRouteAbbrev(routeAbbrev);

  const rawScheduledTrips = useQuery(
    api.functions.scheduledTrips.queries
      .getDirectScheduledTripsByRoutesAndTripDate,
    { routeAbbrevs, tripDate }
  );
  const rawActiveVesselTrips = useQuery(
    api.functions.vesselTrips.queries.getActiveTripsByRoutes,
    { routeAbbrevs }
  );
  const rawCompletedVesselTrips = useQuery(
    api.functions.vesselTrips.queries.getCompletedTripsByRoutesAndTripDate,
    { routeAbbrevs, tripDate }
  );

  const scheduledTrips = rawScheduledTrips?.map(toDomainScheduledTrip) ?? [];
  const activeVesselTrips = rawActiveVesselTrips?.map(toDomainVesselTrip) ?? [];
  const completedVesselTrips =
    rawCompletedVesselTrips?.map(toDomainVesselTrip) ?? [];

  const isLoading =
    rawScheduledTrips === undefined ||
    rawActiveVesselTrips === undefined ||
    rawCompletedVesselTrips === undefined;

  const unifiedTrips = useMemo(
    () =>
      isLoading
        ? {}
        : buildUnifiedTripRecord(
            scheduledTrips,
            activeVesselTrips,
            completedVesselTrips
          ),
    [isLoading, scheduledTrips, activeVesselTrips, completedVesselTrips]
  );

  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  useEffect(() => {
    onStateChangeRef.current({
      unifiedTrips,
      isLoading,
      error: null,
    });
  }, [unifiedTrips, isLoading]);

  return <>{children}</>;
};

/**
 * Provider that fetches scheduled, active, and completed trips for a route
 * and trip date, then stitches them into a unified record by composite key.
 *
 * When routeAbbrev is "f-v-s" (South Sound triangle), fetches all three
 * routes (f-s, f-v-s, s-v) and merges.
 *
 * @param props.routeAbbrev - Route abbreviation (e.g. "sea-bi" or "f-v-s" for triangle)
 * @param props.tripDate - Sailing day in YYYY-MM-DD format
 * @param props.children - Child components
 */
export const UnifiedTripsProvider = ({
  routeAbbrev,
  tripDate,
  children,
}: UnifiedTripsProviderProps) => {
  const [state, setState] = useState<UnifiedTripsContextType>({
    unifiedTrips: {},
    isLoading: true,
    error: null,
  });

  const handleError = (error: string) => {
    setState((prev) => ({
      ...prev,
      error,
      isLoading: false,
    }));
  };

  return (
    <UnifiedTripsContext.Provider value={state}>
      <UnifiedTripsErrorBoundary onError={handleError} fallback={children}>
        <UnifiedTripsDataFetcher
          routeAbbrev={routeAbbrev}
          tripDate={tripDate}
          onStateChange={(partial) =>
            setState((prev) => ({ ...prev, ...partial }))
          }
        >
          {children}
        </UnifiedTripsDataFetcher>
      </UnifiedTripsErrorBoundary>
    </UnifiedTripsContext.Provider>
  );
};

/**
 * Hook to access unified trips data.
 *
 * @returns Unified trips record, loading state, and error
 * @throws Error if used outside UnifiedTripsProvider
 */
export const useUnifiedTrips = () => {
  const context = useContext(UnifiedTripsContext);
  if (context === undefined) {
    throw new Error("useUnifiedTrips must be used within UnifiedTripsProvider");
  }
  return context;
};

/**
 * Build a record mapping composite Key to unified trip data with denormalized fields.
 * Only includes trips that have a Key.
 *
 * @param scheduledTrips - Direct scheduled trips (all have Key)
 * @param activeVesselTrips - Active vessel trips (Key optional)
 * @param completedVesselTrips - Completed vessel trips (Key optional)
 * @returns Record mapping Key to UnifiedTrip
 */
const buildUnifiedTripRecord = (
  scheduledTrips: ScheduledTrip[],
  activeVesselTrips: VesselTrip[],
  completedVesselTrips: VesselTrip[]
): UnifiedTripRecord => {
  const keys = new Set(
    [scheduledTrips, activeVesselTrips, completedVesselTrips].flatMap((trips) =>
      trips.map((t) => t.Key).filter((k): k is string => k != null)
    )
  );

  const scheduledByKey = new Map(
    scheduledTrips.map((t) => [t.Key, t] as const)
  );
  const activeByKey = new Map(
    activeVesselTrips.flatMap((t) => (t.Key ? [[t.Key, t] as const] : []))
  );
  const completedByKey = new Map(
    completedVesselTrips.flatMap((t) => (t.Key ? [[t.Key, t] as const] : []))
  );

  return Object.fromEntries(
    [...keys].map((key) => {
      const scheduled = scheduledByKey.get(key);
      const active = activeByKey.get(key);
      const completed = completedByKey.get(key);
      const source = scheduled ?? active ?? completed;
      const scheduledDeparture = scheduled
        ? scheduled.DepartingTime
        : ((active ?? completed)?.ScheduledDeparture ?? new Date(0));
      const departingTerminalAbbrev = source?.DepartingTerminalAbbrev ?? "";
      const arrivingTerminalAbbrev = source?.ArrivingTerminalAbbrev ?? "";
      const vesselAbbrev = source?.VesselAbbrev ?? "";
      const routeAbbrev = source?.RouteAbbrev ?? "";

      return [
        key,
        {
          scheduledTrip: scheduled,
          activeVesselTrip: active,
          completedVesselTrip: completed,
          key,
          vesselAbbrev,
          routeAbbrev,
          departingTerminalAbbrev,
          arrivingTerminalAbbrev,
          scheduledDeparture,
        },
      ];
    })
  ) as UnifiedTripRecord;
};

export type { UnifiedTrip, UnifiedTripRecord };
export {
  expandRouteAbbrev,
  resolveIndirectToSegments,
  SOUTH_SOUND_TRIANGLE_ROUTE_GROUP,
} from "./unifiedTripsHelpers";
