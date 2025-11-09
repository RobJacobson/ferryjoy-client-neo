/**
 * Shared logic for Map component
 * Contains layout, styling, and common functionality used by both native and web implementations
 */

import type { PropsWithChildren } from "react"
import type { CameraState } from "./cameraState"
import { DEFAULT_CAMERA_STATE, DEFAULT_MAP_STYLE } from "./utils/mapbox"

/**
 * Map component props type
 */
export type MapProps = PropsWithChildren<{
  /** Map style URL */
  mapStyle?: string
  /** Callback when map camera state changes */
  onCameraStateChange?: (cameraState: CameraState) => void
}>

/**
 * Default props for Map component
 */
export const DEFAULT_MAP_PROPS: MapProps = {
  mapStyle: DEFAULT_MAP_STYLE,
}

/**
 * Merge camera state with defaults
 */
export const mergeCameraState = (
  userCameraState?: Partial<CameraState>
): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...userCameraState,
})
