// ============================================================================
// SunburstClipped
// ============================================================================
// Clip-path variant of Sunburst: same visual via clipped rects (color/gradient
// + texture) instead of path fills. Same props as Sunburst; uses buildRayPaths.
// ============================================================================

import { useId, useMemo } from "react";
import Svg, {
  ClipPath,
  Defs,
  G,
  Path,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
  Image as SvgImage,
} from "react-native-svg";
import {
  buildRayPaths,
  SUNBURST_VIEWBOX_SIZE,
  type SunburstProps,
} from "./Sunburst";

// ============================================================================
// Constants
// ============================================================================

const PAPER_TEXTURE_OPACITY = 0.25;

const STROKE_COLOR = "black";
const STROKE_WIDTH = 0.5;
const STROKE_OPACITY = 0.15;

/** Pseudo-drop shadow: same rotate-based layers as Sunburst. */
const SHADOW_OPACITY = 0.02;
const SHADOW_ROTATIONS = [1.5, 1, 0.5];

const DEFAULT_SIZE = SUNBURST_VIEWBOX_SIZE;

// ============================================================================
// Main component
// ============================================================================

/**
 * Clip-path variant of Sunburst: color/gradient and texture applied via
 * full-size rects clipped to the ray shape (AnimatedWaveClipped pattern).
 *
 * @param props - Same as Sunburst (rayCount, color, opacity, startColor, endColor, size, spiralStrength)
 * @returns SVG sunburst element
 */
const SunburstClipped = ({
  paperTextureUrl,
  rayCount,
  color = "white",
  opacity = 0.5,
  startColor,
  endColor,
  size = DEFAULT_SIZE,
  preserveAspectRatio,
  spiralStrength = -0.15,
}: SunburstProps) => {
  const gradientId = useId();
  const gradientIdSafe = gradientId.replace(/:/g, "-");
  const clipId = `sunburst-clip-${gradientIdSafe}`;
  const textureId = `sunburst-tex-${gradientIdSafe}`;

  const useGradient =
    startColor != null &&
    startColor !== "" &&
    endColor != null &&
    endColor !== "";

  const center = size / 2;
  const radius = size / 2;

  const pathStrings = useMemo(
    () => buildRayPaths(center, radius, rayCount, spiralStrength),
    [center, radius, rayCount, spiralStrength]
  );

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio={preserveAspectRatio}
    >
      <Defs>
        <ClipPath id={clipId}>
          {pathStrings.map((d, i) => (
            <Path
              // biome-ignore lint/suspicious/noArrayIndexKey: rays deterministic from rayCount
              key={i}
              d={d}
            />
          ))}
        </ClipPath>
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
            width={512}
            height={512}
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

      {/* Pseudo-drop shadow: angular offset (same as Sunburst) */}
      {SHADOW_ROTATIONS.map((rot) => (
        <G
          key={`shadow-${rot}`}
          fill={STROKE_COLOR}
          fillOpacity={SHADOW_OPACITY}
          transform={`rotate(${rot}, ${center}, ${center})`}
        >
          {pathStrings.map((d, i) => (
            <Path
              // biome-ignore lint/suspicious/noArrayIndexKey: rays deterministic from rayCount
              key={i}
              d={d}
            />
          ))}
        </G>
      ))}

      {/* Clipped group: color/gradient rect then texture rect (AnimatedWaveClipped pattern) */}
      <G clipPath={`url(#${clipId})`}>
        <Rect
          x={0}
          y={0}
          width={size}
          height={size}
          fill={useGradient ? `url(#${gradientIdSafe})` : color}
          fillOpacity={useGradient ? undefined : opacity}
        />
        {paperTextureUrl != null && (
          <Rect
            x={0}
            y={0}
            width={size}
            height={size}
            fill={`url(#${textureId})`}
            fillOpacity={PAPER_TEXTURE_OPACITY}
          />
        )}
      </G>

      {/* Stroke outline to match Sunburst */}
      {pathStrings.map((d, i) => (
        <Path
          // biome-ignore lint/suspicious/noArrayIndexKey: rays deterministic from rayCount
          key={i}
          d={d}
          fill="none"
          stroke={STROKE_COLOR}
          strokeWidth={STROKE_WIDTH}
          strokeOpacity={STROKE_OPACITY}
        />
      ))}
    </Svg>
  );
};

export default SunburstClipped;
