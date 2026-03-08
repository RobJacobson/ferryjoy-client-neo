/**
 * Map component exports
 * Platform-specific exports handled by Metro bundler
 */

export { MapComponent } from "./MapComponent";
export type { CameraState, MapProps } from "./shared";
export {
  DEFAULT_MAP_STYLE,
  DEFAULT_NATIVE_CAMERA_STATE,
  handleCameraStateChange,
  nativeMapStateToCameraState,
  webViewStateToCameraState,
} from "./shared";
