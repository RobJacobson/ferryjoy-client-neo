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
  useEffect,
  useRef,
  useState,
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

const ConvexVesselTripEventsDataFetcher = ({
  vesselAbbrev,
  sailingDay,
  onStateChange,
  children,
}: PropsWithChildren<{
  vesselAbbrev: string;
  sailingDay: string;
  onStateChange: (state: Partial<ConvexVesselTripEventsContextType>) => void;
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
  const LiveState = activeStateSnapshot?.Live ?? null;
  const ActiveState = activeStateSnapshot?.ActiveState ?? null;

  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  useEffect(() => {
    onStateChangeRef.current({
      VesselAbbrev: vesselAbbrev,
      SailingDay: sailingDay,
      Events,
      LiveState,
      ActiveState,
      IsLoading,
      Error: null,
    });
  }, [
    vesselAbbrev,
    sailingDay,
    Events,
    LiveState,
    ActiveState,
    IsLoading,
  ]);

  return <>{children}</>;
};

export const ConvexVesselTripEventsProvider = ({
  vesselAbbrev,
  sailingDay,
  children,
}: ConvexVesselTripEventsProviderProps) => {
  const [state, setState] = useState<ConvexVesselTripEventsContextType>({
    VesselAbbrev: vesselAbbrev,
    SailingDay: sailingDay,
    Events: [],
    LiveState: null,
    ActiveState: null,
    IsLoading: true,
    Error: null,
  });

  const handleError = (errorMessage: string) => {
    setState((previous) => ({
      ...previous,
      VesselAbbrev: vesselAbbrev,
      SailingDay: sailingDay,
      Error: errorMessage,
      IsLoading: false,
    }));
  };

  return (
    <ConvexVesselTripEventsContext.Provider value={state}>
      <ConvexVesselTripEventsErrorBoundary
        onError={handleError}
        fallback={children}
      >
        <ConvexVesselTripEventsDataFetcher
          vesselAbbrev={vesselAbbrev}
          sailingDay={sailingDay}
          onStateChange={(partial) =>
            setState((previous) => ({ ...previous, ...partial }))
          }
        >
          {children}
        </ConvexVesselTripEventsDataFetcher>
      </ConvexVesselTripEventsErrorBoundary>
    </ConvexVesselTripEventsContext.Provider>
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
