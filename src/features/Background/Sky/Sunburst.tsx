// ============================================================================
// Sunburst
// ============================================================================
// SVG sunburst effect: configurable number of rays as curved triangular paths
// from center, alternating with gaps. Rays use quadratic Bézier curves for a
// spiral effect. Solid fill from startColor, or radial gradient (startColor →
// endColor) when endColor is provided.
// ============================================================================

import { useId } from "react";
import Svg, {
  Defs,
  Path,
  Pattern,
  RadialGradient,
  Stop,
  Image as SvgImage,
} from "react-native-svg";
import config from "./config";

// ============================================================================
// Types
// ============================================================================

type SunburstProps = {
  /**
   * Paper texture source. When null, SVG does not render the texture overlay.
   */
  paperTextureUrl?: number | string | null;
  /** Number of rays (gaps = same count). */
  rayCount: number;
  /** Required solid or gradient start color. */
  startColor: string;
  /** Optional gradient end color. If omitted, solid fill with startColor. */
  endColor?: string;
  /** ViewBox and rendered size in px (default from config). */
  size?: number;
  /** How viewBox maps to viewport (e.g. "xMidYMid slice" = cover, centered). */
  preserveAspectRatio?: string;
  /**
   * Spiral curve strength for ray edges (0 = straight, ~0.15 = moderate).
   * Uses quadratic Bézier; positive curves counter-clockwise.
   */
  spiralStrength?: number;
};

// ============================================================================
// Main component
// ============================================================================

/**
 * Renders an SVG sunburst: rays as curved triangles from center, alternating with
 * gaps. Supports solid fill (startColor) or radial gradient (startColor → endColor).
 * When rayCount is 0, renders an empty SVG.
 *
 * @param paperTextureUrl - Paper texture source (null for no texture)
 * @param rayCount - Number of rays (gaps = same count)
 * @param startColor - Solid or gradient start color
 * @param endColor - Optional gradient end color (omitted for solid fill)
 * @param size - ViewBox and rendered size in pixels (default from config)
 * @param preserveAspectRatio - How viewBox maps to viewport
 * @param spiralStrength - Spiral curve strength for ray edges (0 = straight)
 * @returns SVG sunburst element
 */
const Sunburst = ({
  paperTextureUrl,
  rayCount,
  startColor,
  endColor,
  size = config.sunburst.defaultSize,
  preserveAspectRatio,
  spiralStrength = config.sunburst.spiralStrength,
}: SunburstProps) => {
  const gradientId = useId();
  const textureId = `${gradientId}-tex`.replace(/:/g, "-");
  const useGradient = endColor != null && endColor !== "";

  const center = size / 2;
  const radius = size / 2;

  const pathStrings = buildRayPaths(center, radius, rayCount, spiralStrength);

  const gradientIdSafe = gradientId.replace(/:/g, "-");

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio={preserveAspectRatio}
    >
      <Defs>
        {useGradient && (
          <RadialGradient
            id={gradientIdSafe}
            cx={center}
            cy={center}
            r={radius}
            fx={center}
            fy={center}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={startColor} />
            <Stop offset="1" stopColor={endColor} />
          </RadialGradient>
        )}
        {paperTextureUrl != null && (
          <Pattern
            id={textureId}
            patternUnits="userSpaceOnUse"
            width={400}
            height={400}
          >
            <SvgImage
              href={paperTextureUrl}
              width={512}
              height={512}
              preserveAspectRatio="xMidYMid slice"
            />
          </Pattern>
        )}
      </Defs>
      {/* Pseudo-drop shadow: angular offset so each ray has the same shadow direction */}
      {[1.5, 1, 0.5].flatMap((rotation, layerIdx) =>
        pathStrings.map((d, i) => (
          <Path
            // biome-ignore lint/suspicious/noArrayIndexKey: rays are deterministic from rayCount, never reorder
            key={`shadow-${layerIdx}-${i}`}
            d={d}
            fill="black"
            fillOpacity={0.02}
            transform={`rotate(${rotation}, ${center}, ${center})`}
          />
        ))
      )}
      {pathStrings.map((d, i) => (
        <Path
          // biome-ignore lint/suspicious/noArrayIndexKey: rays are deterministic from rayCount, never reorder
          key={i}
          d={d}
          fill={useGradient ? `url(#${gradientIdSafe})` : startColor}
          stroke="black"
          strokeOpacity={0.15}
          strokeWidth={0.5}
        />
      ))}
      {/* Paper texture overlay - same as AnimatedWave (only when paperTextureUrl set) */}
      {paperTextureUrl != null &&
        pathStrings.map((d, i) => (
          <Path
            // biome-ignore lint/suspicious/noArrayIndexKey: rays are deterministic from rayCount, never reorder
            key={`tex-${i}`}
            d={d}
            fill={`url(#${textureId})`}
            fillOpacity={config.paperTextureOpacity}
          />
        ))}
    </Svg>
  );
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Builds SVG path data strings for each ray (triangle from center to two outer
 * vertices). Ray i occupies slice indices 2*i and 2*i+1 in the full circle;
 * only the first half of each pair is drawn. When spiralStrength > 0, the
 * radial edges use quadratic Bézier curves for a spiral effect.
 *
 * @param center - X and Y of center (same for both)
 * @param radius - Outer radius of rays
 * @param rayCount - Number of rays to draw
 * @param spiralStrength - Curve strength (0 = straight; ~0.15 = moderate spiral)
 * @returns Array of path "d" strings, one per ray (empty if rayCount is 0)
 */
const buildRayPaths = (
  center: number,
  radius: number,
  rayCount: number,
  spiralStrength: number
): string[] => {
  if (rayCount <= 0) return [];

  const sliceAngle = Math.PI / rayCount;
  const paths: string[] = [];
  const useCurve = spiralStrength !== 0;

  for (let i = 0; i < rayCount; i++) {
    const startAngle = i * 2 * sliceAngle;
    const endAngle = (i * 2 + 1) * sliceAngle;
    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);

    let d: string;
    if (useCurve) {
      // Tangent (perpendicular to radius) for spiral offset; positive = CCW
      const tx1 = -Math.sin(startAngle);
      const ty1 = Math.cos(startAngle);
      const tx2 = -Math.sin(endAngle);
      const ty2 = Math.cos(endAngle);
      const offset = spiralStrength * radius;
      const cx1 = center + 0.5 * radius * Math.cos(startAngle) + offset * tx1;
      const cy1 = center + 0.5 * radius * Math.sin(startAngle) + offset * ty1;
      const cx2 = center + 0.5 * radius * Math.cos(endAngle) + offset * tx2;
      const cy2 = center + 0.5 * radius * Math.sin(endAngle) + offset * ty2;
      d = `M ${center},${center} Q ${cx1},${cy1} ${x1},${y1} L ${x2},${y2} Q ${cx2},${cy2} ${center},${center} Z`;
    } else {
      d = `M ${center},${center} L ${x1},${y1} L ${x2},${y2} Z`;
    }
    paths.push(d);
  }

  return paths;
};

export { Sunburst };
