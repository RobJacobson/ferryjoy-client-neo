/**
 * Convex-backed route timeline context.
 *
 * This provider fetches the backend-owned route/day timeline snapshot and
 * exposes a domain-converted contract to timeline consumers.
 */

import { api } from "convex/_generated/api";
import {
  type RouteTimelineSnapshot,
  type RouteTimelineVessel,
  toDomainRouteTimelineSnapshot,
} from "convex/functions/routeTimeline";
import { useQuery } from "convex/react";
import type { PropsWithChildren, ReactNode } from "react";
import { createContext, Component as ReactComponent, useContext } from "react";

type ConvexRouteTimelineContextType = {
  routeAbbrev: string;
  sailingDay: string;
  vesselAbbrev?: string;
  windowStart?: Date;
  windowEnd?: Date;
  snapshot: RouteTimelineSnapshot | null;
  vessels: RouteTimelineVessel[];
  isLoading: boolean;
  errorMessage: string | null;
  retry: () => void;
};

type ConvexRouteTimelineProviderProps = PropsWithChildren<{
  routeAbbrev: string;
  sailingDay: string;
  vesselAbbrev?: string;
  windowStart?: Date;
  windowEnd?: Date;
  onRetry?: () => void;
}>;

const ConvexRouteTimelineContext = createContext<
  ConvexRouteTimelineContextType | undefined
>(undefined);

class ConvexRouteTimelineErrorBoundary extends ReactComponent<
  {
    fallback: (error: string) => ReactNode;
    children: ReactNode;
  },
  {
    hasError: boolean;
    errorMessage: string | null;
  }
> {
  override state = { hasError: false, errorMessage: null };

  /**
   * Mirrors React error-boundary state shape after a child throws.
   *
   * @returns Error-boundary state patch
   */
  static getDerivedStateFromError() {
    return { hasError: true };
  }

  /**
   * Captures the thrown error so the fallback can show a concrete message.
   *
   * @param error - Unknown render or query error
   */
  override componentDidCatch(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.setState({ errorMessage: message });
  }

  /**
   * Renders either the fallback tree or the normal descendants.
   *
   * @returns Fallback UI context or children
   */
  override render() {
    if (this.state.hasError) {
      return this.props.fallback(
        this.state.errorMessage ?? "Failed to load route timeline snapshot"
      );
    }

    return this.props.children;
  }
}

/**
 * Query-backed provider body exposing route timeline snapshot query state.
 *
 * @param props - Provider props
 * @param props.routeAbbrev - Route abbreviation for the query scope
 * @param props.sailingDay - Sailing day for the query scope
 * @param props.vesselAbbrev - Optional vessel filter for snapshot narrowing
 * @param props.windowStart - Optional window-start filter as Date
 * @param props.windowEnd - Optional window-end filter as Date
 * @param props.onRetry - Optional callback used to remount on retry
 * @param props.children - Descendant React tree consuming the context
 * @returns Context provider populated from the Convex route timeline query
 */
const ConvexRouteTimelineQueryProvider = ({
  routeAbbrev,
  sailingDay,
  vesselAbbrev,
  windowStart,
  windowEnd,
  onRetry,
  children,
}: ConvexRouteTimelineProviderProps) => {
  const retry = onRetry ?? (() => {});
  const rawSnapshot = useQuery(
    api.functions.routeTimeline.queries.getRouteTimelineSnapshot,
    {
      RouteAbbrev: routeAbbrev,
      SailingDay: sailingDay,
      VesselAbbrev: vesselAbbrev,
      WindowStart: windowStart?.getTime(),
      WindowEnd: windowEnd?.getTime(),
    }
  );
  const snapshot = rawSnapshot
    ? toDomainRouteTimelineSnapshot(rawSnapshot)
    : null;
  const isLoading = rawSnapshot === undefined;

  const value: ConvexRouteTimelineContextType = {
    routeAbbrev,
    sailingDay,
    vesselAbbrev,
    windowStart,
    windowEnd,
    snapshot,
    vessels: snapshot?.Vessels ?? [],
    isLoading,
    errorMessage: null,
    retry,
  };

  return (
    <ConvexRouteTimelineContext.Provider value={value}>
      {children}
    </ConvexRouteTimelineContext.Provider>
  );
};

/**
 * Error-boundary wrapper around the query-backed route timeline provider.
 *
 * @param props - Provider props
 * @param props.routeAbbrev - Route abbreviation for the query scope
 * @param props.sailingDay - Sailing day for the query scope
 * @param props.vesselAbbrev - Optional vessel filter for snapshot narrowing
 * @param props.windowStart - Optional window-start filter as Date
 * @param props.windowEnd - Optional window-end filter as Date
 * @param props.onRetry - Optional callback used to remount on retry
 * @param props.children - Descendant React tree consuming the context
 * @returns Provider tree with a fallback error context
 */
export const ConvexRouteTimelineProvider = ({
  routeAbbrev,
  sailingDay,
  vesselAbbrev,
  windowStart,
  windowEnd,
  onRetry,
  children,
}: ConvexRouteTimelineProviderProps) => {
  const retry = onRetry ?? (() => {});
  const errorValue: ConvexRouteTimelineContextType = {
    routeAbbrev,
    sailingDay,
    vesselAbbrev,
    windowStart,
    windowEnd,
    snapshot: null,
    vessels: [],
    isLoading: false,
    errorMessage: "Route timeline data is temporarily unavailable.",
    retry,
  };

  return (
    <ConvexRouteTimelineErrorBoundary
      fallback={(errorMessage) => (
        <ConvexRouteTimelineContext.Provider
          value={{
            ...errorValue,
            errorMessage,
          }}
        >
          {children}
        </ConvexRouteTimelineContext.Provider>
      )}
    >
      <ConvexRouteTimelineQueryProvider
        routeAbbrev={routeAbbrev}
        sailingDay={sailingDay}
        vesselAbbrev={vesselAbbrev}
        windowStart={windowStart}
        windowEnd={windowEnd}
        onRetry={onRetry}
      >
        {children}
      </ConvexRouteTimelineQueryProvider>
    </ConvexRouteTimelineErrorBoundary>
  );
};

/**
 * Reads route timeline snapshot state from context.
 *
 * @returns Route timeline query state for the current provider scope
 */
export const useConvexRouteTimeline = () => {
  const context = useContext(ConvexRouteTimelineContext);
  if (context === undefined) {
    throw new Error(
      "useConvexRouteTimeline must be used within ConvexRouteTimelineProvider"
    );
  }

  return context;
};
