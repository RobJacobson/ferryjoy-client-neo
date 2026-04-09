/**
 * Pure radial-gradient orb: defs + circle for one color with alpha stops.
 */

import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { gradientBackgroundConfig } from "../config";

type GradientOrbSvgProps = {
  color: string;
  gradientId: string;
  orbRadiusPx: number;
  orbitRadiusPx: number;
};

/**
 * Draws one soft orb using `RadialGradient` stops, a circular shape, and
 * horizontal offset for orbit radius (parent handles rotation).
 *
 * @param props - SVG props
 * @param props.color - Center color for all gradient stops
 * @param props.gradientId - Unique SVG `id` for `url(#…)` fill
 * @param props.orbitRadiusPx - Horizontal translation of the orb graphic
 * @returns Square SVG with gradient defs and filled circle
 */
export const GradientOrbSvg = ({
  color,
  gradientId,
  orbRadiusPx,
  orbitRadiusPx,
}: GradientOrbSvgProps) => {
  const sizePx = orbRadiusPx * 2;

  return (
    <Svg
      width={sizePx}
      height={sizePx}
      style={{
        left: -orbRadiusPx,
        position: "absolute",
        top: -orbRadiusPx,
        transform: [{ translateX: orbitRadiusPx }],
      }}
    >
      <Defs>
        <RadialGradient
          id={gradientId}
          cx={orbRadiusPx}
          cy={orbRadiusPx}
          r={orbRadiusPx}
          gradientUnits="userSpaceOnUse"
        >
          {gradientBackgroundConfig.orb.gradientStops.map((stop) => (
            <Stop
              key={`${gradientId}-${stop.position}-${stop.alpha}`}
              offset={`${stop.position * 100}%`}
              stopColor={color}
              stopOpacity={stop.alpha}
            />
          ))}
        </RadialGradient>
      </Defs>
      <Circle
        cx={orbRadiusPx}
        cy={orbRadiusPx}
        r={orbRadiusPx}
        fill={`url(#${gradientId})`}
      />
    </Svg>
  );
};
