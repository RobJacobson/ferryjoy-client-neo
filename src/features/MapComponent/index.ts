/**
 * Map component exports
 * Platform-specific exports handled by Metro bundler
 */

export {
  MapControllerProvider,
  useMapController,
  useSetMapController,
} from "@/shared/contexts/MapController"
export { MapComponent } from "./MapComponent"
export {
  createMapController,
  type MapController as IMapController,
} from "./MapController"
export type { MapProps } from "./shared"
