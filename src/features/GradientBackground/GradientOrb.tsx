/**
 * Animated orb renderer for the gradient background.
 *
 * Each orb owns its own orbital animation shell and an SVG radial gradient
 * payload. The outer view establishes the orbit center, while the inner
 * animated view rotates the orb around that center.
 */

import { StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import {
  createGradientOrbAnimationStyle,
  getGradientOrbLayout,
} from "./animation";
import type { GradientOrbConfig, GradientStop } from "./config";

type GradientOrbProps = {
  orb: GradientOrbConfig;
  stops: readonly GradientStop[];
};

/**
 * Renders one animated gradient orb.
 *
 * @param props - Orb geometry and gradient stop definitions
 * @param props.orb - Orb configuration including orbit center, radius, and timing
 * @param props.stops - Shared radial gradient stops used for the orb falloff
 * @returns Absolutely positioned animated orb layer
 */
export const GradientOrb = ({ orb, stops }: GradientOrbProps) => {
  const { left, sizePx, top } = getGradientOrbLayout(orb);
  const animationStyle = createGradientOrbAnimationStyle(orb);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orbLayer,
        {
          left,
          top,
          width: sizePx,
          height: sizePx,
        },
      ]}
    >
      <Animated.View style={[styles.orbitAnchor, animationStyle]}>
        <Svg
          width={sizePx}
          height={sizePx}
          style={[
            StyleSheet.absoluteFill,
            {
              // The orbit is driven by rotation on the parent anchor. This
              // fixed translateX places the orb on that orbit circle.
              transform: [{ translateX: orb.orbitRadiusPx }],
            },
          ]}
        >
          <Defs>
            <RadialGradient
              id={orb.id}
              cx="50%"
              cy="50%"
              r="50%"
              gradientUnits="objectBoundingBox"
            >
              {stops.map((stop) => (
                <Stop
                  key={`${orb.id}-${stop.position}-${stop.alpha}`}
                  offset={`${stop.position * 100}%`}
                  stopColor={orb.color}
                  stopOpacity={stop.alpha}
                />
              ))}
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${orb.id})`} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  orbLayer: {
    overflow: "visible",
    position: "absolute",
  },
  orbitAnchor: {
    height: "100%",
    overflow: "visible",
    width: "100%",
  },
});
