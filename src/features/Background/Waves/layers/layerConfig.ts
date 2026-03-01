// ============================================================================
// Layer Configuration Types
// ============================================================================
// Type definitions for wave layer configurations. Uses discriminated unions
// to ensure type safety for grass vs ocean layer generation.
// ============================================================================

import type { StyleProp, ViewStyle } from "react-native";
import type { WaveOscillationProps } from "../useWaveOscillation";
import type { WaveSvgProps } from "../WaveSvg";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/**
 * Configuration for generating grass wave layer specifications.
 * Grass layers use static properties read from source data arrays.
 */
export type GrassLayerConfig = {
  type: "grass";
  /** Prefix for React keys ("bg-" or "fg-") */
  prefix: "bg-" | "fg-";
  /** Static layer data with amplitude, period, height, and position */
  sourceData: Array<{
    amplitude: number;
    period: number;
    height: number;
    xOffsetPx: number;
    fillColor?: string;
    lightness?: number;
  }>;
  /** Parallax multiplier range for interpolation across layers */
  parallaxRange: { min: number; max: number };
  /** Base z-index for this layer group */
  baseZIndex: number;
  /** Color generation function for lightness values */
  colorFn: (lightness: number) => string;
  /** Optional custom z-index function per layer */
  zIndexForIndex?: (index: number) => number;
  /** Optional custom wrapper style function per layer */
  wrapperStyleForIndex?: (index: number) => StyleProp<ViewStyle>;
};

/**
 * Configuration for generating ocean wave layer specifications.
 * Ocean waves use interpolated properties based on layer index.
 */
export type OceanLayerConfig = {
  type: "ocean";
  /** Prefix for React keys ("ocean-") */
  prefix: "ocean-";
  /** Number of ocean wave layers to generate */
  count: number;
  /** Parallax multiplier range for interpolation across layers */
  parallaxRange: { min: number; max: number };
  /** Base z-index for this layer group */
  baseZIndex: number;
  /** Properties to interpolate by layer index (min = back, max = front) */
  interpolateProps: {
    amplitude: { min: number; max: number };
    period: { min: number; max: number };
    height: { min: number; max: number };
    lightness: { min: number; max: number };
    animationDuration: { min: number; max: number };
  };
  /** Color generation function for lightness values */
  colorFn: (lightness: number) => string;
  /** Phase offsets for each wave layer (prevents synchronization) */
  phaseOffsets: readonly number[];
  /** Maximum horizontal oscillation distance in pixels */
  maxXShiftPx: number;
};

/**
 * Union type for all layer configurations.
 * Discriminated by the "type" field.
 */
export type LayerConfig = GrassLayerConfig | OceanLayerConfig;

/**
 * Precomputed render specification for a single wave layer.
 * Contains all data needed to render a wave with parallax and oscillation.
 */
export type WaveRenderSpec = {
  /** Unique React key for this wave layer */
  key: string;
  /** Z-index for layer ordering (lower = farther, higher = closer) */
  zIndex: number;
  /** Parallax multiplier (0-100) for scroll-driven horizontal movement */
  parallaxMultiplier: number;
  /** Optional additional styles for layer wrapper view */
  wrapperStyle?: StyleProp<ViewStyle>;
  /** SVG rendering configuration (shape, color, size, position) */
  svgProps: Omit<WaveSvgProps, "renderWidthPx" | "renderHeightPx">;
  /** Optional oscillation configuration (ocean waves only) */
  oscillationProps?: WaveOscillationProps;
};
