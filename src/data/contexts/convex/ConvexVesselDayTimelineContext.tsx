/**
 * Convex-backed vessel-day timeline context.
 *
 * This provider fetches the backend-owned vessel-day event feed plus current
 * vessel location data for one vessel/day scope.
 */

import { api } from "convex/_generated/api";
import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import { toDomainVesselLocation } from "convex/functions/vesselLocation/schemas";
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

type ConvexVesselDayTimelineContextType = {
  VesselAbbrev: string;
  SailingDay: string;
  Events: VesselTimelineEvent[];
  VesselLocation?: VesselLocation;
  IsLoading: boolean;
  Error: string | null;
};

type ConvexVesselDayTimelineProviderProps = PropsWithChildren<{
  vesselAbbrev: string;
  sailingDay: string;
}>;

const ConvexVesselDayTimelineContext = createContext<
  ConvexVesselDayTimelineContextType | undefined
>(undefined);

class ConvexVesselDayTimelineErrorBoundary extends ReactComponent<{
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
  const rawTimeline = useQuery(
    api.functions.vesselTripEvents.queries.getVesselDayTimelineEvents,
    {
      VesselAbbrev: vesselAbbrev,
      SailingDay: sailingDay,
    }
  );
  const rawVesselLocation = useQuery(
    api.functions.vesselLocation.queries.getByVesselAbbrev,
    {
      vesselAbbrev,
    }
  );

  const IsLoading =
    rawTimeline === undefined || rawVesselLocation === undefined;
  const Events = rawTimeline?.Events.map(toDomainVesselTripEvent) ?? [];
  const VesselLocation = rawVesselLocation
    ? toDomainVesselLocation(rawVesselLocation)
    : undefined;

  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  useEffect(() => {
    onStateChangeRef.current({
      VesselAbbrev: vesselAbbrev,
      SailingDay: sailingDay,
      Events,
      VesselLocation,
      IsLoading,
      Error: null,
    });
  }, [vesselAbbrev, sailingDay, Events, VesselLocation, IsLoading]);

  return <>{children}</>;
};

export const ConvexVesselDayTimelineProvider = ({
  vesselAbbrev,
  sailingDay,
  children,
}: ConvexVesselDayTimelineProviderProps) => {
  const [state, setState] = useState<ConvexVesselDayTimelineContextType>({
    VesselAbbrev: vesselAbbrev,
    SailingDay: sailingDay,
    Events: [],
    VesselLocation: undefined,
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

export const useConvexVesselDayTimeline = () => {
  const context = useContext(ConvexVesselDayTimelineContext);
  if (context === undefined) {
    throw new Error(
      "useConvexVesselDayTimeline must be used within ConvexVesselDayTimelineProvider"
    );
  }

  return context;
};
