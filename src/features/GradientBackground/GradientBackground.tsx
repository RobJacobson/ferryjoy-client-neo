/**
 * Full-screen animated gradient background: random orb field, noise overlay,
 * and absolute-fill layout so foreground content stacks above the scene.
 */

import type { PropsWithChildren } from "react";
import { useId, useMemo } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { View } from "@/components/ui";
import { gradientBackgroundConfig } from "./config";
import { GradientBackgroundLayer } from "./GradientBackgroundLayer";

type GradientBackgroundProps = PropsWithChildren<{
  backgroundColor: string;
  colors?: readonly string[];
}>;

export type GradientOrbConfig = {
  id: string;
  color: string;
  orbRadiusPx: number;
  orbitCenterX: number;
  orbitCenterY: number;
  orbitRadiusPx: number;
  initialThetaDeg: number;
  durationMs: number;
};

/**
 * Renders the gradient scene in an absolute-fill layer with optional children
 * above. Orb layouts are recomputed when the viewport size changes.
 *
 * @param props - Root props
 * @param props.backgroundColor - Solid fill behind orb layers
 * @param props.children - Optional foreground content
 * @param props.colors - Palette for generated orbs
 * @returns Root view with background and optional children
 */
export const GradientBackground = ({
  backgroundColor,
  children,
  colors = gradientBackgroundConfig.defaultColors,
}: GradientBackgroundProps) => {
  const svgIdPrefix = useId().replace(/:/g, "");
  const { width, height } = useWindowDimensions();
  // Stable random layout until viewport or palette changes (not a perf memo).
  const resolvedOrbs = useMemo(
    () => createRandomGradientOrbs({ width, height, colors }),
    [colors, height, width]
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <GradientBackgroundLayer
          backgroundColor={backgroundColor}
          orbs={resolvedOrbs}
          svgIdPrefix={svgIdPrefix}
          width={width}
          height={height}
        />
      </View>
      {children}
    </View>
  );
};

/**
 * Returns a pseudo-random number in `[min, max)` using `Math.random`.
 *
 * @param min - Inclusive lower bound
 * @param max - Exclusive upper bound (caller must ensure `max > min`)
 * @returns Random float in the half-open interval
 */
const randomBetween = (min: number, max: number) =>
  min + Math.random() * (max - min);

/**
 * Shallow copy of `colors` in arbitrary order (decorative shuffle only).
 *
 * @param colors - Palette entries
 * @returns New array with the same elements in a pseudo-random order
 */
const shuffledColorOrder = (colors: readonly string[]) =>
  [...colors].sort(() => Math.random() - 0.5);

/**
 * Builds one orb config per palette color: radius, circular orbit, phase, and
 * animation duration, all scaled to the given viewport.
 *
 * @param params - Viewport and palette inputs
 * @param params.width - Viewport width in logical pixels
 * @param params.height - Viewport height in logical pixels
 * @param params.colors - Orb fill colors; defaults to the feature palette
 * @returns Orb definitions for `GradientBackgroundLayer`
 */
const createRandomGradientOrbs = ({
  width,
  height,
  colors = gradientBackgroundConfig.defaultColors,
}: {
  width: number;
  height: number;
  colors?: readonly string[];
}): GradientOrbConfig[] => {
  const maxDimension = Math.max(width, height);
  return shuffledColorOrder(colors).map((color, index) => {
    const orbRadiusPx =
      maxDimension *
      randomBetween(
        gradientBackgroundConfig.orb.radiusRange.min,
        gradientBackgroundConfig.orb.radiusRange.max
      );
    const orbitCenterX = randomBetween(0, width);
    const orbitCenterY = randomBetween(0, height);
    const orbitRadiusPx = randomBetween(0, orbRadiusPx);

    return {
      id: `orb-${index}-${color.replace("#", "").toLowerCase()}`,
      color,
      orbRadiusPx,
      orbitCenterX,
      orbitCenterY,
      orbitRadiusPx,
      initialThetaDeg: randomBetween(0, 360),
      durationMs: randomBetween(
        gradientBackgroundConfig.orb.durationRangeMs.min,
        gradientBackgroundConfig.orb.durationRangeMs.max
      ),
    };
  });
};
