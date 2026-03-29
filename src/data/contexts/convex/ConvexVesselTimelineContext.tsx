/**
 * Convex-backed vessel timeline context.
 *
 * This provider fetches normalized vessel-day boundary events plus live vessel
 * location for one vessel/day scope. Feature-specific timeline derivation
 * happens in the VesselTimeline feature layer.
 */

import { api } from "convex/_generated/api";
import { toDomainActualBoundaryEvent } from "convex/functions/eventsActual/schemas";
import { toDomainScheduledBoundaryEvent } from "convex/functions/eventsScheduled/schemas";
import {
  toDomainVesselLocation,
  type VesselLocation,
} from "convex/functions/vesselLocation/schemas";
import type {
  VesselTimelineActiveState,
  VesselTimelineLiveState,
} from "convex/functions/vesselTimeline/activeStateSchemas";
import {
  type MergedTimelineBoundaryEvent,
  toDomainTimelinePredictedBoundaryEvent,
  type VesselTimelineSegment,
} from "convex/functions/vesselTimeline/schemas";
import { useQuery } from "convex/react";
import type { PropsWithChildren, ReactNode } from "react";
import { createContext, Component as ReactComponent, useContext } from "react";

export type {
  VesselTimelineActiveState,
  VesselTimelineLiveState,
  VesselTimelineSegment,
};

type ConvexVesselTimelineContextType = {
  VesselAbbrev: string;
  SailingDay: string;
  mergedEvents: MergedTimelineBoundaryEvent[];
  location: VesselLocation | null;
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
  const rawScheduledEvents = useQuery(
    api.functions.vesselTimeline.queries.getVesselTimelineScheduledEvents,
    {
      VesselAbbrev: vesselAbbrev,
      SailingDay: sailingDay,
    }
  );
  const rawActualEvents = useQuery(
    api.functions.vesselTimeline.queries.getVesselTimelineActualEvents,
    {
      VesselAbbrev: vesselAbbrev,
      SailingDay: sailingDay,
    }
  );
  const rawPredictedEvents = useQuery(
    api.functions.vesselTimeline.queries.getVesselTimelinePredictedEvents,
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
    rawScheduledEvents === undefined ||
    rawActualEvents === undefined ||
    rawPredictedEvents === undefined ||
    rawVesselLocation === undefined;
  const mergedEvents = buildMergedBoundaryEvents(
    rawScheduledEvents?.map(toDomainScheduledBoundaryEvent) ?? [],
    rawActualEvents?.map(toDomainActualBoundaryEvent) ?? [],
    rawPredictedEvents?.map(toDomainTimelinePredictedBoundaryEvent) ?? []
  );
  const value: ConvexVesselTimelineContextType = {
    VesselAbbrev: vesselAbbrev,
    SailingDay: sailingDay,
    mergedEvents,
    location: rawVesselLocation
      ? toDomainVesselLocation(rawVesselLocation)
      : null,
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
    mergedEvents: [],
    location: null,
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

/**
 * Merges scheduled boundary rows with actual and predicted overlays by stable
 * event key.
 *
 * @param scheduledEvents - Stable schedule backbone
 * @param actualEvents - Sparse actual-time overlay
 * @param predictedEvents - Sparse best-prediction overlay
 * @returns Ordered merged boundary events for semantic row construction
 */
const buildMergedBoundaryEvents = (
  scheduledEvents: Array<ReturnType<typeof toDomainScheduledBoundaryEvent>>,
  actualEvents: Array<ReturnType<typeof toDomainActualBoundaryEvent>>,
  predictedEvents: Array<
    ReturnType<typeof toDomainTimelinePredictedBoundaryEvent>
  >
): MergedTimelineBoundaryEvent[] => {
  const actualByKey = new Map(actualEvents.map((event) => [event.Key, event]));
  const predictedByKey = new Map(
    predictedEvents.map((event) => [event.Key, event])
  );

  return scheduledEvents.map((event) => ({
    Key: event.Key,
    VesselAbbrev: event.VesselAbbrev,
    SailingDay: event.SailingDay,
    ScheduledDeparture: event.ScheduledDeparture,
    TerminalAbbrev: event.TerminalAbbrev,
    EventType: event.EventType,
    EventScheduledTime: event.EventScheduledTime,
    EventActualTime: actualByKey.get(event.Key)?.EventActualTime,
    EventPredictedTime: predictedByKey.get(event.Key)?.EventPredictedTime,
  }));
};
