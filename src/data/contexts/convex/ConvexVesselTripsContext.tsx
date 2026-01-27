/**
 * Convex-backed vessel trips context.
 *
 * Includes a “hold window” behavior for UI stability: when a vessel’s active
 * trip changes (or disappears), we keep showing the previous trip for a short
 * period so downstream UI doesn’t flicker.
 */

import { api } from "convex/_generated/api";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { toDomainVesselTrip } from "convex/functions/vesselTrips/schemas";
import { useQuery } from "convex/react";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useInterval } from "@/shared/hooks";

export type { VesselTrip };

const ARRIVAL_HOLD_DURATION_MS = 20 * 1000; // 20 seconds

/**
 * Type definition for the Convex Vessel Trips context value
 *
 * Provides access to vessel trips data with loading and error states
 */
type ConvexVesselTripsContextType = {
  /** Array of current active vessel trips converted to domain values */
  activeVesselTrips: VesselTrip[];
  /** Record of delayed vessel trips */
  delayedVesselTrips: VesselTrip[];
  /** Loading state for vessel trips data */
  isLoading: boolean;
  /** Error state for vessel trips data */
  error: string | null;
};

/**
 * React context for sharing vessel trips data across the app.
 *
 * This context provides access to vessel trips data with loading and error states.
 * It fetches active and completed vessel trips from Convex and transforms them into domain values.
 * Components can consume this context using the useConvexVesselTrips hook.
 */
const ConvexVesselTripsContext = createContext<
  ConvexVesselTripsContextType | undefined
>(undefined);

/**
 * Provider component that manages vessel trips data from Convex.
 *
 * This component fetches active and completed vessel trips from Convex,
 * transforms them into domain values,
 * and provides this data to child components through the context.
 *
 * @example
 * ```tsx
 * <ConvexVesselTripsProvider>
 *   <App />
 * </ConvexVesselTripsProvider>
 * ```
 *
 * @param props - Component props
 * @param props.children - Child components that will have access to the vessel trips data
 * @returns A context provider component
 */
export const ConvexVesselTripsProvider = ({ children }: PropsWithChildren) => {
  // Fetch all active vessel trips from Convex.
  // `useQuery` returns `undefined` while loading, so keep that distinct from
  // "loaded but empty".
  const rawActiveTrips = useQuery(
    api.functions.vesselTrips.queries.getActiveTrips,
  );
  const activeTrips = useMemo(
    () => rawActiveTrips?.map(toDomainVesselTrip) ?? [],
    [rawActiveTrips],
  );

  const isLoading = rawActiveTrips === undefined;
  const error: string | null = null;
  const [delayedVesselTripsByAbbrev, setDelayedVesselTripsByAbbrev] = useState<
    Record<string, VesselTrip>
  >({});

  const delayedVesselTrips = useMemo(
    () => Object.values(delayedVesselTripsByAbbrev),
    [delayedVesselTripsByAbbrev],
  );

  // Reconcile immediately when active trips change (prevents UI flicker).
  useEffect(() => {
    const nowMs = Date.now();
    setDelayedVesselTripsByAbbrev((prev) =>
      reconcileDelayedVesselTrips(prev, activeTrips, nowMs),
    );
  }, [activeTrips]);

  // Reconcile periodically so held trips can expire.
  useInterval(() => {
    const nowMs = Date.now();
    setDelayedVesselTripsByAbbrev((prev) =>
      reconcileDelayedVesselTrips(prev, activeTrips, nowMs),
    );
  }, 5000);

  const contextValue: ConvexVesselTripsContextType = {
    activeVesselTrips: activeTrips,
    isLoading,
    error,
    delayedVesselTrips,
  };
  return (
    <ConvexVesselTripsContext.Provider value={contextValue}>
      {children}
    </ConvexVesselTripsContext.Provider>
  );
};

/**
 * Hook to access vessel trips data with loading and error states.
 *
 * Provides vessel trips data with consistent loading and error states.
 * Must be used within a ConvexVesselTripsProvider component.
 *
 * @example
 * ```tsx
 * const { activeVesselTrips, completedVesselTrips, isLoading, error } = useConvexVesselTrips();
 * if (isLoading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage error={error} />;
 * return <VesselTripsList activeTrips={activeVesselTrips} completedTrips={completedVesselTrips} />;
 * ```
 *
 * @returns Object with active vessel trips, completed vessel trips, loading state, and error state
 * @throws Error if used outside of ConvexVesselTripsProvider
 */
