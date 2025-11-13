/**
 * Shared contexts exports
 */

export * from "../utils/projectVesselPosition";
// Export combined provider
export { ConvexCombinedProvider } from "./ConvexCombinedProvider";
// Export original context for backward compatibility
export {
  ConvexProvider,
  useConvexData,
  useConvexVesselLocations as useConvexVesselLocationsLegacy,
} from "./ConvexContext";
// Export vessel locations context
export {
  ConvexVesselLocationsProvider,
  useConvexVesselLocations,
  type VesselLocations,
} from "./ConvexVesselLocationsContext";
// Export vessel pings context
export {
  ConvexVesselPingsProvider,
  useConvexVesselPings,
  type VesselPings,
} from "./ConvexVesselPingsContext";
export { MapStateProvider, useMapState } from "./MapStateContext";
export {
  SmoothedVesselPositionsProvider,
  useSmoothedVesselPositions,
} from "./SmoothedVesselPositionsContext";
export { useWsDottie, WsDottieProvider } from "./WsDottieContext";
