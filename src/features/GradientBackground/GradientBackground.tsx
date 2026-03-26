/**
 * Full-screen animated gradient background: random orb field, noise overlay,
 * and absolute-fill layout so foreground content stacks above the scene.
 */

import type { PropsWithChildren } from "react";
import { useId, useMemo } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { View } from "@/components/ui";
import { GradientBackgroundLayer } from "./GradientBackgroundLayer";

const GRADIENT_BACKGROUND_COLORS = [
  "#6FA8FF",
  "#FF8E72",
  "#7BE0C3",
  "#8D7DFF",
] as const;

const GRADIENT_BACKGROUND_RADIUS_RANGE = {
  min: 0.4,
  max: 0.8,
} as const;

const GRADIENT_BACKGROUND_DURATION_RANGE_MS = {
  min: 20000,
  max: 60000,
} as const;

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
  colors = GRADIENT_BACKGROUND_COLORS,
}: GradientBackgroundProps) => {
  const svgIdPrefix = useId().replace(/:/g, "");
  const { width, height } = useWindowDimensions();
  const maxDimension = Math.max(width, height);
  const resolvedOrbs = useMemo(
    () =>
      createRandomGradientOrbs({
        // Random defaults are regenerated when the viewport changes size so
        // the starting positions remain valid for the visible bounds.
        width,
        height,
        maxDimension,
        colors,
      }),
    [colors, height, maxDimension, width]
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

const shuffleColors = (colors: readonly string[]) => {
  const shuffledColors = [...colors];

  for (let index = shuffledColors.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(randomBetween(0, index + 1));
    const currentColor = shuffledColors[index];
    shuffledColors[index] = shuffledColors[randomIndex];
    shuffledColors[randomIndex] = currentColor;
  }

  return shuffledColors;
};

/**
 * Builds one orb config per palette color: radius, circular orbit, phase, and
 * animation duration, all scaled to the given viewport.
 *
 * @param params - Viewport and palette inputs
 * @param params.width - Viewport width in logical pixels
 * @param params.height - Viewport height in logical pixels
 * @param params.maxDimension - `max(width, height)` for sizing orb radii
 * @param params.colors - Orb fill colors; defaults to the feature palette
 * @returns Orb definitions for `GradientBackgroundLayer`
 */
const createRandomGradientOrbs = ({
  width,
  height,
  maxDimension,
  colors = GRADIENT_BACKGROUND_COLORS,
}: {
  width: number;
  height: number;
  maxDimension: number;
  colors?: readonly string[];
}): GradientOrbConfig[] =>
  shuffleColors(colors).map((color, index) => {
    const orbRadiusPx =
      maxDimension *
      randomBetween(
        GRADIENT_BACKGROUND_RADIUS_RANGE.min,
        GRADIENT_BACKGROUND_RADIUS_RANGE.max
      );
    const orbitCenterX = randomBetween(0, width);
    const orbitCenterY = randomBetween(0, height);
    const orbitRadiusPx = randomBetween(0, orbRadiusPx);
    const initialThetaRad = randomBetween(0, Math.PI * 2);

    return {
      id: `orb-${index}-${color.replace("#", "").toLowerCase()}`,
      color,
      orbRadiusPx,
      orbitCenterX,
      orbitCenterY,
      orbitRadiusPx,
      initialThetaDeg: (initialThetaRad * 180) / Math.PI,
      durationMs: randomBetween(
        GRADIENT_BACKGROUND_DURATION_RANGE_MS.min,
        GRADIENT_BACKGROUND_DURATION_RANGE_MS.max
      ),
    };
  });
