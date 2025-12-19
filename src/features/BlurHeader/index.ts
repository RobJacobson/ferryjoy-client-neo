// Blur Header Feature
// Provides iOS Contacts-style blurred header overlays for screens

// Unified blur components (combines opacity + blur gradients)
export type { BlurOverlayProps } from "./BlurOverlay";
export { BlurOverlay } from "./BlurOverlay";
export type { BlurPageLayout, BlurPageProps } from "./BlurPage";
export { BlurPage } from "./BlurPage";

// Re-export utilities for advanced usage
export {
  hexToRgba,
  resolveReducedTransparencyFallbackColor,
} from "./utils";
