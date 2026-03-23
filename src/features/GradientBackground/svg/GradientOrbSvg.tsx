/**
 * Pure radial-gradient orb: defs + circle for one color with alpha stops.
 */

import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

type GradientStop = {
  position: number;
  alpha: number;
};

type GradientOrbSvgProps = {
  color: string;
  gradientId: string;
  orbRadiusPx: number;
  orbitRadiusPx: number;
};

const GRADIENT_ORB_STOPS: readonly GradientStop[] = [
  { position: 0, alpha: 1 },
  { position: 0.25, alpha: 0.9 },
  { position: 0.5, alpha: 0.6 },
  { position: 0.75, alpha: 0.2 },
  { position: 1, alpha: 0 },
];

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
  const renderRadiusPx = orbRadiusPx;
  const renderSizePx = renderRadiusPx * 2;

  return (
    <Svg
      width={renderSizePx}
      height={renderSizePx}
      style={{
        left: -renderRadiusPx,
        position: "absolute",
        top: -renderRadiusPx,
        transform: [{ translateX: orbitRadiusPx }],
      }}
    >
      <Defs>
        <RadialGradient
          id={gradientId}
          cx={renderRadiusPx}
          cy={renderRadiusPx}
          r={orbRadiusPx}
          gradientUnits="userSpaceOnUse"
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
      <Circle
        cx={renderRadiusPx}
        cy={renderRadiusPx}
        r={orbRadiusPx}
        fill={`url(#${gradientId})`}
      />
    </Svg>
  );
};
