/**
 * Provider host for the VesselTimeline feature.
 */

import type { PropsWithChildren } from "react";
import { ConvexVesselTimelineProvider } from "@/data/contexts";

export type VesselTimelineDataHostProps = PropsWithChildren<{
  vesselAbbrev: string;
  sailingDay: string;
  retryNonce: number;
  onRetry: () => void;
}>;

/**
 * Owns the feature-scoped Convex provider and remount key used for retry and
 * vessel/day scope changes.
 *
 * @param props - Provider host props
 * @param props.vesselAbbrev - Vessel abbreviation for the query scope
 * @param props.sailingDay - Sailing day for the query scope
 * @param props.retryNonce - Manual retry counter appended to the remount key
 * @param props.onRetry - Callback that requests a fresh subtree mount
 * @param props.children - Descendant content that consumes the timeline context
 * @returns Provider-wrapped feature subtree
 */
export const VesselTimelineDataHost = ({
  vesselAbbrev,
  sailingDay,
  retryNonce,
  onRetry,
  children,
}: VesselTimelineDataHostProps) => (
  <ConvexVesselTimelineProvider
    key={`${vesselAbbrev}:${sailingDay}:${retryNonce}`}
    vesselAbbrev={vesselAbbrev}
    sailingDay={sailingDay}
    onRetry={onRetry}
  >
    {children}
  </ConvexVesselTimelineProvider>
);
