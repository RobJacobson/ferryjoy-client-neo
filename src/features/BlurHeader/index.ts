// Blur Header Feature
// Provides iOS Contacts-style blurred header overlays for screens

export type {
  OpacityBlurOverlayPosition,
  OpacityBlurOverlayProps,
} from "./OpacityBlurOverlay";
export { OpacityBlurOverlay } from "./OpacityBlurOverlay";

export type {
  OpacityBlurPageLayout,
  OpacityBlurPageProps,
} from "./OpacityBlurPage";
export { OpacityBlurPage } from "./OpacityBlurPage";

// Re-export utilities for advanced usage
export {
  hexToRgba,
  resolveReducedTransparencyFallbackColor,
} from "./opacityBlurUtils";
