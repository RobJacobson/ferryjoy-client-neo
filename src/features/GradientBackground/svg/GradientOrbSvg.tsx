/**
 * Pure radial-gradient orb: defs + rect for one color with alpha stops.
 */

import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

type GradientStop = {
  position: number;
  alpha: number;
};

type GradientOrbSvgProps = {
  color: string;
  gradientId: string;
  orbRadiusPx: number;
  orbitRadiusPx: number;
  sizePx: number;
};

const GRADIENT_ORB_STOPS: readonly GradientStop[] = [
  { position: 0, alpha: 0.9 },
  { position: 0.15, alpha: 0.85 },
  { position: 0.5, alpha: 0.4 },
  { position: 0.75, alpha: 0.1 },
  { position: 1, alpha: 0 },
];

/**
 * Draws one soft orb using `RadialGradient` stops and horizontal offset for
 * orbit radius (parent handles rotation).
 *
 * @param props - SVG props
 * @param props.color - Center color for all gradient stops
 * @param props.gradientId - Unique SVG `id` for `url(#…)` fill
 * @param props.orbitRadiusPx - Horizontal translation of the orb graphic
 * @param props.sizePx - Width and height of the SVG viewport
 * @returns Square SVG with gradient defs and filled rect
 */
export const GradientOrbSvg = ({
  color,
  gradientId,
  orbRadiusPx,
  orbitRadiusPx,
  sizePx,
}: GradientOrbSvgProps) => (
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
        cx="50%"
        cy="50%"
        r="50%"
        gradientUnits="objectBoundingBox"
      >
        {GRADIENT_ORB_STOPS.map((stop) => (
          <Stop
            key={`${gradientId}-${stop.position}-${stop.alpha}`}
            offset={`${stop.position * 100}%`}
            stopColor={color}
            stopOpacity={stop.alpha}
          />
        ))}
      </RadialGradient>
    </Defs>
    <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
  </Svg>
);
