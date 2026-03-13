/**
 * Feature-local hook for consuming normalized vessel-day timeline data.
 *
 * This hook currently forwards the vessel-centric Convex context directly. It
 * exists so the VesselTimeline feature can evolve its own data contract later
 * without forcing all callers to depend on the raw context name.
 */

import { useConvexVesselDayTimeline } from "@/data/contexts";

/**
 * Returns normalized vessel-day timeline data for the current provider scope.
 *
 * @returns Vessel-day timeline data exposed by the Convex vessel-day context
 */
export const useVesselTimelineData = () => useConvexVesselDayTimeline();
