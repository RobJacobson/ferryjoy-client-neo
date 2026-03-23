/**
 * Single animated orb: absolute positioning from config plus Reanimated CSS
 * keyframes on an inner anchor; SVG markup lives in `GradientOrbSvg`.
 */

import type { ViewStyle } from "react-native";
import { StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import type { GradientOrbConfig } from "./GradientBackground";
import { GradientOrbSvg } from "./svg/GradientOrbSvg";

type GradientOrbLayerProps = {
  orb: GradientOrbConfig;
  svgIdPrefix: string;
};

const getGradientOrbSizePx = (orb: GradientOrbConfig) => orb.orbRadiusPx * 2;

/**
 * Builds a repeating linear rotation animation from initial phase and duration.
 *
 * @param orb - Orb geometry and animation inputs
 * @returns Reanimated-compatible style object with `animationName` keyframes
 */
const createGradientOrbAnimationStyle = (
  orb: GradientOrbConfig
): ViewStyle => ({
  animationName: {
    "0%": {
      transform: [{ rotate: `${orb.initialThetaDeg}deg` }],
    },
    "50%": {
      transform: [{ rotate: `${orb.initialThetaDeg + 180}deg` }],
    },
    "100%": {
      transform: [{ rotate: `${orb.initialThetaDeg + 360}deg` }],
    },
  },
  animationDuration: orb.durationMs,
  animationIterationCount: "infinite",
  animationTimingFunction: "linear",
});

/**
 * Positions one orb and runs its orbit animation; drawing is delegated to
 * `GradientOrbSvg`.
 *
 * @param props - Layer props
 * @param props.orb - Full orb configuration from the background generator
 * @returns Nested animated views wrapping the orb SVG
 */
export const GradientOrbLayer = ({
  orb,
  svgIdPrefix,
}: GradientOrbLayerProps) => {
  const sizePx = getGradientOrbSizePx(orb);
  const animationStyle = createGradientOrbAnimationStyle(orb);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orbLayer,
        {
          left: orb.orbitCenterX,
          top: orb.orbitCenterY,
        },
      ]}
    >
      <Animated.View style={[styles.orbitAnchor, animationStyle]}>
        <GradientOrbSvg
          color={orb.color}
          gradientId={`${svgIdPrefix}-${orb.id}`}
          orbRadiusPx={orb.orbRadiusPx}
          orbitRadiusPx={orb.orbitRadiusPx}
          sizePx={sizePx}
        />
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  orbLayer: {
    height: 0,
    overflow: "visible",
    position: "absolute",
    width: 0,
  },
  orbitAnchor: {
    height: 0,
    overflow: "visible",
    width: 0,
  },
});
