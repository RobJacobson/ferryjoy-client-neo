// ============================================================================
// Sunburst
// ============================================================================
// SVG sunburst effect: configurable number of rays as triangular paths from
// center, alternating with gaps. Optional radial gradient (startColor → endColor).
// ============================================================================

import { useId, useMemo } from "react";
import Svg, {
  Defs,
  Path,
  Pattern,
  RadialGradient,
  Stop,
  Image as SvgImage,
} from "react-native-svg";

// ============================================================================
// Constants / types
// ============================================================================

const PAPER_TEXTURE_OPACITY = 0.25;
const PAPER_TEXTURE = require("assets/textures/paper-texture-4-bw.png");

/** ViewBox and default size for the sunburst SVG; single source of truth for layout. */
export const SUNBURST_VIEWBOX_SIZE = 1000;

const DEFAULT_SIZE = SUNBURST_VIEWBOX_SIZE;

export type SunburstProps = {
  /** Number of white rays (gaps = same count). */
  rayCount: number;
  /** Solid fill when gradient not used. */
  color?: string;
  /** Solid fill opacity when gradient not used. */
  opacity?: number;
  /** If set with endColor, use radial gradient center→edge. */
  startColor?: string;
  /** If set with startColor, use radial gradient center→edge. */
  endColor?: string;
  /** ViewBox and rendered size in px (default SUNBURST_VIEWBOX_SIZE). */
  size?: number;
  /** How viewBox maps to viewport (e.g. "xMidYMid slice" = cover, centered). */
  preserveAspectRatio?: string;
};

// ============================================================================
// Main component
// ============================================================================

/**
 * Renders an SVG sunburst: rays as thin triangles from center, alternating with
 * gaps. Supports solid fill (color/opacity) or radial gradient (startColor/endColor).
 * When rayCount is 0, renders an empty SVG.
 *
 * @param props - Sunburst props (rayCount required; color, opacity, startColor, endColor, size optional)
 * @returns SVG sunburst element
 */
const Sunburst = ({
  rayCount,
  color = "white",
  opacity = 0.5,
  startColor,
  endColor,
  size = DEFAULT_SIZE,
  preserveAspectRatio,
}: SunburstProps) => {
  const gradientId = useId();
  const textureId = `${gradientId}-tex`.replace(/:/g, "-");
  const useGradient =
    startColor != null &&
    startColor !== "" &&
    endColor != null &&
    endColor !== "";

  const center = size / 2;
  const radius = size / 2;

  const pathStrings = useMemo(
    () => buildRayPaths(center, radius, rayCount),
    [center, radius, rayCount],
  );

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
        <Pattern
          id={textureId}
          patternUnits="userSpaceOnUse"
          width={400}
          height={400}
        >
          <SvgImage
            href={PAPER_TEXTURE}
            width={512}
            height={512}
            preserveAspectRatio="xMidYMid slice"
          />
        </Pattern>
      </Defs>
      {pathStrings.map((d, i) => (
        <Path
          // biome-ignore lint/suspicious/noArrayIndexKey: rays are deterministic from rayCount, never reorder
          key={i}
          d={d}
          fill={useGradient ? `url(#${gradientIdSafe})` : color}
          fillOpacity={useGradient ? undefined : opacity}
        />
      ))}
      {/* Paper texture overlay - same as AnimatedWave */}
      {pathStrings.map((d, i) => (
        <Path
          // biome-ignore lint/suspicious/noArrayIndexKey: rays are deterministic from rayCount, never reorder
          key={`tex-${i}`}
          d={d}
          fill={`url(#${textureId})`}
          fillOpacity={PAPER_TEXTURE_OPACITY}
        />
      ))}
    </Svg>
  );
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Builds SVG path data strings for each ray (triangle from center to two outer vertices).
 * Ray i occupies slice indices 2*i and 2*i+1 in the full circle; only the first half of each pair is drawn.
 *
 * @param center - X and Y of center (same for both)
 * @param radius - Outer radius of rays
 * @param rayCount - Number of rays to draw
 * @returns Array of path "d" strings, one per ray (empty if rayCount is 0)
 */
const buildRayPaths = (
  center: number,
  radius: number,
  rayCount: number,
): string[] => {
  if (rayCount <= 0) return [];

  const sliceAngle = Math.PI / rayCount;
  const paths: string[] = [];

  for (let i = 0; i < rayCount; i++) {
    const startAngle = i * 2 * sliceAngle;
    const endAngle = (i * 2 + 1) * sliceAngle;
    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);
    paths.push(`M ${center},${center} L ${x1},${y1} L ${x2},${y2} Z`);
  }

  return paths;
};

export { Sunburst };