export const useConvexVesselTrips = () => {
  const context = useContext(ConvexVesselTripsContext);
  if (context === undefined) {
    throw new Error(
      "useConvexVesselTrips must be used within ConvexVesselTripsProvider",
    );
  }
  return context;
};

// ============================================================================
// Helpers
// ============================================================================

type ResolveDelayedTripArgs = {
  prevTrip: VesselTrip | undefined;
  activeTrip: VesselTrip | undefined;
  nowMs: number;
};

/**
 * Reconciles the delayed-trip record with the current active trips.
 *
 * Rules:
 * - If an active trip exists and it matches the currently-shown trip `Key`,
 *   show the active trip (allows live updates).
 * - If the active trip `Key` changes, keep showing the previous trip for 20s
 *   after it ends, ignoring the replacement during that window.
 * - If a trip disappears entirely, treat that as an end event: set `TripEnd`
 *   once, keep it for 20s, then drop it.
 *
 * @param prev - Previously delayed trips by vessel abbrev
 * @param activeTrips - Current active trips list from Convex
 * @param nowMs - Current wall time in milliseconds
 * @returns Next delayed trips record (returns `prev` if unchanged)
 */
const reconcileDelayedVesselTrips = (
  prev: Record<string, VesselTrip>,
  activeTrips: VesselTrip[],
  nowMs: number,
): Record<string, VesselTrip> => {
  const activeByAbbrev: Record<string, VesselTrip> = {};
  for (const trip of activeTrips) {
    activeByAbbrev[trip.VesselAbbrev] = trip;
  }

  const allAbbrevs = new Set<string>([
    ...Object.keys(prev),
    ...Object.keys(activeByAbbrev),
  ]);

  let changed = false;
  const next: Record<string, VesselTrip> = {};

  allAbbrevs.forEach((abbrev) => {
    const prevTrip = prev[abbrev];
    const activeTrip = activeByAbbrev[abbrev];

    const resolved = resolveDelayedTrip({ prevTrip, activeTrip, nowMs });
    if (resolved) {
      next[abbrev] = resolved;
    }

    const prevHas = Object.hasOwn(prev, abbrev);
    const nextHas = resolved !== null;

    if (prevHas !== nextHas) {
      changed = true;
      return;
    }

    if (prevHas && nextHas && prevTrip.TimeStamp !== resolved.TimeStamp) {
      changed = true;
    }
  });

  return changed ? next : prev;
};

/**
 * Resolves what trip should be shown for a vessel, given the current shown
 * trip and the latest active trip (if any).
 *
 * @param args - Resolution inputs
 * @param args.prevTrip - Currently shown trip for the vessel (if any)
 * @param args.activeTrip - Latest active trip for the vessel (if any)
 * @param args.nowMs - Current wall time in milliseconds
 * @returns Trip to show, or `null` if nothing should be shown
 */
const resolveDelayedTrip = ({
  prevTrip,
  activeTrip,
  nowMs,
}: ResolveDelayedTripArgs): VesselTrip | null => {
  if (!prevTrip) {
    return activeTrip ?? null;
  }

  if (!activeTrip) {
    // Trip disappeared: end+hold+expire.
    const ended = ensureTripEnded(prevTrip, nowMs);
    return shouldHoldTrip(ended, nowMs) ? ended : null;
  }

  if (prevTrip.Key === activeTrip.Key) {
    // Same logical trip; allow updates from active data.
    return activeTrip;
  }

  // Active trip changed: keep showing the previous trip for a short window.
  const endedPrev = ensureTripEnded(prevTrip, nowMs);
  return shouldHoldTrip(endedPrev, nowMs) ? endedPrev : activeTrip;
};

/**
 * Ensures a trip has a `TripEnd` time. If missing, sets it to `nowMs`.
 *
 * @param trip - Trip to end (if needed)
 * @param nowMs - Current wall time in milliseconds
 * @returns Trip with `TripEnd` populated
 */
const ensureTripEnded = (trip: VesselTrip, nowMs: number): VesselTrip => {
  if (trip.TripEnd) return trip;
  return { ...trip, TripEnd: new Date(nowMs) };
};

/**
 * Returns true if we should keep showing a trip in its arrival hold window.
 *
 * @param trip - Trip to evaluate
 * @param nowMs - Current wall time in milliseconds
 * @returns True when the hold window has not expired
 */
const shouldHoldTrip = (trip: VesselTrip, nowMs: number): boolean => {
  const endedAtMs = trip.TripEnd?.getTime();
  if (endedAtMs === undefined) return true;
  return nowMs - endedAtMs < ARRIVAL_HOLD_DURATION_MS;
};
