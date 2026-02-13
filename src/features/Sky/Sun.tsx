// ============================================================================
// Sun
// ============================================================================
// SVG sun with rayCount rays between innerRadius and outerRadius. Each ray is
// a wedge with rounded tips at both radii using quadratic Bézier curves (no
// sampling). Gear-like, exact paths.
// ============================================================================

import { useMemo } from "react";
import Svg, { Circle, G, Path } from "react-native-svg";

// ============================================================================
// Constants / types
// ============================================================================

/** Default viewBox extent when size prop is omitted. ViewBox is origin-centered: (-half,-half) to (half,half). */
const DEFAULT_VIEWBOX_SIZE = 1000;

/** Fraction of the angular slice each ray base occupies (0-1). < 1 creates gaps. */
const RAY_BASE_WIDTH_FRACTION = 1;
/** Fraction of the base width the ray tip occupies (0-1). < 1 creates taper. */
const RAY_TIP_WIDTH_FRACTION = 0.2;
/** How much the ray tip bulges beyond outerRadius (fraction of ray height). */
const OUTER_BULGE_FRACTION = 0.2;

/** Pseudo-drop shadow: opacity and offsets (same pattern as AnimatedWave). */
const SHADOW_OPACITY = 0.04;
const SHADOW_LAYERS: [number, number][] = [
  [-3, 3],
  [-2, 2],
  [-1, 1],
];

export type SunProps = {
  /** Number of rays/teeth. */
  rayCount: number;
  /** Fill color for all rays. */
  color: string;
  /** Inner radius in SVG units. */
  innerRadius: number;
  /** Outer radius in SVG units. */
  outerRadius: number;
  /** ViewBox and rendered width/height in px (default DEFAULT_VIEWBOX_SIZE). */
  size?: number;
  /** How viewBox maps to viewport (e.g. "xMidYMid slice"). */
  preserveAspectRatio?: string;
};

// ============================================================================
// Main component
// ============================================================================

/**
 * Renders an SVG sun: rayCount wedges from innerRadius to outerRadius with
 * rounded tips (quadratic Bézier). When rayCount < 1 or outerRadius <=
 * innerRadius, renders nothing.
 *
 * @param props - rayCount, color, innerRadius, outerRadius; optional size, preserveAspectRatio
 * @returns SVG sun element or empty SVG
 */
const Sun = ({
  rayCount,
  color,
  innerRadius,
  outerRadius,
  size = DEFAULT_VIEWBOX_SIZE,
  preserveAspectRatio,
}: SunProps) => {
  const pathStrings = useMemo(
    () => buildSunRayPaths(0, 0, innerRadius, outerRadius, rayCount),
    [innerRadius, outerRadius, rayCount],
  );

  const half = size / 2;

  const shadowFill = "black";

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`${-half} ${-half} ${size} ${size}`}
      preserveAspectRatio={preserveAspectRatio}
    >
      {/* Pseudo-drop shadow: layered black copies (same pattern as AnimatedWave) */}
      {SHADOW_LAYERS.map(([dx, dy]) => (
        <G
          key={`shadow-${dx}-${dy}`}
          transform={`translate(${dx}, ${dy})`}
          fill={shadowFill}
          fillOpacity={SHADOW_OPACITY}
        >
          <Circle cx={0} cy={0} r={innerRadius + 1} />
          {pathStrings.map((d, i) => (
            <Path
              // biome-ignore lint/suspicious/noArrayIndexKey: rays are deterministic from rayCount, never reorder
              key={i}
              d={d}
            />
          ))}
        </G>
      ))}

      {/* Central disc slightly larger than innerRadius to hide ray base seams */}
      <Circle cx={0} cy={0} r={innerRadius + 1} fill={color} />
      {pathStrings.map((d, i) => (
        <Path
          // biome-ignore lint/suspicious/noArrayIndexKey: rays are deterministic from rayCount, never reorder
          key={i}
          d={d}
          fill={color}
        />
      ))}
    </Svg>
  );
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Polar to cartesian: (cx, cy) + r*(cos θ, sin θ).
 *
 * @param cx - Center x
 * @param cy - Center y
 * @param r - Radius
 * @param angle - Angle in radians
 * @returns [x, y]
 */
const polarToCartesian = (
  cx: number,
  cy: number,
  r: number,
  angle: number,
): [number, number] => [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];

/**
 * Builds SVG path "d" strings for each ray: tapered wedge from inner to outer
 * radius with rounded tips using quadratic Bézier (Q). One path per ray.
 *
 * @param cx - Center x
 * @param cy - Center y
 * @param innerRadius - Inner radius (SVG units)
 * @param outerRadius - Outer radius (SVG units)
 * @param rayCount - Number of rays
 * @returns Array of path "d" strings (empty if rayCount < 1 or outerRadius <= innerRadius)
 */
const buildSunRayPaths = (
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  rayCount: number,
): string[] => {
  if (rayCount < 1 || outerRadius <= innerRadius) return [];

  const sliceAngle = (2 * Math.PI) / rayCount;
  const rayHeight = outerRadius - innerRadius;
  const paths: string[] = [];

  for (let i = 0; i < rayCount; i++) {
    const midAngle = i * sliceAngle;
    const baseHalfAngle = (sliceAngle * RAY_BASE_WIDTH_FRACTION) / 2;
    const tipHalfAngle =
      (sliceAngle * RAY_BASE_WIDTH_FRACTION * RAY_TIP_WIDTH_FRACTION) / 2;

    // Base points (at inner radius)
    const [ax, ay] = polarToCartesian(
      cx,
      cy,
      innerRadius,
      midAngle - baseHalfAngle,
    );
    const [dx, dy] = polarToCartesian(
      cx,
      cy,
      innerRadius,
      midAngle + baseHalfAngle,
    );

    // Tip points (at outer radius)
    const [bx, by] = polarToCartesian(
      cx,
      cy,
      outerRadius,
      midAngle - tipHalfAngle,
    );
    const [cxOut, cyOut] = polarToCartesian(
      cx,
      cy,
      outerRadius,
      midAngle + tipHalfAngle,
    );

    // Control point for the rounded tip bulge.
    const [outerTipX, outerTipY] = polarToCartesian(
      cx,
      cy,
      outerRadius + rayHeight * OUTER_BULGE_FRACTION,
      midAngle,
    );

    // Path: Move to BaseLeft, Line to TipLeft, Quadratic to TipRight (bulging), Line to BaseRight, Close
    const d = `M ${ax},${ay} L ${bx},${by} Q ${outerTipX},${outerTipY} ${cxOut},${cyOut} L ${dx},${dy} Z`;
    paths.push(d);
  }

  return paths;
};

export { Sun };
