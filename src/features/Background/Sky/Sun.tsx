// ============================================================================
// Sun
// ============================================================================
// SVG sun with rayCount rays between innerRadius and outerRadius. Each ray is
// a wedge with rounded tips at both radii using quadratic Bézier curves (no
// sampling). Gear-like, exact paths.
// ============================================================================

import Svg, { Circle, G, Path } from "react-native-svg";
import config from "./config";

// ============================================================================
// Types
// ============================================================================

type SunProps = {
  /** Number of rays/teeth. */
  rayCount: number;
  /** Fill color for all rays. */
  color: string;
  /** Inner radius in SVG units. */
  innerRadius: number;
  /** Outer radius in SVG units. */
  outerRadius: number;
  /** ViewBox and rendered width/height in px (default from config). */
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
  size = config.sun.viewBoxSize,
  preserveAspectRatio,
}: SunProps) => {
  const pathStrings = buildSunRayPaths(
    0,
    0,
    innerRadius,
    outerRadius,
    rayCount
  );
  const rayStrokePaths = buildRayStrokePaths(
    0,
    0,
    innerRadius,
    outerRadius,
    rayCount
  );

  // ViewBox must fit geometry: rays extend to outerRadius + bulge. When size
  // is small (scaled on phones), use minimum so rays are not clipped.
  const rayHeight = outerRadius - innerRadius;
  const maxExtent =
    outerRadius + rayHeight * config.sun.rayGeometry.outerBulgeFraction;
  const minViewBoxHalf = maxExtent + 5;
  const viewBoxHalf = Math.max(size / 2, minViewBoxHalf);

  const shadowFill = "black";

  const viewBoxSize = viewBoxHalf * 2;
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`${-viewBoxHalf} ${-viewBoxHalf} ${viewBoxSize} ${viewBoxSize}`}
      preserveAspectRatio={preserveAspectRatio}
    >
      {/* Pseudo-drop shadow: layered black copies (same pattern as AnimatedWave) */}
      {config.sun.shadowLayers.map(([dx, dy]) => (
        <G
          key={`shadow-${dx}-${dy}`}
          transform={`translate(${dx}, ${dy})`}
          fill={shadowFill}
          fillOpacity={config.sun.shadowOpacity}
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
      {/* Stroke each ray along its two sides and outer bulge only (no inner chord) */}
      {rayStrokePaths.map((d, i) => (
        <Path
          // biome-ignore lint/suspicious/noArrayIndexKey: rays are deterministic from rayCount, never reorder
          key={i}
          d={d}
          fill="none"
          stroke={config.sun.stroke.color}
          strokeWidth={config.sun.stroke.width}
          strokeOpacity={config.sun.stroke.opacity}
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
  angle: number
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
  rayCount: number
): string[] => {
  if (rayCount < 1 || outerRadius <= innerRadius) return [];

  const { baseWidthFraction, tipWidthFraction, outerBulgeFraction } =
    config.sun.rayGeometry;
  const sliceAngle = (2 * Math.PI) / rayCount;
  const rayHeight = outerRadius - innerRadius;
  const paths: string[] = [];

  for (let i = 0; i < rayCount; i++) {
    const midAngle = i * sliceAngle;
    const baseHalfAngle = (sliceAngle * baseWidthFraction) / 2;
    const tipHalfAngle =
      (sliceAngle * baseWidthFraction * tipWidthFraction) / 2;

    // Base points (at inner radius)
    const [ax, ay] = polarToCartesian(
      cx,
      cy,
      innerRadius,
      midAngle - baseHalfAngle
    );
    const [dx, dy] = polarToCartesian(
      cx,
      cy,
      innerRadius,
      midAngle + baseHalfAngle
    );

    // Tip points (at outer radius)
    const [bx, by] = polarToCartesian(
      cx,
      cy,
      outerRadius,
      midAngle - tipHalfAngle
    );
    const [cxOut, cyOut] = polarToCartesian(
      cx,
      cy,
      outerRadius,
      midAngle + tipHalfAngle
    );

    // Control point for the rounded tip bulge.
    const [outerTipX, outerTipY] = polarToCartesian(
      cx,
      cy,
      outerRadius + rayHeight * outerBulgeFraction,
      midAngle
    );

    // Path: Move to BaseLeft, Line to TipLeft, Quadratic to TipRight (bulging), Line to BaseRight, Close
    const d = `M ${ax},${ay} L ${bx},${by} Q ${outerTipX},${outerTipY} ${cxOut},${cyOut} L ${dx},${dy} Z`;
    paths.push(d);
  }

  return paths;
};

/**
 * Builds one open path per ray for stroking: left edge, outer bulge, right edge.
 * Omits the inner chord so the inner circle is not stroked.
 *
 * @param cx - Center x
 * @param cy - Center y
 * @param innerRadius - Inner radius (SVG units)
 * @param outerRadius - Outer radius (SVG units)
 * @param rayCount - Number of rays
 * @returns Array of path "d" strings (one per ray), empty if rayCount < 1 or outerRadius <= innerRadius
 */
const buildRayStrokePaths = (
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  rayCount: number
): string[] => {
  if (rayCount < 1 || outerRadius <= innerRadius) return [];

  const { baseWidthFraction, tipWidthFraction, outerBulgeFraction } =
    config.sun.rayGeometry;
  const sliceAngle = (2 * Math.PI) / rayCount;
  const rayHeight = outerRadius - innerRadius;
  const baseHalfAngle = (sliceAngle * baseWidthFraction) / 2;
  const tipHalfAngle = (sliceAngle * baseWidthFraction * tipWidthFraction) / 2;
  const paths: string[] = [];

  for (let i = 0; i < rayCount; i++) {
    const midAngle = i * sliceAngle;

    const [ax, ay] = polarToCartesian(
      cx,
      cy,
      innerRadius,
      midAngle - baseHalfAngle
    );
    const [dx, dy] = polarToCartesian(
      cx,
      cy,
      innerRadius,
      midAngle + baseHalfAngle
    );
    const [bx, by] = polarToCartesian(
      cx,
      cy,
      outerRadius,
      midAngle - tipHalfAngle
    );
    const [cxOut, cyOut] = polarToCartesian(
      cx,
      cy,
      outerRadius,
      midAngle + tipHalfAngle
    );
    const [outerTipX, outerTipY] = polarToCartesian(
      cx,
      cy,
      outerRadius + rayHeight * outerBulgeFraction,
      midAngle
    );

    // Open path: baseLeft → tipLeft → bulge → tipRight → baseRight (no inner chord)
    const d = `M ${ax},${ay} L ${bx},${by} Q ${outerTipX},${outerTipY} ${cxOut},${cyOut} L ${dx},${dy}`;
    paths.push(d);
  }

  return paths;
};

export { Sun };
