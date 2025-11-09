import type { PropsWithChildren } from "react"
import { createContext, useContext, useRef } from "react"

import type { MapController } from "@/features/MapComponent/MapController"

/**
 * Context for providing access to map controller throughout the app
 */
const MapControllerContext = createContext<
  | {
      controllerRef: {
        current: MapController | null
      }
    }
  | undefined
>(undefined)

/**
 * Provider component that makes the map controller available to child components
 */
export const MapControllerProvider = ({ children }: PropsWithChildren) => {
  const controllerRef = useRef<MapController | null>(null)

  return (
    <MapControllerContext.Provider value={{ controllerRef }}>
      {children}
    </MapControllerContext.Provider>
  )
}

/**
 * Hook to access the map controller for imperative map operations
 * Must be used within MapControllerProvider
 */
export const useMapController = (): MapController | null => {
  const context = useContext(MapControllerContext)
  if (context === undefined) {
    throw new Error(
      "useMapController must be used within MapControllerProvider"
    )
  }
  return context.controllerRef.current
}

/**
 * Hook to set the map controller (used by MapComponent)
 * Must be used within MapControllerProvider
 */
export const useSetMapController = () => {
  const context = useContext(MapControllerContext)
  if (context === undefined) {
    throw new Error(
      "useSetMapController must be used within MapControllerProvider"
    )
  }

  return (controller: MapController | null) => {
    context.controllerRef.current = controller
  }
}
