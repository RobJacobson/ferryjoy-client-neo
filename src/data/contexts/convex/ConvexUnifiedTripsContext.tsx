/**
 * ConvexUnifiedTripsContext - Joins scheduled, active, and completed trips by composite key.
 *
 * Fetches route-scoped trip data via Convex subscriptions and stitches them into
 * a single Record<key, UnifiedTrip>. Each key maps to at most one scheduled trip,
 * one active trip, and one completed trip (active and completed are mutually exclusive).
 *
 * Supports direct trips only (backend filter).
 */

import { api } from "convex/_generated/api";
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
  type ScheduledTrip,
  toDomainScheduledTrip,
  toDomainVesselTrip,
  type VesselTrip,
} from "@/types";

// ============================================================================
// Types
// ============================================================================

type UnifiedTrip = {
  scheduledTrip?: ScheduledTrip;
  activeVesselTrip?: VesselTrip;
  completedVesselTrip?: VesselTrip;
  /** Denormalized for filtering/grouping */
  key: string;
  vesselAbbrev: string;
  routeAbbrev: string;
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev: string;
  scheduledDeparture: Date;
};

type UnifiedTripRecord = Record<string, UnifiedTrip>;

// ============================================================================
// Context
// ============================================================================

type ConvexUnifiedTripsContextType = {
  /** Record mapping composite Key to unified trip (scheduled, active, completed) */
  unifiedTrips: UnifiedTripRecord;
  /** True while any of the queries is loading */
  isLoading: boolean;
  /** Error message if any query failed; null when no error */
  error: string | null;
};

const ConvexUnifiedTripsContext = createContext<
  ConvexUnifiedTripsContextType | undefined
>(undefined);

type ConvexUnifiedTripsProviderProps = PropsWithChildren<{
  routeAbbrevs: string[];
  tripDate: string;
}>;

/**
 * Error boundary that catches query errors and reports them via callback.
 * When an error occurs, renders fallback (user children) so consumers can show
 * error UI from context; does not re-render the failing DataFetcher.
 */
class ConvexUnifiedTripsErrorBoundary extends ReactComponent<{
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
 * Throws on query error; ConvexUnifiedTripsErrorBoundary catches and reports.
 */
const ConvexUnifiedTripsDataFetcher = ({
  routeAbbrevs: routeAbbrevsProp,
  tripDate,
  onStateChange,
  children,
}: PropsWithChildren<{
  routeAbbrevs: string[];
  tripDate: string;
  onStateChange: (state: Partial<ConvexUnifiedTripsContextType>) => void;
}>) => {
  const routeAbbrevs = expandRouteAbbrevs(routeAbbrevsProp);

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
 * Provider that fetches scheduled, active, and completed trips for routes
 * and trip date, then stitches them into a unified record by composite key.
 *
 * @param props.routeAbbrevs - Array of internal route abbreviations (e.g. ["sea-bi"] or ["sea-bi","sea-br"] or ["f-v-s"])
 * @param props.tripDate - Sailing day in YYYY-MM-DD format
 * @param props.children - Child components
 */
export const UnifiedTripsProvider = ({
  routeAbbrevs,
  tripDate,
  children,
}: ConvexUnifiedTripsProviderProps) => {
  const [state, setState] = useState<ConvexUnifiedTripsContextType>({
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
    <ConvexUnifiedTripsContext.Provider value={state}>
      <ConvexUnifiedTripsErrorBoundary
        onError={handleError}
        fallback={children}
      >
        <ConvexUnifiedTripsDataFetcher
          routeAbbrevs={routeAbbrevs}
          tripDate={tripDate}
          onStateChange={(partial) =>
            setState((prev) => ({ ...prev, ...partial }))
          }
        >
          {children}
        </ConvexUnifiedTripsDataFetcher>
      </ConvexUnifiedTripsErrorBoundary>
    </ConvexUnifiedTripsContext.Provider>
  );
};

/**
 * Hook to access unified trips data.
 *
 * @returns Unified trips record, loading state, and error
 * @throws Error if used outside UnifiedTripsProvider
 */
export const useUnifiedTrips = () => {
  const context = useContext(ConvexUnifiedTripsContext);
  if (context === undefined) {
    throw new Error("useUnifiedTrips must be used within UnifiedTripsProvider");
  }
  return context;
};

// ============================================================================
// Internal
// ============================================================================

/**
 * Build a record mapping schedule segment key to unified trip data with denormalized fields.
 * Scheduled rows use `Key`; vessel trips use `ScheduleKey` when aligned.
 *
 * @param scheduledTrips - Direct scheduled trips (all have Key)
 * @param activeVesselTrips - Active vessel trips (ScheduleKey optional)
 * @param completedVesselTrips - Completed vessel trips (ScheduleKey optional)
 * @returns Record mapping segment key to UnifiedTrip
 */
const buildUnifiedTripRecord = (
  scheduledTrips: ScheduledTrip[],
  activeVesselTrips: VesselTrip[],
  completedVesselTrips: VesselTrip[]
): UnifiedTripRecord => {
  const keys = new Set<string>();
  for (const t of scheduledTrips) {
    keys.add(t.Key);
  }
  for (const t of activeVesselTrips) {
    if (t.ScheduleKey) keys.add(t.ScheduleKey);
  }
  for (const t of completedVesselTrips) {
    if (t.ScheduleKey) keys.add(t.ScheduleKey);
  }

  const scheduledByKey = new Map(
    scheduledTrips.map((t) => [t.Key, t] as const)
  );
  const activeByKey = new Map(
    activeVesselTrips.flatMap((t) =>
      t.ScheduleKey ? [[t.ScheduleKey, t] as const] : []
    )
  );
  const completedByKey = new Map(
    completedVesselTrips.flatMap((t) =>
      t.ScheduleKey ? [[t.ScheduleKey, t] as const] : []
    )
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

// ============================================================================
// Helpers
// ============================================================================

/**
 * Wraps a single route abbreviation in an array for consistency with multi-route APIs.
 * Backend normalizes all triangle routes to "f-v-s"; no expansion needed.
 *
 * @param routeAbbrev - Route abbreviation (e.g. "sea-bi" or "f-v-s")
 * @returns Single-element array
 */
const expandRouteAbbrevs = (routeAbbrevs: string[]): string[] => [
  ...new Set(routeAbbrevs),
];
