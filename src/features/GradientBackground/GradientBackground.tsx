/**
 * Gradient background feature entry point.
 *
 * This component owns viewport sizing, resolves either caller-supplied orbs or
 * randomly generated defaults, and renders the SVG background behind any
 * foreground children.
 */

import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import Animated from "react-native-reanimated";
import { View } from "@/components/ui";
import {
  GRADIENT_BACKGROUND_COLORS,
  GRADIENT_BACKGROUND_OVERLAY_COLOR,
  type GradientOrbConfig,
} from "./config";
import { GradientBackgroundSvg } from "./GradientBackgroundSvg";
import { createRandomGradientOrbs } from "./randomOrbs";

type GradientBackgroundProps = PropsWithChildren<{
  backgroundColor: string;
  orbs?: readonly GradientOrbConfig[];
  colors?: readonly string[];
  overlayColor?: string;
}>;

/**
 * Renders the full gradient background and optional foreground content.
 *
 * When `orbs` is omitted, the component synthesizes a random orb field sized
 * for the current viewport. The background itself is rendered in an
 * absolute-fill layer so callers can place normal content on top.
 *
 * @param props - Background props and optional foreground children
 * @param props.backgroundColor - Solid base color painted below all orb layers
 * @param props.children - Foreground content rendered above the background
 * @param props.orbs - Optional precomputed orb definitions for deterministic scenes
 * @param props.colors - Palette used when random orb definitions are generated
 * @param props.overlayColor - Final wash painted above the orbs to soften contrast
 * @returns Full-screen background layer with optional foreground content
 */
export const GradientBackground = ({
  backgroundColor,
  children,
  orbs,
  colors = GRADIENT_BACKGROUND_COLORS,
  overlayColor = GRADIENT_BACKGROUND_OVERLAY_COLOR,
}: GradientBackgroundProps) => {
  const { width, height } = useWindowDimensions();
  const maxDimension = Math.max(width, height);
  const resolvedOrbs = useMemo(
    () =>
      orbs
        ? [...orbs]
        : createRandomGradientOrbs({
            // Random defaults are regenerated when the viewport changes size so
            // the starting positions remain valid for the visible bounds.
            width,
            height,
            maxDimension,
            colors,
          }),
    [colors, height, maxDimension, orbs, width]
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Animated.View style={StyleSheet.absoluteFill}>
          <GradientBackgroundSvg
            backgroundColor={backgroundColor}
            overlayColor={overlayColor}
            orbs={resolvedOrbs}
            width={width}
            height={height}
          />
        </Animated.View>
      </View>
      {children}
    </View>
  );
};

export default GradientBackground;
