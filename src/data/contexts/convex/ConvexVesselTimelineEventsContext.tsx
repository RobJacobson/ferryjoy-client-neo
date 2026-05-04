/**
 * Convex-backed vessel-day dock event row context.
 *
 * Subscribes to scheduled, actual, and predicted list queries for one vessel
 * and sailing day. Stage 2 only exposes data; timeline rendering still uses
 * the route timeline snapshot.
 */

import { api } from "convex/_generated/api";
import { useQuery } from "convex/react";
import type { PropsWithChildren, ReactNode } from "react";
import { createContext, Component as ReactComponent, useContext } from "react";
import {
  buildConvexVesselTimelineEventsContextValue,
  type ConvexVesselTimelineEventsContextType,
} from "./convexVesselTimelineEventsValue";

type ConvexVesselTimelineEventsProviderProps = PropsWithChildren<{
  vesselAbbrev: string;
  sailingDay: string;
  onRetry?: () => void;
}>;

const ConvexVesselTimelineEventsContext = createContext<
  ConvexVesselTimelineEventsContextType | undefined
>(undefined);

class ConvexVesselTimelineEventsErrorBoundary extends ReactComponent<
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
        this.state.errorMessage ?? "Failed to load vessel timeline events"
      );
    }

    return this.props.children;
  }
}

/**
 * Query-backed provider body for the three vessel-day dock event list queries.
 *
 * @param props - Provider props
 * @param props.vesselAbbrev - Vessel abbreviation for all three queries
 * @param props.sailingDay - Sailing day `YYYY-MM-DD` for all three queries
 * @param props.onRetry - Optional callback used to remount on retry
 * @param props.children - Descendant React tree consuming the context
 * @returns Context provider populated from Convex queries
 */
const ConvexVesselTimelineEventsQueryProvider = ({
  vesselAbbrev,
  sailingDay,
  onRetry,
  children,
}: ConvexVesselTimelineEventsProviderProps) => {
  const retry = onRetry ?? (() => {});
  // Convex `api` nests `functions/events/*` under `api.functions.events.*`
  // (directory layout), not under the flat `functions/index.ts` re-exports.
  const scheduledRaw = useQuery(
    api.functions.events.eventsScheduled.queries
      .listScheduledDockEventsForVesselSailingDay,
    { vesselAbbrev, sailingDay }
  );
  const actualRaw = useQuery(
    api.functions.events.eventsActual.queries
      .listActualDockEventsForVesselSailingDay,
    { vesselAbbrev, sailingDay }
  );
  const predictedRaw = useQuery(
    api.functions.events.eventsPredicted.queries
      .listPredictedDockEventsForVesselSailingDay,
    { vesselAbbrev, sailingDay }
  );

  const value = buildConvexVesselTimelineEventsContextValue({
    vesselAbbrev,
    sailingDay,
    scheduledRaw,
    actualRaw,
    predictedRaw,
    retry,
  });

  return (
    <ConvexVesselTimelineEventsContext.Provider value={value}>
      {children}
    </ConvexVesselTimelineEventsContext.Provider>
  );
};

/**
 * Error-boundary wrapper around the vessel timeline events query provider.
 *
 * @param props - Provider props
 * @param props.vesselAbbrev - Vessel abbreviation for query scope
 * @param props.sailingDay - Sailing day for query scope
 * @param props.onRetry - Optional callback used to remount on retry
 * @param props.children - Descendant React tree consuming the context
 * @returns Provider tree with a fallback error context
 */
const ConvexVesselTimelineEventsProvider = ({
  vesselAbbrev,
  sailingDay,
  onRetry,
  children,
}: ConvexVesselTimelineEventsProviderProps) => {
  const retry = onRetry ?? (() => {});
  const errorValue: ConvexVesselTimelineEventsContextType = {
    vesselAbbrev,
    sailingDay,
    scheduledEvents: [],
    actualEvents: [],
    predictedEvents: [],
    isLoading: false,
    errorMessage: "Vessel timeline events are temporarily unavailable.",
    retry,
  };

  return (
    <ConvexVesselTimelineEventsErrorBoundary
      fallback={(errorMessage) => (
        <ConvexVesselTimelineEventsContext.Provider
          value={{
            ...errorValue,
            errorMessage,
          }}
        >
          {children}
        </ConvexVesselTimelineEventsContext.Provider>
      )}
    >
      <ConvexVesselTimelineEventsQueryProvider
        vesselAbbrev={vesselAbbrev}
        sailingDay={sailingDay}
        onRetry={onRetry}
      >
        {children}
      </ConvexVesselTimelineEventsQueryProvider>
    </ConvexVesselTimelineEventsErrorBoundary>
  );
};

/**
 * Reads vessel-day dock event query state from context.
 *
 * @returns Combined loading and row arrays for the current provider scope
 * @throws Error when used outside `ConvexVesselTimelineEventsProvider`
 */
const useConvexVesselTimelineEvents = () => {
  const context = useContext(ConvexVesselTimelineEventsContext);
  if (context === undefined) {
    throw new Error(
      "useConvexVesselTimelineEvents must be used within ConvexVesselTimelineEventsProvider"
    );
  }

  return context;
};

export type { ConvexVesselTimelineEventsContextType };
export { ConvexVesselTimelineEventsProvider, useConvexVesselTimelineEvents };
