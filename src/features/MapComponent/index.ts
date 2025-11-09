/**
 * Map component exports
 * Platform-specific exports handled by Metro bundler
 */

export { MapComponent } from "./MapComponent"
export type { MapProps, MapComponentRef } from "./shared"
export { 
  createMapController,
  type MapController as IMapController 
} from "./MapController"
export { 
  MapControllerProvider,
  useMapController,
  useSetMapController
} from "@/shared/contexts/MapController"
