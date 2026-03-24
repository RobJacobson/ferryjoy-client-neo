/**
 * Convex-backed vessel trip events context.
 *
 * This provider fetches the backend-owned vessel-day event feed plus current
 * vessel location data for one vessel/day scope.
 */

import { api } from "convex/_generated/api";
import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTripEvent } from "convex/functions/vesselTripEvents/schemas";
import { toDomainVesselTripEvent } from "convex/functions/vesselTripEvents/schemas";
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
import { useConvexVesselLocations } from "./ConvexVesselLocationsContext";

export type VesselTimelineEvent = VesselTripEvent;

type ConvexVesselTripEventsContextType = {
  VesselAbbrev: string;
  SailingDay: string;
  Events: VesselTimelineEvent[];
  VesselLocation?: VesselLocation;
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
  const {
    vesselLocations,
    isLoading: vesselLocationsLoading,
    error: vesselLocationsError,
  } = useConvexVesselLocations();

  const IsLoading = rawTimeline === undefined || vesselLocationsLoading;
  const Events = rawTimeline?.Events.map(toDomainVesselTripEvent) ?? [];
  const VesselLocation = vesselLocations.find(
    (location) => location.VesselAbbrev === vesselAbbrev
  );
  const mountStartedAtRef = useRef(Date.now());
  const timelineResolvedRef = useRef(false);
  const vesselLocationResolvedRef = useRef(false);
  const readyLoggedRef = useRef(false);
  const contextLabel = useMemo(
    () => `[VesselTimeline][${vesselAbbrev}][${sailingDay}]`,
    [sailingDay, vesselAbbrev]
  );

  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  useEffect(() => {
    const mountedAt = Date.now();
    mountStartedAtRef.current = mountedAt;
    timelineResolvedRef.current = false;
    vesselLocationResolvedRef.current = false;
    readyLoggedRef.current = false;

    console.log(
      `${contextLabel} provider mounted at ${new Date(mountedAt).toISOString()}`
    );

    return () => {
      const lifetimeMs = Date.now() - mountedAt;
      console.log(`${contextLabel} provider unmounted after ${lifetimeMs}ms`);
    };
  }, [contextLabel]);

  useEffect(() => {
    if (rawTimeline === undefined || timelineResolvedRef.current) {
      return;
    }

    timelineResolvedRef.current = true;
    console.log(
      `${contextLabel} timeline query resolved in ${
        Date.now() - mountStartedAtRef.current
      }ms with ${rawTimeline.Events.length} events`
    );
  }, [contextLabel, rawTimeline]);

  useEffect(() => {
    if (
      vesselLocationsLoading ||
      vesselLocationResolvedRef.current ||
      VesselLocation === undefined
    ) {
      return;
    }

    vesselLocationResolvedRef.current = true;
    console.log(
      `${contextLabel} vesselLocation query resolved in ${
        Date.now() - mountStartedAtRef.current
      }ms (${VesselLocation.VesselAbbrev} @ ${VesselLocation.TimeStamp.toISOString()})`
    );
  }, [contextLabel, vesselLocationsLoading, VesselLocation]);

  useEffect(() => {
    if (IsLoading || readyLoggedRef.current) {
      return;
    }

    readyLoggedRef.current = true;
    console.log(
      `${contextLabel} all timeline data ready in ${
        Date.now() - mountStartedAtRef.current
      }ms`
    );
  }, [IsLoading, contextLabel]);

  useEffect(() => {
    onStateChangeRef.current({
      VesselAbbrev: vesselAbbrev,
      SailingDay: sailingDay,
      Events,
      VesselLocation,
      IsLoading,
      Error: vesselLocationsError,
    });
  }, [
    vesselAbbrev,
    sailingDay,
    Events,
    VesselLocation,
    IsLoading,
    vesselLocationsError,
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
