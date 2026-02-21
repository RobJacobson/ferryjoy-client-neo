// ============================================================================
// BackgroundFeatures shared types
// ============================================================================

import type { SharedValue } from "react-native-reanimated";

/**
 * Source for the paper texture overlay (Metro require() returns number;
 * remote URLs are string). When null, components do not render the texture.
 */
export type PaperTextureSource = number | string | null;

/**
 * Props for Background and its children (Sky, AnimatedWaves) for scroll-driven parallax.
 */
export type BackgroundParallaxProps = {
  /** Shared scroll progress (0 = first item, 1 = last item). */
  scrollProgress: SharedValue<number>;
};
