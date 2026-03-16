/**
 * Layout and animation helpers for gradient background orbs.
 *
 * These helpers convert orb config data into absolute positioning for the
 * orbit center and into Reanimated CSS-style keyframes that rotate the orb
 * around that center indefinitely.
 */

import type { ViewStyle } from "react-native";
import type { GradientOrbConfig } from "./config";

/**
 * Computes the absolute layout box for an orb's orbit anchor.
 *
 * The anchor box is centered on the orbit center and sized to the orb's
 * diameter. The animated child later translates itself sideways from this
 * anchor and rotates around it.
 *
 * @param orb - Orb geometry and animation data
 * @returns Absolute size and position for the orbit anchor layer
 */
export const getGradientOrbLayout = (orb: GradientOrbConfig) => ({
  sizePx: orb.orbRadiusPx * 2,
  left: orb.orbitCenterX - orb.orbRadiusPx,
  top: orb.orbitCenterY - orb.orbRadiusPx,
});

/**
 * Builds the infinite orbital animation style for a gradient orb.
 *
 * The animation is expressed entirely as transform-based keyframes so the orb
 * can orbit by rotation while also gently pulsing its scale.
 *
 * @param orb - Orb geometry and timing data
 * @returns Reanimated CSS animation style for one orb
 */
export const createGradientOrbAnimationStyle = (
  orb: GradientOrbConfig
): ViewStyle => ({
  animationName: {
    "0%": {
      transform: [
        { rotate: `${orb.initialThetaDeg}deg` },
        { scale: orb.scaleFrom },
      ],
    },
    "50%": {
      transform: [
        { rotate: `${orb.initialThetaDeg + 180}deg` },
        { scale: orb.scaleTo },
      ],
    },
    "100%": {
      transform: [
        { rotate: `${orb.initialThetaDeg + 360}deg` },
        { scale: orb.scaleFrom },
      ],
    },
  },
  animationDuration: orb.durationMs,
  animationDelay: orb.delayMs,
  animationIterationCount: "infinite",
  animationTimingFunction: "linear",
});
