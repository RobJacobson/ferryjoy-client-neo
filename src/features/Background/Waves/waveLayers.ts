// ============================================================================
// Wave Stack Layer Builder
// ============================================================================
// Precomputes wave layer props for ocean (lerped), foreground grass, and
// background grass. buildWaveStackLayers() returns an ordered array for
// rendering a single stack of <Wave /> components (back to front).
// ============================================================================

import type { ViewStyle } from "react-native";
import { createColorGenerator, lerp } from "@/shared/utils";
import {
  PARALLAX_BG_GRASS,
  PARALLAX_FG_GRASS,
  PARALLAX_OCEAN,
} from "../config";
import type { PaperTextureSource } from "../types";
import type { AnimatedWaveProps } from "./AnimatedWave";
import {
  BACKGROUND_LAYERS,
  FOREGROUND_LAYERS,
  GRASS_BASE_COLOR,
  OCEAN_WAVES,
} from "./config";

const blueColor = createColorGenerator(OCEAN_WAVES.baseColor);
const grassColor = createColorGenerator(GRASS_BASE_COLOR);

/**
 * A single layer in the wave stack: key + optional wrapper style + parallax + Wave props.
 * Spread ...waveProps onto <Wave />; use key and wrapperStyle on the wrapper View.
 */
export type WaveLayer = {
  key: string;
  zIndex?: number;
  wrapperStyle?: ViewStyle;
  /** Parallax multiplier 0–100 for scroll-driven translateX. */
  parallaxMultiplier: number;
} & AnimatedWaveProps;

/**
 * Deterministic phase offset per layer index (radians).
 * Keeps ocean waves out of phase without animation delays.
 */
const computePhaseOffset = (index: number): number => {
  const t = ((index * 73) % 101) / 101;
  return t * 2 * Math.PI;
};

/**
 * Builds ocean wave layers with lerped props. First layer = min, last = max.
 */
const buildOceanWaveLayers = (): WaveLayer[] => {
  const { count } = OCEAN_WAVES;
  const tForIndex = (index: number) => (count > 1 ? index / (count - 1) : 0);

  return Array.from({ length: count }).map((_, index) => {
    const t = tForIndex(index);
    return {
      key: `ocean-${index}`,
      zIndex: 10 + index,
      parallaxMultiplier: Math.round(
        lerp(t, PARALLAX_OCEAN.min, PARALLAX_OCEAN.max)
      ),
      amplitude: lerp(t, OCEAN_WAVES.amplitude.min, OCEAN_WAVES.amplitude.max),
      period: lerp(t, OCEAN_WAVES.period.min, OCEAN_WAVES.period.max),
      fillColor: blueColor(
        lerp(t, OCEAN_WAVES.lightness.min, OCEAN_WAVES.lightness.max)
      ),
      height: lerp(t, OCEAN_WAVES.height.min, OCEAN_WAVES.height.max),
      animationDuration: lerp(
        t,
        OCEAN_WAVES.animationDuration.min,
        OCEAN_WAVES.animationDuration.max
      ),
      waveDisplacement: lerp(
        t,
        OCEAN_WAVES.waveDisplacement.min,
        OCEAN_WAVES.waveDisplacement.max
      ),
      animationDelay: 0,
      phaseOffset: computePhaseOffset(index),
    };
  });
};

/**
 * Builds foreground grass layers (static waves). Order: [0] back, [1] front.
 * Reversed when stacking so foreground[0] is on top. Distinct zIndex so both
 * layers are visible (front = 101, back = 100). Each wave gets its own parallax.
 */
const buildForegroundGrassLayers = (): WaveLayer[] =>
  FOREGROUND_LAYERS.map((layer, i) => {
    const t =
      FOREGROUND_LAYERS.length > 1 ? i / (FOREGROUND_LAYERS.length - 1) : 0;
    return {
      key: `fg-${i}-${layer.height}-${layer.period}`,
      zIndex: i === 0 ? 100 : 101,
      wrapperStyle: { marginBottom: i === 0 ? 0 : -10 } as ViewStyle,
      parallaxMultiplier: Math.round(
        lerp(t, PARALLAX_FG_GRASS.min, PARALLAX_FG_GRASS.max)
      ),
      amplitude: layer.amplitude,
      period: layer.period,
      fillColor: grassColor(layer.lightness),
      height: layer.height,
      animationDuration: 0,
      waveDisplacement: layer.waveDisplacement,
      animationDelay: 0,
    };
  });

/**
 * Builds background grass layers (static waves). Each wave gets its own
 * parallax multiplier (lerped across the range by index).
 */
const buildBackgroundGrassLayers = (): WaveLayer[] =>
  BACKGROUND_LAYERS.map((layer, i) => {
    const t =
      BACKGROUND_LAYERS.length > 1 ? i / (BACKGROUND_LAYERS.length - 1) : 0;
    return {
      key: `bg-${i}-${layer.height}-${layer.period}`,
      parallaxMultiplier: Math.round(
        lerp(t, PARALLAX_BG_GRASS.min, PARALLAX_BG_GRASS.max)
      ),
      amplitude: layer.amplitude,
      period: layer.period,
      fillColor: layer.fillColor ?? grassColor(layer.lightness ?? 0),
      height: layer.height,
      animationDuration: 0,
      waveDisplacement: layer.waveDisplacement,
      animationDelay: 0,
    };
  });

/** Precomputed ocean and grass layer arrays (stable references). */
const OCEAN_LAYERS = buildOceanWaveLayers();
const FOREGROUND_GRASS_LAYERS = buildForegroundGrassLayers();
const BACKGROUND_GRASS_LAYERS = buildBackgroundGrassLayers();

/**
 * Returns the full wave stack in render order (back to front):
 * background grass, then ocean waves, then foreground grass (reversed so [0] on top).
 * Each layer includes paperTextureUrl for use by Wave.
 *
 * @param paperTextureUrl - Passed to each Wave; null disables texture overlay
 */
export const buildWaveStackLayers = (
  paperTextureUrl: PaperTextureSource
): WaveLayer[] => {
  const withTexture = (layer: WaveLayer): WaveLayer => ({
    ...layer,
    paperTextureUrl,
  });

  const background = BACKGROUND_GRASS_LAYERS.map(withTexture);
  const ocean = OCEAN_LAYERS.map(withTexture);
  const foregroundReversed = [...FOREGROUND_GRASS_LAYERS]
    .reverse()
    .map(withTexture);

  return [...background, ...ocean, ...foregroundReversed];
};
