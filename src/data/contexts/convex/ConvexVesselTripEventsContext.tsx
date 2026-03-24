/**
 * Convex-backed vessel trip events context.
 *
 * This provider fetches the backend-owned vessel-day event feed plus the
 * compact backend-resolved active state for one vessel/day scope.
 */

import { api } from "convex/_generated/api";
import type {
  VesselTimelineActiveState,
  VesselTimelineLiveState,
} from "convex/functions/vesselTripEvents/activeStateSchemas";
import { toDomainVesselTimelineActiveStateSnapshot } from "convex/functions/vesselTripEvents/activeStateSchemas";
import type { VesselTripEvent } from "convex/functions/vesselTripEvents/schemas";
import { toDomainVesselTripEvent } from "convex/functions/vesselTripEvents/schemas";
import { useQuery } from "convex/react";
import type { PropsWithChildren, ReactNode } from "react";
import {
  createContext,
  Component as ReactComponent,
  useContext,
} from "react";

export type VesselTimelineEvent = VesselTripEvent;
export type {
  VesselTimelineActiveState,
  VesselTimelineLiveState,
};

type ConvexVesselTripEventsContextType = {
  VesselAbbrev: string;
  SailingDay: string;
  Events: VesselTimelineEvent[];
  LiveState: VesselTimelineLiveState | null;
  ActiveState: VesselTimelineActiveState | null;
  IsLoading: boolean;
  Error: string | null;
};

type ConvexVesselTripEventsProviderProps = PropsWithChildren<{
  vesselAbbrev: string;
  sailingDay: string;
}>;

const ConvexVesselTripEventsContext = createContext<
  ConvexVesselTripEventsContextType | undefined
>(undefined);

class ConvexVesselTripEventsErrorBoundary extends ReactComponent<{
  fallback: (error: string) => ReactNode;
  children: ReactNode;
}, {
  hasError: boolean;
  errorMessage: string | null;
}> {
  override state = { hasError: false, errorMessage: null };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.setState({ errorMessage: message });
  }

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
 * Query-backed provider body that derives its value directly from Convex.
 *
 * @param props - Provider props
 * @param props.vesselAbbrev - Vessel abbreviation for both queries
 * @param props.sailingDay - Sailing day for both queries
 * @param props.children - Descendant React tree consuming the context
 * @returns Context provider populated from live query results
 */
const ConvexVesselTripEventsQueryProvider = ({
  vesselAbbrev,
  sailingDay,
  children,
}: PropsWithChildren<{
  vesselAbbrev: string;
  sailingDay: string;
}>) => {
  const rawTimeline = useQuery(
    api.functions.vesselTripEvents.queries.getVesselDayTimelineEvents,
    {
      VesselAbbrev: vesselAbbrev,
      SailingDay: sailingDay,
    }
  );
  const rawActiveState = useQuery(
    api.functions.vesselTripEvents.queries.getVesselDayActiveState,
    {
      VesselAbbrev: vesselAbbrev,
      SailingDay: sailingDay,
    }
  );

  const IsLoading = rawTimeline === undefined || rawActiveState === undefined;
  const Events = rawTimeline?.Events.map(toDomainVesselTripEvent) ?? [];
  const activeStateSnapshot = rawActiveState
    ? toDomainVesselTimelineActiveStateSnapshot(rawActiveState)
    : null;
  const value: ConvexVesselTripEventsContextType = {
    VesselAbbrev: vesselAbbrev,
    SailingDay: sailingDay,
    Events,
    LiveState: activeStateSnapshot?.Live ?? null,
    ActiveState: activeStateSnapshot?.ActiveState ?? null,
    IsLoading,
    Error: null,
  };

  return (
    <ConvexVesselTripEventsContext.Provider value={value}>
      {children}
    </ConvexVesselTripEventsContext.Provider>
  );
};

export const ConvexVesselTripEventsProvider = ({
  vesselAbbrev,
  sailingDay,
  children,
}: ConvexVesselTripEventsProviderProps) => {
  const errorValue: ConvexVesselTripEventsContextType = {
    VesselAbbrev: vesselAbbrev,
    SailingDay: sailingDay,
    Events: [],
    LiveState: null,
    ActiveState: null,
    IsLoading: false,
    Error: "Failed to load vessel timeline events",
  };

  return (
    <ConvexVesselTripEventsErrorBoundary
      fallback={(errorMessage) => (
        <ConvexVesselTripEventsContext.Provider
          value={{
            ...errorValue,
            Error: errorMessage,
          }}
        >
          {children}
        </ConvexVesselTripEventsContext.Provider>
      )}
    >
      <ConvexVesselTripEventsQueryProvider
        vesselAbbrev={vesselAbbrev}
        sailingDay={sailingDay}
      >
        {children}
      </ConvexVesselTripEventsQueryProvider>
    </ConvexVesselTripEventsErrorBoundary>
  );
};

export const useConvexVesselTripEvents = () => {
  const context = useContext(ConvexVesselTripEventsContext);
  if (context === undefined) {
    throw new Error(
      "useConvexVesselTripEvents must be used within ConvexVesselTripEventsProvider"
    );
  }

  return context;
};
