/**
 * Convex-backed vessel timeline context.
 *
 * This provider fetches the backend-owned row view model for one vessel/day
 * scope. The frontend consumes backend rows and active-row identity directly,
 * deriving only presentation details locally inside the feature layer.
 */

import { api } from "convex/_generated/api";
import {
  toDomainVesselTimelineViewModel,
  type VesselTimelineLiveState,
  type VesselTimelineRow,
  type VesselTimelineViewModel,
} from "convex/functions/vesselTimeline/schemas";
import { useQuery } from "convex/react";
import type { PropsWithChildren, ReactNode } from "react";
import { createContext, Component as ReactComponent, useContext } from "react";

export type {
  VesselTimelineLiveState,
  VesselTimelineRow,
  VesselTimelineViewModel,
};

type ConvexVesselTimelineContextType = {
  VesselAbbrev: string;
  SailingDay: string;
  ObservedAt: Date | null;
  rows: VesselTimelineRow[];
  activeRowId: string | null;
  live: VesselTimelineLiveState | null;
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
        this.state.errorMessage ?? "Failed to load vessel timeline"
      );
    }

    return this.props.children;
  }
}

/**
 * Query-backed provider body that exposes the backend-owned timeline view
 * model directly to the feature layer.
 *
 * @param props - Provider props
 * @param props.vesselAbbrev - Vessel abbreviation for the query scope
 * @param props.sailingDay - Sailing day for the query scope
 * @param props.onRetry - Callback used to remount the provider on retry
 * @param props.children - Descendant React tree consuming the context
 * @returns Context provider populated from the Convex row view model
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
  const rawViewModel = useQuery(
    api.functions.vesselTimeline.queries.getVesselTimelineViewModel,
    {
      VesselAbbrev: vesselAbbrev,
      SailingDay: sailingDay,
    }
  );
  const viewModel = rawViewModel
    ? toDomainVesselTimelineViewModel(rawViewModel)
    : null;
  const isLoading = rawViewModel === undefined;

  const value: ConvexVesselTimelineContextType = {
    VesselAbbrev: vesselAbbrev,
    SailingDay: sailingDay,
    ObservedAt: viewModel?.ObservedAt ?? null,
    rows: viewModel?.rows ?? [],
    activeRowId: viewModel?.activeRowId ?? null,
    live: viewModel?.live ?? null,
    IsLoading: isLoading,
    ErrorMessage: null,
    Retry: onRetry,
  };

  return (
    <ConvexVesselTimelineContext.Provider value={value}>
      {children}
    </ConvexVesselTimelineContext.Provider>
  );
};

/**
 * Error-boundary wrapper around the query-backed provider.
 *
 * @param props - Provider props
 * @param props.vesselAbbrev - Vessel abbreviation for the query scope
 * @param props.sailingDay - Sailing day for the query scope
 * @param props.onRetry - Callback used to remount the provider on retry
 * @param props.children - Descendant React tree consuming the context
 * @returns Provider tree with a fallback error context
 */
export const ConvexVesselTimelineProvider = ({
  vesselAbbrev,
  sailingDay,
  onRetry,
  children,
}: ConvexVesselTimelineProviderProps) => {
  const errorValue: ConvexVesselTimelineContextType = {
    VesselAbbrev: vesselAbbrev,
    SailingDay: sailingDay,
    ObservedAt: null,
    rows: [],
    activeRowId: null,
    live: null,
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

/**
 * Reads the backend-owned VesselTimeline view model from context.
 *
 * @returns Timeline query state for the current provider scope
 */
export const useConvexVesselTimeline = () => {
  const context = useContext(ConvexVesselTimelineContext);
  if (context === undefined) {
    throw new Error(
      "useConvexVesselTimeline must be used within ConvexVesselTimelineProvider"
    );
  }

  return context;
};
