/**
 * Convex-backed vessel timeline context.
 *
 * This provider fetches the backend-owned vessel-day timeline snapshot plus
 * the compact backend-resolved active state for one vessel/day scope.
 */

import { api } from "convex/_generated/api";
import type {
  VesselTimelineSegment,
  VesselTimelineSnapshot,
} from "convex/functions/vesselTimeline/schemas";
import { toDomainVesselTimelineSnapshot } from "convex/functions/vesselTimeline/schemas";
import type {
  VesselTimelineActiveState,
  VesselTimelineLiveState,
} from "convex/functions/vesselTripEvents/activeStateSchemas";
import { toDomainVesselTimelineActiveStateSnapshot } from "convex/functions/vesselTripEvents/activeStateSchemas";
import { useQuery } from "convex/react";
import type { PropsWithChildren, ReactNode } from "react";
import { createContext, Component as ReactComponent, useContext } from "react";

export type {
  VesselTimelineActiveState,
  VesselTimelineLiveState,
  VesselTimelineSegment,
  VesselTimelineSnapshot,
};

type ConvexVesselTimelineContextType = {
  VesselAbbrev: string;
  SailingDay: string;
  Segments: VesselTimelineSegment[];
  LiveState: VesselTimelineLiveState | null;
  ActiveState: VesselTimelineActiveState | null;
  IsLoading: boolean;
  ErrorMessage: string | null;
  Retry: () => void;
};

type ConvexVesselTimelineProviderProps = PropsWithChildren<{
  vesselAbbrev: string;
  sailingDay: string;
  onRetry: () => void;
}>;

const ConvexVesselTimelineContext = createContext<
  ConvexVesselTimelineContextType | undefined
>(undefined);

class ConvexVesselTimelineErrorBoundary extends ReactComponent<
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
        this.state.errorMessage ?? "Failed to load vessel timeline"
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
const ConvexVesselTimelineQueryProvider = ({
  vesselAbbrev,
  sailingDay,
  onRetry,
  children,
}: PropsWithChildren<{
  vesselAbbrev: string;
  sailingDay: string;
  onRetry: () => void;
}>) => {
  const rawSnapshot = useQuery(
    api.functions.vesselTimeline.queries.getVesselDayTimelineSnapshot,
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

  const IsLoading = rawSnapshot === undefined || rawActiveState === undefined;
  const snapshot = rawSnapshot
    ? toDomainVesselTimelineSnapshot(rawSnapshot)
    : null;
  const activeStateSnapshot = rawActiveState
    ? toDomainVesselTimelineActiveStateSnapshot(rawActiveState)
    : null;
  const value: ConvexVesselTimelineContextType = {
    VesselAbbrev: vesselAbbrev,
    SailingDay: sailingDay,
    Segments: snapshot?.Segments ?? [],
    LiveState: activeStateSnapshot?.Live ?? null,
    ActiveState: activeStateSnapshot?.ActiveState ?? null,
    IsLoading,
    ErrorMessage: null,
    Retry: onRetry,
  };

  return (
    <ConvexVesselTimelineContext.Provider value={value}>
      {children}
    </ConvexVesselTimelineContext.Provider>
  );
};

export const ConvexVesselTimelineProvider = ({
  vesselAbbrev,
  sailingDay,
  onRetry,
  children,
}: ConvexVesselTimelineProviderProps) => {
  const errorValue: ConvexVesselTimelineContextType = {
    VesselAbbrev: vesselAbbrev,
    SailingDay: sailingDay,
    Segments: [],
    LiveState: null,
    ActiveState: null,
    IsLoading: false,
    ErrorMessage: "Live timeline data is temporarily unavailable.",
    Retry: onRetry,
  };

  return (
    <ConvexVesselTimelineErrorBoundary
      fallback={(errorMessage) => (
        <ConvexVesselTimelineContext.Provider
          value={{
            ...errorValue,
            ErrorMessage: errorMessage,
          }}
        >
          {children}
        </ConvexVesselTimelineContext.Provider>
      )}
    >
      <ConvexVesselTimelineQueryProvider
        vesselAbbrev={vesselAbbrev}
        sailingDay={sailingDay}
        onRetry={onRetry}
      >
        {children}
      </ConvexVesselTimelineQueryProvider>
    </ConvexVesselTimelineErrorBoundary>
  );
};

export const useConvexVesselTimeline = () => {
  const context = useContext(ConvexVesselTimelineContext);
  if (context === undefined) {
    throw new Error(
      "useConvexVesselTimeline must be used within ConvexVesselTimelineProvider"
    );
  }

  return context;
};
