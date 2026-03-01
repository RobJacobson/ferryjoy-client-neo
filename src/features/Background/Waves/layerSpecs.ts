// ============================================================================
// Layer Specifications Factory
// ============================================================================
// Configuration-driven factory for generating wave layer render specifications.
// Eliminates duplication in layer spec generation by defining layer types
// declaratively and using a single factory function.
// ============================================================================

import type { StyleProp, ViewStyle } from "react-native";
import { lerp } from "@/shared/utils";
import {
  PARALLAX_BG_GRASS,
  PARALLAX_FG_GRASS,
  PARALLAX_OCEAN,
} from "../config";
import {
  BACKGROUND_LAYERS,
  FOREGROUND_LAYERS,
  grassColor,
  OCEAN_WAVES,
  oceanColor,
} from "./config";
import type { WaveOscillationProps } from "./useWaveOscillation";
import type { WaveSvgProps } from "./WaveSvg";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/**
 * Configuration for generating grass wave layer specifications.
 * Grass layers use static properties read from source data arrays.
 */
type GrassLayerConfig = {
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
type OceanLayerConfig = {
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
type LayerConfig = GrassLayerConfig | OceanLayerConfig;

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

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

/**
 * Precomputed phase offsets for ocean waves using prime number-based distribution.
 * Using 73 as a multiplier creates non-repeating phase offsets that prevent waves
 * from appearing synchronized.
 */
const OCEAN_PHASE_OFFSETS = Array.from(
  { length: OCEAN_WAVES.count },
  (_, index) => {
    const t = ((index * 73) % 101) / 101;
    return t * 2 * Math.PI;
  }
);

/** Maximum x-shift for ocean wave oscillation animation */
const MAX_OCEAN_X_SHIFT_PX = OCEAN_WAVES.maxXShiftPx;

/** Reversed foreground layers for proper z-index ordering */
const FOREGROUND_LAYERS_REVERSED = [...FOREGROUND_LAYERS].reverse();

/** Layer configurations for generating all wave specs */
const LAYER_CONFIGS: readonly LayerConfig[] = [
  {
    type: "grass",
    prefix: "bg-",
    sourceData: BACKGROUND_LAYERS,
    parallaxRange: PARALLAX_BG_GRASS,
    baseZIndex: 1,
    colorFn: grassColor,
  },
  {
    type: "ocean",
    prefix: "ocean-",
    count: OCEAN_WAVES.count,
    parallaxRange: PARALLAX_OCEAN,
    baseZIndex: 10,
    interpolateProps: {
      amplitude: OCEAN_WAVES.amplitude,
      period: OCEAN_WAVES.period,
      height: OCEAN_WAVES.height,
      lightness: OCEAN_WAVES.lightness,
      animationDuration: OCEAN_WAVES.animationDuration,
    },
    colorFn: oceanColor,
    phaseOffsets: OCEAN_PHASE_OFFSETS,
    maxXShiftPx: MAX_OCEAN_X_SHIFT_PX,
  },
  {
    type: "grass",
    prefix: "fg-",
    sourceData: FOREGROUND_LAYERS_REVERSED,
    parallaxRange: PARALLAX_FG_GRASS,
    baseZIndex: 100,
    colorFn: grassColor,
    zIndexForIndex: (index) => (index === 0 ? 101 : 100),
    wrapperStyleForIndex: (index) =>
      index === 0 ? { marginBottom: -10 } : undefined,
  },
] as const;

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Normalizes an index to a 0-1 range based on count of items.
 * Handles edge case where count is 1 by returning 0.
 *
 * @param index - Current index in the sequence
 * @param count - Total number of items
 * @returns Normalized value between 0 and 1
 */
const indexToT = (index: number, count: number): number =>
  count > 1 ? index / (count - 1) : 0;

/**
 * Generates wave render specifications for a single layer configuration.
 * Uses interpolation for ocean waves (lerped properties) and static properties
 * for grass layers (read from source data).
 *
 * @param config - Layer configuration defining how to generate specs
 * @returns Array of wave render specifications
 */
const createLayerSpecs = (config: LayerConfig): readonly WaveRenderSpec[] => {
  if (config.type === "ocean") {
    return createOceanLayerSpecs(config);
  }
  return createGrassLayerSpecs(config);
};

/**
 * Generates wave render specifications for grass layers.
 * Uses static properties read from source data arrays.
 *
 * @param config - Grass layer configuration
 * @returns Array of wave render specifications for grass layers
 */
const createGrassLayerSpecs = (
  config: GrassLayerConfig
): readonly WaveRenderSpec[] => {
  return config.sourceData.map((layer, index) => {
    const t = indexToT(index, config.sourceData.length);
    const parallaxMultiplier = lerp(
      t,
      config.parallaxRange.min,
      config.parallaxRange.max
    );

    return {
      key: `${config.prefix}${index}`,
      zIndex: config.zIndexForIndex?.(index) ?? config.baseZIndex + index,
      parallaxMultiplier,
      wrapperStyle: config.wrapperStyleForIndex?.(index),
      svgProps: {
        amplitude: layer.amplitude,
        period: layer.period,
        fillColor: layer.fillColor ?? config.colorFn(layer.lightness ?? 0),
        height: layer.height,
        xOffsetPx: layer.xOffsetPx,
      },
    };
  });
};

/**
 * Generates wave render specifications for ocean layers.
 * Uses interpolated properties based on layer index.
 *
 * @param config - Ocean layer configuration
 * @returns Array of wave render specifications for ocean layers
 */
const createOceanLayerSpecs = (
  config: OceanLayerConfig
): readonly WaveRenderSpec[] => {
  return Array.from({ length: config.count }, (_, index) => {
    const t = indexToT(index, config.count);
    const parallaxMultiplier = lerp(
      t,
      config.parallaxRange.min,
      config.parallaxRange.max
    );

    return {
      key: `${config.prefix}${index}`,
      zIndex: config.baseZIndex + index,
      parallaxMultiplier,
      svgProps: {
        amplitude: lerp(
          t,
          config.interpolateProps.amplitude.min,
          config.interpolateProps.amplitude.max
        ),
        period: lerp(
          t,
          config.interpolateProps.period.min,
          config.interpolateProps.period.max
        ),
        fillColor: config.colorFn(
          lerp(
            t,
            config.interpolateProps.lightness.min,
            config.interpolateProps.lightness.max
          )
        ),
        height: lerp(
          t,
          config.interpolateProps.height.min,
          config.interpolateProps.height.max
        ),
      },
      oscillationProps: {
        animationDuration: lerp(
          t,
          config.interpolateProps.animationDuration.min,
          config.interpolateProps.animationDuration.max
        ),
        maxXShiftPx: config.maxXShiftPx,
        phaseOffset: config.phaseOffsets[index],
      },
    };
  });
};

// ----------------------------------------------------------------------------
// Exported Specifications
// ----------------------------------------------------------------------------

/**
 * Precomputed render specifications for all wave layers.
 * Combines background grass, ocean waves, and foreground grass into a single
 * ordered array for rendering with proper z-index layering.
 */
export const LAYER_SPECS: readonly WaveRenderSpec[] =
  LAYER_CONFIGS.flatMap(createLayerSpecs);
